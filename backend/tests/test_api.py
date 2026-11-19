import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_root_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "OPERATIONAL"

@pytest.mark.asyncio
async def test_scenarios_endpoints():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/scenarios")
        assert res.status_code == 200
        scenarios = res.json()
        assert len(scenarios) >= 1

        scen_id = scenarios[0]["id"]
        agents_res = await ac.get(f"/api/scenarios/{scen_id}/agents")
        assert agents_res.status_code == 200
        assert len(agents_res.json()) == 200

        graph_res = await ac.get(f"/api/scenarios/{scen_id}/graph")
        assert graph_res.status_code == 200
        assert "nodes" in graph_res.json()

@pytest.mark.asyncio
async def test_agent_interrogate():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/agents/agent-04/interrogate", json={"user_question": "Why warning on price hike?"})
        assert res.status_code == 200
        data = res.json()
        assert data["agent_id"] == "agent-04"
        assert "CFO" in data["agent_role"]
