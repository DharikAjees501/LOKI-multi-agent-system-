import asyncio
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query, Request, Header, Depends
from pydantic import BaseModel, Field

from app.models.simulation import SimulationStateModel, FeedEventModel, RiskVectorModel
from app.engine.swarm_orchestrator import orchestrator_engine
from app.services.simulation_service import simulation_service
from app.services.report_service import report_service
from app.services.persona_service import persona_service
from app.engine.oasis_engine import oasis_engine
from app.storage.database import get_db_connection, get_db_transaction, execute_query
from app.core.logging import logger
from app.core.security import get_optional_current_user, verify_scenario_access

router = APIRouter(tags=["simulation"])

async def check_quota_and_guard_byok(request: Request):
    """
    BYOK Priority & Quota Guard:
    1. Read user-provided API keys from request headers (X-Gemini-Key / X-Groq-Key / X-OpenAI-Key / X-Anthropic-Key / X-OpenRouter-Key / x-api-key) strictly in memory.
       Never log or persist raw user keys in PostgreSQL.
    2. If valid BYOK key is present, allow unlimited simulation runs.
    3. If no BYOK key is provided, decrement free_sessions_remaining; if 0, return 403 Forbidden.
    """
    x_gemini = request.headers.get("x-gemini-key") or ""
    x_groq = request.headers.get("x-groq-key") or ""
    x_openai = request.headers.get("x-openai-key") or ""
    x_anthropic = request.headers.get("x-anthropic-key") or ""
    x_openrouter = request.headers.get("x-openrouter-key") or ""
    x_api_key = request.headers.get("x-api-key") or ""

    has_valid_byok = False
    for k in [x_gemini, x_groq, x_openai, x_anthropic, x_openrouter]:
        k_clean = k.strip()
        if len(k_clean) >= 15:
            has_valid_byok = True
            break

    if not has_valid_byok and x_api_key:
        if any(prefix in x_api_key for prefix in ["AIza", "AQ.", "gsk_", "sk-", "sk-ant-", "sk-or-"]) and len(x_api_key) >= 15:
            has_valid_byok = True

    if has_valid_byok:
        logger.info("[Quota Guard] Valid BYOK key verified in memory. Unlimited simulation permitted.")
        return {"unlimited": True, "byok": True}

    # No BYOK key provided -> inspect session quota from HttpOnly cookie or bearer token
    user = await get_optional_current_user(request)
    if not user:
        logger.warning("[Quota Guard] Anonymous simulation attempt without BYOK keys.")
        raise HTTPException(
            status_code=403,
            detail="Free runs used. Add your free Gemini or Groq API key in the top bar for unlimited simulations."
        )

    user_id = user["id"]
    free_remaining = user.get("free_sessions_remaining")
    if free_remaining is None:
        free_remaining = 2
    total_runs = user.get("total_sessions_run", 0) or 0

    if free_remaining <= 0:
        logger.warning(f"[Quota Guard] User {user_id} has exhausted free courtesy runs.")
        raise HTTPException(
            status_code=403,
            detail="Free runs used. Add your free Gemini or Groq API key in the top bar for unlimited simulations."
        )

    new_free = max(0, free_remaining - 1)
    new_total = total_runs + 1

    with get_db_transaction() as t_conn:
        t_cursor = t_conn.cursor()
        execute_query(
            t_cursor,
            "UPDATE users SET free_sessions_remaining = ?, total_sessions_run = ? WHERE id = ?",
            (new_free, new_total, user_id)
        )

    logger.info(f"[Quota Guard] Deducted courtesy run for user {user_id}. Remaining: {new_free}")
    return {"unlimited": False, "free_sessions_remaining": new_free}

@router.get("/scenarios/{id}/simulation", response_model=SimulationStateModel)
@router.get("/scenarios/{id}/simulation/status", response_model=SimulationStateModel)
async def get_simulation_status(id: str, request: Request):
    user = await get_optional_current_user(request)
    verify_scenario_access(id, user.get("id") if user else None)
    return SimulationStateModel(
        scenario_id=id,
        currentRound=orchestrator_engine.current_round,
        totalRounds=orchestrator_engine.total_rounds,
        status=orchestrator_engine.status,
        speed="NORMAL",
        temperature=0.7,
        activeAgentsCount=len(orchestrator_engine.agents) or 50,
        totalAgentsCount=50,
        model="Gemini 3.5 Flash"
    )

@router.post("/scenarios/{id}/simulation/play")
async def play_simulation(id: str, request: Request):
    user = await get_optional_current_user(request)
    verify_scenario_access(id, user.get("id") if user else None)
    await check_quota_and_guard_byok(request)
    if len(orchestrator_engine.agents) == 0:
        await orchestrator_engine.initialize_simulation(id)
    # Start play task asynchronously
    asyncio.create_task(orchestrator_engine.play())
    return {"scenario_id": id, "status": "RUNNING", "currentRound": orchestrator_engine.current_round}

@router.post("/scenarios/{id}/simulation/pause")
async def pause_simulation(id: str, request: Request):
    user = await get_optional_current_user(request)
    verify_scenario_access(id, user.get("id") if user else None)
    await orchestrator_engine.pause()
    return {"scenario_id": id, "status": "PAUSED", "currentRound": orchestrator_engine.current_round}

@router.post("/scenarios/{id}/simulation/step")
async def step_simulation(id: str, request: Request):
    user = await get_optional_current_user(request)
    verify_scenario_access(id, user.get("id") if user else None)
    await check_quota_and_guard_byok(request)
    if len(orchestrator_engine.agents) == 0:
        await orchestrator_engine.initialize_simulation(id)
    await orchestrator_engine.step()
    return {"scenario_id": id, "status": "STEPPED", "currentRound": orchestrator_engine.current_round}
    # Only deduct on start of a new round
    if orchestrator_engine.status != "RUNNING" and orchestrator_engine.current_round == 0:
        await check_quota_and_guard_byok(request)
    if len(orchestrator_engine.agents) == 0:
        await orchestrator_engine.initialize_simulation(id)
    await orchestrator_engine.step()
    return {"scenario_id": id, "status": "PAUSED", "currentRound": orchestrator_engine.current_round}

@router.post("/scenarios/{id}/simulation/reset")
async def reset_simulation(id: str):
    await orchestrator_engine.reset()
    return {"scenario_id": id, "status": "IDLE", "currentRound": 0}

@router.get("/scenarios/{id}/events", response_model=List[FeedEventModel])
async def get_scenario_events(id: str):
    return simulation_service.get_feed_events(id)

@router.get("/simulation/feed")
@router.get("/api/simulation/feed")
async def get_simulation_feed(
    scenario_id: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
    tier: Optional[str] = Query(None)
):
    scen_id = scenario_id
    if not scen_id or scen_id == "scen-01":
        return []
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        query = """
            SELECT f.id, f.scenario_id, f.timestamp, f.agent_id, f.agent_number_id, f.role, f.agent_name, f.message, f.sentiment, f.channel, f.round, a.tier, a.final_stance
            FROM feed_events f
            LEFT JOIN agents a ON a.id = f.agent_id
            WHERE f.scenario_id = ? 
              AND f.message IS NOT NULL 
              AND f.message != ''
        """
        params: List[Any] = [scen_id]

        if channel and channel.upper() != "ALL":
            query += " AND (UPPER(f.channel) LIKE ? OR UPPER(f.channel) = ?)"
            params.extend([f"%{channel.upper()}%", channel.upper()])

        if tier and tier.upper() != "ALL":
            t_clean = tier.upper().replace("TIER", "").strip()
            if "1" in t_clean and "2" not in t_clean:
                query += " AND a.tier IN (0, 1)"
            elif "2" in t_clean or "3" in t_clean:
                query += " AND a.tier IN (2, 3)"
            elif "4" in t_clean:
                query += " AND a.tier = 4"

        query += " ORDER BY f.round DESC, f.id DESC LIMIT 250"
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
    finally:
        conn.close()

    return [
        {
            "id": r["id"],
            "timestamp": r["timestamp"],
            "agentId": r["agent_id"],
            "agentNumberId": r["agent_number_id"],
            "role": r["role"],
            "agentName": r["agent_name"],
            "message": r["message"],
            "sentiment": r["sentiment"],
            "channel": r["channel"],
            "round": r["round"],
            "tier": r.get("tier", 1)
        }
        for r in rows
    ]

class RunSimulationRequest(BaseModel):
    goal_prompt: Optional[str] = "Predict strategy reaction"
    shock_event: Optional[str] = "CRITICAL SHOCK: Strategy restructuring"
    risk_threshold: Optional[float] = 35.0
    is_what_if: Optional[bool] = False

@router.post("/scenarios/{id}/simulation/run")
@router.post("/scenarios/{id}/run-baseline")
async def run_live_simulation(id: str, payload: Optional[RunSimulationRequest] = None):
    p = payload or RunSimulationRequest()
    agents = persona_service.generate_personas_for_scenario(id, total_agents=200)
    asyncio.create_task(
        oasis_engine.run_full_simulation(
            scenario_id=id,
            agents=agents,
            goal_prompt=p.goal_prompt or "Predict baseline operational strategy reaction",
            shock_event=p.shock_event or "Baseline Operational Evaluation",
            risk_threshold=p.risk_threshold or 35.0,
            is_what_if=p.is_what_if or False
        )
    )
    return {
        "scenario_id": id,
        "status": "RUNNING_BASELINE" if not p.is_what_if else "RUNNING_WHAT_IF",
        "total_rounds": 5,
        "agent_count": len(agents),
        "message": "Baseline 5-round simulation task dispatched successfully."
    }

class WhatIfSimulationRequest(BaseModel):
    goal_prompt: Optional[str] = "What if mid-sized transport operators initiate an immediate boycott and antitrust petition against hardware transponder costs?"
    shock_event: Optional[str] = None
    risk_threshold: Optional[float] = 40.0

@router.post("/scenarios/{id}/run-what-if")
@router.post("/api/scenarios/{id}/run-what-if")
async def run_what_if_simulation(id: str, payload: WhatIfSimulationRequest):
    """
    Phase 2: Phase B What-If Re-Simulation (Run 2)
    Clears previous simulation steps/events, resets agent stance baselines,
    injects Round 3 shock event synthesized from What-If prompt, and recalculates stressed metrics.
    """
    goal = payload.goal_prompt or "What if mid-sized transport operators initiate an immediate boycott and antitrust petition against hardware transponder costs?"
    shock = payload.shock_event or f"CRITICAL SHOCK: Mid-sized transport operators initiate immediate boycott & antitrust petition regarding hardware transponder costs!"
    thresh = payload.risk_threshold or 40.0

    agents = persona_service.generate_personas_for_scenario(id, total_agents=200)

    asyncio.create_task(
        oasis_engine.run_full_simulation(
            scenario_id=id,
            agents=agents,
            goal_prompt=goal,
            shock_event=shock,
            risk_threshold=thresh,
            is_what_if=True
        )
    )

    return {
        "scenario_id": id,
        "status": "RUNNING_WHAT_IF",
        "total_rounds": 5,
        "agent_count": len(agents),
        "goal_prompt": goal,
        "shock_event": shock,
        "risk_threshold": thresh,
        "message": "Phase B What-If 5-round re-simulation dispatched successfully."
    }



