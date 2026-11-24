from fastapi import APIRouter, Query
from typing import Optional
from app.services.graph_service import graph_service
from app.models.graph import ScenarioGraphResponse

router = APIRouter(tags=["graph"])

@router.get("/graph", response_model=ScenarioGraphResponse)
@router.get("/scenarios/{id}/graph", response_model=ScenarioGraphResponse)
async def get_scenario_graph(
    id: Optional[str] = None,
    scenario_id: Optional[str] = Query(None),
    round: Optional[int] = Query(None),
    type: Optional[str] = Query(None)
):
    target_id = scenario_id or id
    if not target_id or target_id == "scen-01":
        return ScenarioGraphResponse(scenario_id="", nodes=[], edges=[])
    if type in ["knowledge", "entities", "rag"]:
        return graph_service.get_raw_entity_graph(target_id, round_num=round)
    return graph_service.get_scenario_graph(target_id, round_num=round)

@router.get("/graph/{scenario_id}", response_model=ScenarioGraphResponse)
async def get_graph_by_scenario_id(
    scenario_id: str,
    round: Optional[int] = Query(None),
    type: Optional[str] = Query(None)
):
    if not scenario_id or scenario_id == "scen-01":
        return ScenarioGraphResponse(scenario_id="", nodes=[], edges=[])
    if type in ["knowledge", "entities", "rag"]:
        return graph_service.get_raw_entity_graph(scenario_id, round_num=round)
    return graph_service.get_scenario_graph(scenario_id, round_num=round)

@router.get("/scenarios/{id}/knowledge-graph", response_model=ScenarioGraphResponse)
@router.get("/graph/{scenario_id}/knowledge", response_model=ScenarioGraphResponse)
async def get_scenario_knowledge_graph(
    id: Optional[str] = None,
    scenario_id: Optional[str] = None,
    round: Optional[int] = Query(None)
):
    target_id = scenario_id or id
    if not target_id or target_id == "scen-01":
        return ScenarioGraphResponse(scenario_id="", nodes=[], edges=[])
    return graph_service.get_raw_entity_graph(target_id, round_num=round)
