import os
import uuid
import datetime
import asyncio
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Header, Request, Depends
from pydantic import BaseModel

from app.models.scenario import ScenarioModel, ScenarioCreate
from app.models.graph import ScenarioGraphResponse
from app.services.graph_service import graph_service
from app.engine.orchestrator import orchestrator
from app.services.persona_service import persona_service
from app.engine.oasis_engine import oasis_engine
from app.storage.database import get_db_connection
from app.core.config import settings
from app.core.logging import logger
from app.core.security import get_optional_current_user, get_current_user, verify_scenario_access

router = APIRouter(prefix="/scenarios", tags=["scenarios"])

@router.post("", response_model=ScenarioModel)
async def create_scenario(
    payload: ScenarioCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    logger.info(f"[Scenarios API] Creating new scenario: '{payload.name}'")
    scen_id = f"scen-{uuid.uuid4().hex[:6]}"
    created_date = datetime.datetime.now().strftime("%Y-%m-%d")

    user_id = current_user["id"]

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO scenarios (id, name, description, document_id, created_date, last_simulation, status, agent_count, overall_risk_score, user_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (scen_id, payload.name, payload.description, payload.document_id or "", created_date, "Never", "READY", 50, 50, user_id)
        )
        conn.commit()
    finally:
        conn.close()

    return ScenarioModel(
        id=scen_id,
        name=payload.name,
        description=payload.description,
        documentName=payload.document_id or "No document loaded",
        createdDate=created_date,
        lastSimulation="Never",
        status="READY",
        agentCount=50,
        overallRiskScore=50,
        user_id=user_id
    )

class CreateAndRunScenarioRequest(BaseModel):
    name: str
    description: Optional[str] = "Evaluate stakeholder alignment and strategic risk"
    document_id: Optional[str] = "doc-default"
    is_what_if: Optional[bool] = False

@router.post("/create-and-run")
async def create_and_run_scenario(
    payload: CreateAndRunScenarioRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    logger.info(f"[Scenarios API] Creating and running isolated scenario: '{payload.name}'")
    scen_id = f"scen-{uuid.uuid4().hex[:6]}"
    created_date = datetime.datetime.now().strftime("%Y-%m-%d")
    title = payload.name.strip() or "Strategic Scenario"
    desc = payload.description or "Evaluate strategic risk and stakeholder alignment"
    doc_id = payload.document_id or "doc-default"
    user_id = current_user["id"]

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO scenarios (id, name, description, document_id, created_date, last_simulation, status, agent_count, overall_risk_score, user_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (scen_id, title, desc, doc_id, created_date, "Never", "GENERATING_GRAPH", 200, 50, user_id)
        )
        conn.commit()
    finally:
        conn.close()

    async def execute_isolated_pipeline():
        try:
            # 1. GraphRAG extraction & 200-agent persona generation for scen_id
            await orchestrator.run_scenario_pipeline(
                scenario_id=scen_id,
                document_id=doc_id,
                scenario_title=title,
                description=desc
            )
            # 2. Spawn personas & run 5-round OASIS simulation
            agents = persona_service.generate_personas_for_scenario(scen_id, total_agents=200)
            await oasis_engine.run_full_simulation(
                scenario_id=scen_id,
                agents=agents,
                goal_prompt=desc,
                shock_event=f"CRITICAL SHOCK: Unannounced strategy restructuring for '{title[:40]}'",
                risk_threshold=35.0,
                is_what_if=payload.is_what_if or False
            )
        except Exception as err:
            logger.error(f"[Isolated Pipeline Error for {scen_id}]: {err}")

    # Dispatch non-blocking pipeline task
    asyncio.create_task(execute_isolated_pipeline())

    return {
        "id": scen_id,
        "name": title,
        "description": desc,
        "documentName": doc_id,
        "createdDate": created_date,
        "status": "GENERATING_GRAPH",
        "agentCount": 200,
        "overallRiskScore": 50,
        "message": f"Scenario {scen_id} created and isolated pipeline task dispatched."
    }

@router.get("", response_model=List[ScenarioModel])
async def list_scenarios(
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    user_id = current_user.get("id") if current_user else None

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        if user_id:
            cursor.execute("SELECT * FROM scenarios WHERE user_id = ? ORDER BY created_date DESC", (user_id,))
        else:
            cursor.execute("SELECT * FROM scenarios WHERE user_id IS NULL OR user_id = '' ORDER BY created_date DESC")
        rows = cursor.fetchall()
    finally:
        conn.close()

    if not rows:
        return []

    res = []
    for r in rows:
        res.append(
            ScenarioModel(
                id=r["id"],
                name=r["name"],
                description=r["description"] or "",
                documentName=r["document_id"] or "No document loaded",
                createdDate=r["created_date"] or datetime.datetime.now().strftime("%Y-%m-%d"),
                lastSimulation=r["last_simulation"] or "Never",
                status=r["status"] or "READY",
                agentCount=r["agent_count"] or 50,
                overallRiskScore=r["overall_risk_score"] or 50
            )
        )
    return res

@router.get("/{id}", response_model=ScenarioModel)
async def get_scenario(
    id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    user_id = current_user.get("id") if current_user else None
    scen_dict = verify_scenario_access(id, user_id)

    return ScenarioModel(
        id=scen_dict["id"],
        name=scen_dict["name"],
        description=scen_dict["description"] or "",
        documentName=scen_dict["document_id"] or "No document loaded",
        createdDate=scen_dict["created_date"] or datetime.datetime.now().strftime("%Y-%m-%d"),
        lastSimulation=scen_dict.get("last_simulation") or "Never",
        status=scen_dict.get("status") or "READY",
        agentCount=scen_dict.get("agent_count") or 50,
        overallRiskScore=scen_dict.get("overall_risk_score") or 50
    )

@router.get("/{id}/graph", response_model=ScenarioGraphResponse)
async def get_scenario_graph_endpoint(
    id: str,
    round: Optional[int] = Query(None),
    type: Optional[str] = Query(None),
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    if not id or id == "scen-01":
        return ScenarioGraphResponse(scenario_id="", nodes=[], edges=[])
    user_id = current_user.get("id") if current_user else None
    verify_scenario_access(id, user_id)
    if type in ["knowledge", "entities", "rag"]:
        return graph_service.get_raw_entity_graph(id, round_num=round)
    return graph_service.get_scenario_graph(id, round_num=round)

@router.get("/{id}/knowledge-graph", response_model=ScenarioGraphResponse)
async def get_scenario_knowledge_graph_endpoint(
    id: str,
    round: Optional[int] = Query(None),
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    if not id or id == "scen-01":
        return ScenarioGraphResponse(scenario_id="", nodes=[], edges=[])
    user_id = current_user.get("id") if current_user else None
    verify_scenario_access(id, user_id)
    return graph_service.get_raw_entity_graph(id, round_num=round)

@router.post("/{id}/extract")
async def extract_scenario_graph(
    id: str,
    document_id: Optional[str] = Query(None),
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    user_id = current_user.get("id") if current_user else None
    verify_scenario_access(id, user_id)
    doc_id = document_id or "doc-default"
    logger.info(f"[Scenarios API] Extracting scenario graph for scenario '{id}' using document '{doc_id}'")
    result = await orchestrator.run_scenario_pipeline(id, doc_id)
    return result

@router.post("/{id}/generate-personas")
async def generate_scenario_personas(
    id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    user_id = current_user.get("id") if current_user else None
    verify_scenario_access(id, user_id)
    logger.info(f"[Scenarios API] Generating 200 Heavy Agent personas for scenario '{id}'")
    personas = persona_service.generate_personas_for_scenario(id)
    return {"scenario_id": id, "generated_count": len(personas), "agents": personas[:5]}

@router.post("/{id}/simulate")
async def start_scenario_simulation(
    id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    user_id = current_user.get("id") if current_user else None
    verify_scenario_access(id, user_id)
    logger.info(f"[Scenarios API] Triggering simulation execution for scenario '{id}'")
    return {"scenario_id": id, "status": "RUNNING", "currentRound": 1, "totalRounds": 5}

class RunBaselineRequest(BaseModel):
    name: Optional[str] = "Strategic Scenario"
    description: Optional[str] = "Evaluate baseline strategy operational impact"
    goal_prompt: Optional[str] = "Evaluate baseline strategy operational impact"
    document_id: Optional[str] = "doc-default"
    is_what_if: Optional[bool] = False

@router.post("/run-baseline")
async def run_baseline_scenario(
    payload: RunBaselineRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    logger.info(f"[Scenarios API] Running baseline simulation: '{payload.name}'")
    scen_id = f"scen-{uuid.uuid4().hex[:6]}"
    created_date = datetime.datetime.now().strftime("%Y-%m-%d")
    title = (payload.name or "Strategic Scenario").strip()
    desc = payload.description or payload.goal_prompt or "Evaluate baseline strategy operational impact"
    doc_id = payload.document_id or "doc-default"
    user_id = current_user.get("id") if current_user else None

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO scenarios (id, name, description, document_id, created_date, last_simulation, status, agent_count, overall_risk_score, user_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (scen_id, title, desc, doc_id, created_date, "Never", "RUNNING_BASELINE", 200, 28, user_id)
        )
        conn.commit()
    finally:
        conn.close()

    async def execute_baseline_pipeline():
        try:
            await orchestrator.run_scenario_pipeline(
                scenario_id=scen_id,
                document_id=doc_id,
                scenario_title=title,
                description=desc
            )
            agents = persona_service.generate_personas_for_scenario(scen_id, total_agents=200)
            await oasis_engine.run_full_simulation(
                scenario_id=scen_id,
                agents=agents,
                goal_prompt=desc,
                shock_event="",
                risk_threshold=35.0,
                is_what_if=False
            )
        except Exception as err:
            logger.error(f"[Baseline Pipeline Error for {scen_id}]: {err}")

    asyncio.create_task(execute_baseline_pipeline())

    return {
        "scenario_id": scen_id,
        "id": scen_id,
        "name": title,
        "status": "RUNNING",
        "message": f"Baseline simulation for scenario {scen_id} dispatched."
    }

@router.post("/{id}/run-baseline")
async def run_baseline_scenario_by_id(
    id: str,
    payload: Optional[RunBaselineRequest] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    user_id = current_user.get("id") if current_user else None
    verify_scenario_access(id, user_id)
    logger.info(f"[Scenarios API] Triggering baseline simulation for existing scenario '{id}'")
    goal = payload.goal_prompt if payload and payload.goal_prompt else "Evaluate baseline strategy operational impact"
    
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE scenarios SET status = 'RUNNING_BASELINE' WHERE id = ?", (id,))
        conn.commit()
    finally:
        conn.close()

    async def execute_existing_baseline():
        try:
            agents = persona_service.generate_personas_for_scenario(id, total_agents=200)
            await oasis_engine.run_full_simulation(
                scenario_id=id,
                agents=agents,
                goal_prompt=goal,
                shock_event="",
                risk_threshold=35.0,
                is_what_if=False
            )
        except Exception as err:
            logger.error(f"[Baseline Existing Error for {id}]: {err}")

    asyncio.create_task(execute_existing_baseline())
    return {"scenario_id": id, "status": "RUNNING"}

class RunWhatIfRequest(BaseModel):
    goal_prompt: str
    shock_event: Optional[str] = None
    risk_threshold: Optional[float] = 35.0

@router.post("/{id}/run-what-if")
async def run_what_if_simulation(
    id: str,
    payload: RunWhatIfRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    user_id = current_user.get("id") if current_user else None
    verify_scenario_access(id, user_id)
    logger.info(f"[Scenarios API] Running Phase B What-If re-simulation for '{id}' with prompt: '{payload.goal_prompt}'")
    goal = payload.goal_prompt
    shock = payload.shock_event or f"CRITICAL SHOCK: Unannounced strategic shock & operational friction for '{goal[:40]}'."

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM feed_events WHERE scenario_id = ?", (id,))
        cursor.execute("DELETE FROM oasis_simulation_steps WHERE scenario_id = ?", (id,))
        cursor.execute("DELETE FROM reports WHERE scenario_id = ?", (id,))
        cursor.execute("UPDATE scenarios SET status = 'RUNNING_WHAT_IF' WHERE id = ?", (id,))
        conn.commit()
    finally:
        conn.close()

    async def execute_what_if():
        try:
            agents = persona_service.generate_personas_for_scenario(id, total_agents=200)
            await oasis_engine.run_full_simulation(
                scenario_id=id,
                agents=agents,
                goal_prompt=goal,
                shock_event=shock,
                risk_threshold=payload.risk_threshold or 35.0,
                is_what_if=True
            )
        except Exception as err:
            logger.error(f"[What-If Error for {id}]: {err}")

    asyncio.create_task(execute_what_if())
    return {"scenario_id": id, "status": "RUNNING_WHAT_IF", "shock_event": shock}

@router.delete("/{id}")
async def delete_scenario(
    id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    user_id = current_user.get("id") if current_user else None
    verify_scenario_access(id, user_id)

    logger.info(f"[Scenarios API] Deleting scenario: {id}")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT document_id FROM scenarios WHERE id = ?", (id,))
        scen_row = cursor.fetchone()
        doc_id = scen_row["document_id"] if scen_row else None

        cursor.execute("DELETE FROM feed_events WHERE scenario_id = ?", (id,))
        cursor.execute("DELETE FROM oasis_simulation_steps WHERE scenario_id = ? OR id LIKE ? OR agent_id LIKE ?", (id, f"%{id}%", f"%{id}%"))
        cursor.execute("DELETE FROM oasis_agent_trajectories WHERE agent_id LIKE ?", (f"%{id}%",))
        cursor.execute("DELETE FROM scenario_reports WHERE scenario_id = ?", (id,))
        cursor.execute("DELETE FROM risks WHERE scenario_id = ?", (id,))
        cursor.execute("DELETE FROM reports WHERE scenario_id = ?", (id,))
        cursor.execute("DELETE FROM graph_nodes WHERE scenario_id = ?", (id,))
        cursor.execute("DELETE FROM graph_edges WHERE scenario_id = ?", (id,))
        cursor.execute("DELETE FROM agents WHERE scenario_id = ?", (id,))
        cursor.execute("DELETE FROM agent_actions WHERE scenario_id = ?", (id,))
        cursor.execute("DELETE FROM simulation_rounds WHERE scenario_id = ?", (id,))
        cursor.execute("DELETE FROM scenarios WHERE id = ?", (id,))

        if doc_id and doc_id != "doc-default":
            cursor.execute("DELETE FROM document_chunks WHERE document_id = ? OR document_id IN (SELECT id FROM documents WHERE filename = ?)", (doc_id, doc_id))
            cursor.execute("DELETE FROM documents WHERE id = ? OR filename = ?", (doc_id, doc_id))
            for upload_dir in ["uploads", "backend/uploads"]:
                if os.path.exists(upload_dir):
                    for cand in [doc_id, os.path.basename(doc_id)]:
                        cand_path = os.path.join(upload_dir, cand)
                        if os.path.exists(cand_path) and os.path.isfile(cand_path):
                            try:
                                os.remove(cand_path)
                            except Exception:
                                pass

        conn.commit()
        logger.info(f"[Scenarios API] Scenario {id} and all dependent records hard deleted successfully.")
    except Exception as err:
        conn.rollback()
        logger.error(f"[Scenarios API] Error during scenario deletion: {err}")
        raise HTTPException(status_code=500, detail=f"Database cascade delete failed: {err}")
    finally:
        conn.close()

    return {"status": "deleted", "scenario_id": id, "success": True}
