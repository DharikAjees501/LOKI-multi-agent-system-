import pytest
import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.core.retry import execute_with_retry
from app.core.telemetry import telemetry
from app.core.rate_limiter import rate_limiter
from app.storage.database import get_db_transaction, log_audit_event, get_db_connection
from app.engine.swarm_orchestrator import orchestrator_engine
from app.services.simulation_service import simulation_service

client = TestClient(app)

def test_health_and_metrics_endpoints():
    res_h = client.get("/api/health")
    assert res_h.status_code == 200
    assert res_h.json()["status"] == "HEALTHY"

    res_m = client.get("/api/metrics")
    assert res_m.status_code == 200
    assert "llm_metrics" in res_m.json()
    assert "simulation_metrics" in res_m.json()

def test_file_upload_validation_file_size_limit():
    # 1. Invalid extension test
    res_ext = client.post("/api/documents/upload", files={"file": ("malicious.exe", b"binary_content", "application/octet-stream")})
    assert res_ext.status_code == 400
    assert "Unsupported file format" in res_ext.json()["detail"]

    # 2. File size limit test (>15MB)
    large_content = b"A" * (15 * 1024 * 1024 + 1024)  # 15MB + 1KB
    res_size = client.post("/api/documents/upload", files={"file": ("oversized.pdf", large_content, "application/pdf")})
    assert res_size.status_code == 413
    assert "exceeds maximum limit" in res_size.json()["detail"]

    # 3. Path traversal filename sanitation test
    res_path = client.post("/api/documents/upload", files={"file": ("../../etc/passwd.txt", b"Valid text content", "text/plain")})
    assert res_path.status_code == 200
    assert res_path.json()["filename"] == "passwd.txt"

def test_rate_limiting_middleware():
    client_ip = "192.168.1.100"
    # Execute until rate limit hit
    allowed_count = 0
    for _ in range(150):
        allowed, remaining = rate_limiter.is_allowed(client_ip, limit_override=5)
        if allowed:
            allowed_count += 1
    assert allowed_count == 5

@pytest.mark.asyncio
async def test_retry_helper_exponential_backoff():
    attempt_counter = 0

    async def transient_failure_op():
        nonlocal attempt_counter
        attempt_counter += 1
        if attempt_counter < 3:
            raise ValueError("Transient API rate limit error 429")
        return "SUCCESS"

    result = await execute_with_retry(transient_failure_op, max_retries=3, backoff_factor=0.1, operation_name="TestRetry")
    assert result == "SUCCESS"
    assert attempt_counter == 3

def test_database_transaction_safety_rollback():
    # Test automatic rollback on error inside transaction context
    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO audit_logs (id, timestamp, event_type, actor, details) VALUES ('test-err-01', 'now', 'TEST', 'actor', 'details')")
            # Force syntax/constraint error inside transaction
            cursor.execute("INSERT INTO non_existent_table VALUES (1, 2, 3)")
    except Exception:
        pass

    # Verify audit_log entry was rolled back and not persisted
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM audit_logs WHERE id = 'test-err-01'")
    row = cursor.fetchone()
    conn.close()
    assert row is None

@pytest.mark.asyncio
async def test_50_agent_10_round_stress_benchmark():
    await orchestrator_engine.initialize_simulation("scen-stress-test")

    for round_num in range(1, 11):
        await orchestrator_engine.execute_next_round()
        events = simulation_service.get_feed_events("scen-stress-test")
        assert len(events) >= 5

    assert orchestrator_engine.current_round == 10
    assert len(orchestrator_engine.agents) == 50
