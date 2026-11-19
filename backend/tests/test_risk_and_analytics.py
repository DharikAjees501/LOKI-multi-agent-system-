import pytest
import json
from fastapi.testclient import TestClient
from app.main import app
from app.services.report_service import report_service
from app.services.persona_service import persona_service
from app.storage.database import get_db_connection

client = TestClient(app)

def test_risk_vector_synthesis():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO scenarios (id, name, created_date) VALUES ('scen-test-risk', 'Risk Test Scenario', '2026-06-28')")
    conn.commit()
    conn.close()

    # Generate 50 personas for test scenario
    persona_service.generate_50_personas_for_scenario("scen-test-risk")

    conn = get_db_connection()
    cursor = conn.cursor()

    payload1 = json.dumps({"decision": "OBJECT", "sentiment": "CRITICAL", "risk_level": "CRITICAL", "confidence": 90, "position": "High risk"})
    payload2 = json.dumps({"decision": "APPROVE", "sentiment": "POSITIVE", "risk_level": "LOW", "confidence": 95, "position": "Low risk"})

    cursor.execute("INSERT OR REPLACE INTO agent_actions (id, scenario_id, agent_id, round, action_type, payload, timestamp) VALUES ('act-t1', 'scen-test-risk', 'agent-scen-test-risk-01', 1, 'DECISION', ?, '12:00')", (payload1,))
    cursor.execute("INSERT OR REPLACE INTO agent_actions (id, scenario_id, agent_id, round, action_type, payload, timestamp) VALUES ('act-t2', 'scen-test-risk', 'agent-scen-test-risk-31', 1, 'DECISION', ?, '12:01')", (payload2,))
    conn.commit()
    conn.close()

    risks = report_service.get_risks("scen-test-risk")
    assert "overallRiskScore" in risks
    assert risks["overallRiskScore"] > 0
    assert "severityThreshold" in risks
    assert len(risks["keyRisks"]) >= 1

def test_sentiment_timeseries():
    s_data = report_service.get_sentiment("scen-test-risk")
    assert "breakdown" in s_data
    assert "timeseries" in s_data
    assert "positive" in s_data["breakdown"]
    assert "critical" in s_data["breakdown"]

def test_consensus_matrix():
    c_data = report_service.get_consensus("scen-test-risk")
    assert "items" in c_data
    assert len(c_data["items"]) >= 2
    assert "issues" in c_data
    assert len(c_data["issues"]) >= 1

def test_turning_points():
    tp = report_service.get_turning_points("scen-test-risk")
    assert isinstance(tp, list)
    assert len(tp) >= 1
    assert tp[0]["round"] == 1

def test_executive_report():
    report = report_service.get_report_for_scenario("scen-test-risk")
    assert "title" in report
    assert "executiveSummary" in report
    assert "keyRisks" in report
    assert "criticalTurningPoints" in report

def test_report_api_endpoints():
    r1 = client.get("/api/scenarios/scen-test-risk/report")
    assert r1.status_code == 200
    assert "executiveSummary" in r1.json()

    r2 = client.get("/api/scenarios/scen-test-risk/risks")
    assert r2.status_code == 200
    assert "overallRiskScore" in r2.json()

    r3 = client.get("/api/scenarios/scen-test-risk/sentiment")
    assert r3.status_code == 200
    assert "breakdown" in r3.json()

    r4 = client.get("/api/scenarios/scen-test-risk/consensus")
    assert r4.status_code == 200
    assert "items" in r4.json()

    r5 = client.get("/api/scenarios/scen-test-risk/turning-points")
    assert r5.status_code == 200
    assert isinstance(r5.json(), list)

    r6 = client.get("/api/scenarios/scen-test-risk/report/export?format=pdf")
    assert r6.status_code == 200
    assert "<html>" in r6.text.lower()
