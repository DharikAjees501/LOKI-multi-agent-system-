from fastapi import APIRouter, Query
from typing import Optional
from app.services.graph_service import graph_service
from app.models.graph import ScenarioGraphResponse

router = APIRouter(tags=["graph"])

@router.get("/graph", response_model=ScenarioGraphResponse)
@router.get("/scenarios/{id}/graph", response_model=ScenarioGraphResponse)
async def get_scenario_graph(id: str = "scen-01", scenario_id: Optional[str] = Query(None), round: Optional[int] = Query(None)):
    target_id = scenario_id or id
    return graph_service.get_scenario_graph(target_id, round_num=round)

@router.get("/graph/{scenario_id}", response_model=ScenarioGraphResponse)
async def get_graph_by_scenario_id(scenario_id: str, round: Optional[int] = Query(None)):
    return graph_service.get_scenario_graph(scenario_id, round_num=round)
