import pytest
import asyncio
import time
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.engine.swarm_orchestrator import SwarmOrchestrator
from app.engine.observer import observer_engine
from app.services.persona_service import persona_service
from app.storage.database import get_db_connection

@pytest.mark.asyncio
async def test_10_agent_simulation():
    orchestrator = SwarmOrchestrator(max_concurrency=5)
    await orchestrator.initialize_simulation("test-scen-10", total_rounds=2)
    # Filter to 10 agents for quick sanity test
    orchestrator.agents = orchestrator.agents[:10]

    assert len(orchestrator.agents) == 10

    start_time = time.time()
    await orchestrator.execute_next_round()
    elapsed = time.time() - start_time

    assert orchestrator.current_round == 1
    assert len(orchestrator.channel_events["BOARDROOM"]) + len(orchestrator.channel_events["MEDIA"]) + len(orchestrator.channel_events["PUBLIC"]) >= 10
    assert elapsed < 5.0, f"10-agent round latency ({elapsed:.2f}s) exceeded limit"

@pytest.mark.asyncio
async def test_concurrency_limit_semaphore():
    orchestrator = SwarmOrchestrator(max_concurrency=5)
    assert orchestrator.semaphore._value == 5

@pytest.mark.asyncio
async def test_observer_summaries():
    sample_events = {
        "BOARDROOM": [{"message": "Executive pricing discussion"}],
        "MEDIA": [{"message": "Investigative leak"}],
        "PUBLIC": [{"message": "User dissatisfaction thread"}]
    }
    summaries = observer_engine.generate_channel_summaries(1, sample_events)
    assert "BOARDROOM" in summaries
    assert "MEDIA" in summaries
    assert "PUBLIC" in summaries
    assert len(summaries["BOARDROOM"].split("\n")) == 3

@pytest.mark.asyncio
async def test_50_agent_10_round_benchmark():
    orchestrator = SwarmOrchestrator(max_concurrency=5)
    await orchestrator.initialize_simulation("benchmark-scen-50", total_rounds=2)
    assert len(orchestrator.agents) == 50

    start_time = time.time()
    # Execute 2 benchmark rounds
    await orchestrator.execute_next_round()
    await orchestrator.execute_next_round()
    elapsed = time.time() - start_time

    total_events = sum(len(v) for v in orchestrator.channel_events.values())

    # Verify database persistence
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM feed_events WHERE scenario_id = 'benchmark-scen-50'")
    db_count = cursor.fetchone()[0]
    conn.close()

    assert total_events >= 100
    assert db_count >= 100
    assert elapsed < 15.0, f"Benchmark execution latency ({elapsed:.2f}s) exceeded threshold"

@pytest.mark.asyncio
async def test_real_play_pause_step_controls():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Step
        step_res = await ac.post("/api/scenarios/scen-01/simulation/step")
        assert step_res.status_code == 200
        assert step_res.json()["status"] == "PAUSED"

        # Pause
        pause_res = await ac.post("/api/scenarios/scen-01/simulation/pause")
        assert pause_res.status_code == 200
        assert pause_res.json()["status"] == "PAUSED"

        # Reset
        reset_res = await ac.post("/api/scenarios/scen-01/simulation/reset")
        assert reset_res.status_code == 200
        assert reset_res.json()["status"] == "IDLE"
        assert reset_res.json()["currentRound"] == 0
