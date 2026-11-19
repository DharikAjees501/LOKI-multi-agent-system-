import pytest
from app.services.persona_service import persona_service

def test_200_persona_generation():
    scenario_id = "test-scen-200"
    personas = persona_service.generate_personas_for_scenario(scenario_id, total_agents=200)
    assert len(personas) == 200

    # Verify Tier distribution
    tier0 = [p for p in personas if p.tier == 0]
    tier1 = [p for p in personas if p.tier == 1]
    tier2 = [p for p in personas if p.tier == 2]
    tier3 = [p for p in personas if p.tier == 3]
    tier4 = [p for p in personas if p.tier == 4]

    assert len(tier0) == 2
    assert len(tier1) == 18
    assert len(tier2) == 25
    assert len(tier3) == 25
    assert len(tier4) == 130

    # Verify agent attributes
    cfo = next(p for p in personas if p.role == "CFO (Chief Financial Officer)")
    assert cfo.tier == 1
    assert "Margin protection" in cfo.bias
