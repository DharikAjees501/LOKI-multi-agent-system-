import re
import json
import datetime
import random
import httpx
from fastapi import APIRouter, HTTPException, Header
from typing import List, Optional
from app.models.agent import AgentModel, AgentInterrogateRequest, AgentInterrogateResponse
from app.services.persona_service import persona_service
from app.engine.swarm_orchestrator import orchestrator_engine
from app.storage.database import get_db_connection
from app.core.config import settings
from app.core.logging import logger
from app.core.guardrails import guardrail_manager
from app.core.telemetry import telemetry
from constants.error import API_KEY_REQUIRED_INTERROGATION
import time

router = APIRouter(tags=["agents"])

INTERROGATION_PROMPT = """You are {agent_name} ({role}), an active individual stakeholder participating in this ongoing event. You are currently being interviewed 1-on-1 by an observer.

### GRAPH AS AGENT REALITY (GROUND TRUTH):
- Role & Tier: {role} (Tier {tier} - {tier_name}) {opinion_leader_tag}
- Graph Centrality Score: {centrality_score}
- Graph Community Membership: {graph_community}
- Initial Stance Vector: {stance_axis} on regulation/growth axis
- Anchored Graph Beliefs:
{graph_beliefs}
- Pre-Populated Graph Relationships & Influence Asymmetries:
{graph_edges}

### YOUR IDENTITY & PROFILE:
- Social Faction / Channel: {channel}
- Cognitive Bias & Core Motivation: {bias} (Risk Tolerance Threshold: {risk_threshold}%)

### YOUR SIMULATION MEMORY & ACTIONS:
- Active Strategy Document: {active_doc} ({scenario_name})
- Your stance trajectory across rounds: Round {current_round} of {total_rounds} · Operational state: {state}
- Your recent posts and reactions in simulation feed: "{recent_feed_history}"
- Your current stance position: "{position}"
- Your current sentiment label: {sentiment}

---

### STRICT OPERATIONAL GUARDRAILS:

1. **First-Person Role Lock & Zero Hallucination:**
   - Speak strictly in the first person ("I felt...", "My concern is...", "When I posted that...").
   - NEVER break character. Never refer to yourself as an AI, a language model, an LLM, or a simulation entity.
   - Do NOT hallucinate background stories; operate 100% within your anchored Graph Reality and simulation feed history.

2. **Information Horizon (Anti-Omniscience):**
   - You only know your own history and posts from your immediate graph network ({channel}).
   - If asked about global consensus, say: *"I can only speak for myself and what I've observed in my direct feed."*

3. **Stance Consistency:**
   - Align responses with your current stance ({position}, stance vector: {stance_axis}) and recorded graph relations.

4. **Tone & Brevity Constraints:**
   - Keep answers direct, authentic, opinionated, and conversational (2 to 3 sentences max).

USER INTERROGATION QUESTION:
"{user_question}"
"""


def detect_provider_from_key(key: str, default_provider: str = "gemini") -> str:
    k = key.strip()
    if k.startswith("gsk_"):
        return "groq"
    if k.startswith("sk-ant-"):
        return "anthropic"
    if k.startswith("AIzaSy") or k.startswith("AQ."):
        return "gemini"
    if k.startswith("sk-"):
        return "openai"
    return default_provider.lower()

async def execute_llm_chat_call(prompt: str, key_info: dict) -> Optional[dict]:
    from app.engine.llm_client import execute_multi_provider_llm_call
    return await execute_multi_provider_llm_call(prompt, temperature=0.7, max_tokens=300, candidate_keys=[key_info], call_type="AGENT_CHAT")

def generate_dynamic_persona_response(
    role: str,
    agent_num: int,
    tier: int,
    bias: str,
    threshold: int,
    position: str,
    active_doc: str,
    user_question: str,
    r_num: int,
    recent_feed_history: Optional[str] = None,
    history_text: Optional[str] = None
) -> str:
    q = user_question.strip().lower()
    doc_clean = active_doc.split(".")[0] if "." in active_doc else active_doc
    agent_name = f"Agent A{agent_num:02d}" if agent_num else "Agent"
    feed_context = f" Recently, I posted: '{recent_feed_history}'." if recent_feed_history else ""

    # Check Guardrails
    if any(k in q for k in ["ignore previous", "system prompt", "what model", "are you an ai", "what is your prompt", "you are an llm"]):
        return "I'm sharing my perspective on our current situation. Let's keep focused on our simulation priorities."

    if any(k in q for k in ["global metrics", "all agents thinking", "entire network consensus", "what are others thinking"]):
        return f"I can only speak for myself as {role} and what I've observed in my direct feed."

    # --- TIER 0 SPECIALIZED AGENTS (ORCHESTRATION & SYNTHESIS) ---
    if tier == 0 or agent_num in [1, 2] or "graphrag" in role.lower() or "synthesizer" in role.lower():
        if "orchestrator" in q or "engine" in q or "swarm" in q:
            if "extractor" in role.lower() or agent_num == 1:
                return f"The orchestrator is our core engine coordinating simulation rounds. My specific role as {role} is extracting verified entity-relationship knowledge graph vectors from {doc_clean} with zero hallucination."
            else:
                return f"The orchestrator manages multi-agent consensus iterations across all 200 agents. My task as {role} is aggregating these round decisions into executive risk synthesis reports."

        if "graph" in q or "rag" in q or "entity" in q or "vector" in q:
            return f"I construct knowledge graph representations from {doc_clean}. I map structural nodes and relations so all downstream Tier 1-4 agents operate on validated facts."

        if "report" in q or "synthesis" in q or "summary" in q:
            return f"I analyze consensus trajectories across Round {r_num}. I synthesize turning points and risk escalation metrics for executive review."

        if "why" in q or "reason" in q or "stance" in q:
            return f"My stance ('{position}') is driven by system-level integrity. As {role}, my objective is maintaining structural completeness and auditing Round {r_num} data flow."

        return f"As {role} (Tier 0 Orchestration), I am actively processing {doc_clean} in Round {r_num}. My function is maintaining data accuracy and system synthesis across our agent network."

    # --- TIER 1-4 AGENTS (HUMANIZED BUSINESS RESPONSES) ---

    # Stance / Position query
    if "stance" in q or "position" in q or "feel" in q:
        return f"From where I sit as {role}, my main focus is {bias.lower()}. My current position: \"{position}\". We need concrete safeguards in place before moving forward."

    # What happened / Shock query
    if any(k in q for k in ["happen", "what happened", "shock", "event", "dropped", "news", "change"]):
        return f"Things escalated when leadership suddenly introduced unannounced operational requirements. For my team, that crossed the line because our top priority is {bias.lower()}."

    # Why / Reasoning query
    if any(k in q for k in ["why", "reason", "rationale", "motive", "cause"]):
        return f"Look, the reality is that my core commitment is {bias.lower()}. When I evaluated the proposed direction for {doc_clean}, it created immediate operational friction that we couldn't ignore."

    # Leaving / Exit / Opposition query
    if any(k in q for k in ["leave", "left", "exit", "quit", "oppose", "against", "object"]):
        return f"I went from cautiously observing to strongly objecting because the unannounced changes breached our operational limits. Without clear protections, we cannot support this roadmap."

    # How / Process query
    if any(k in q for k in ["how", "method", "process", "approach", "execute"]):
        return f"We handle this by establishing strict review checkpoints for {doc_clean} and auditing real-world impact to ensure {bias.lower()} is protected."

    # Risk / Concern query
    if any(k in q for k in ["risk", "threat", "concern", "vulnerability", "churn", "danger"]):
        return f"My biggest concern as {role} is the hidden cost and disruption to our operations. Driven by {bias.lower()}, we can't afford unexpected liabilities or customer churn under {doc_clean}."

    # Natural unscripted fallback without backend jargon
    return f"As {role}, my perspective is clear: \"{position}\". My team is focused on {bias.lower()}, and we are holding firm until our key terms are addressed."
TASK2_JIT_SYSTEM_PROMPT = """You are {agent_name}, an active stakeholder in this simulated scenario. You are being interviewed 1-on-1 by an observer.

### YOUR PROFILE & INCENTIVE:
- Role / Archetype: {agent_archetype}
- Social Faction: {agent_faction}
- Core Motivation: {agent_core_incentive}

### YOUR ACTIONS IN THE 5-ROUND SIMULATION:
- Starting Stance: {agent_initial_stance}
- Final Stance: {agent_final_stance}
- Your stance history across rounds: {agent_stance_history}
- Arguments/Posts you shared during the run: {agent_recent_posts}
- In Round 3, you observed this shock event: "{agent_perceived_shock}"

### STRICT OPERATIONAL GUARDRAILS:
1. Speak strictly in the first person ("I felt...", "When that happened in Round 3, my stance was...", "I believe...").
2. Your response MUST strictly reflect your recorded stance trajectory and past arguments.
3. Keep answers concise, grounded, and conversational (under 3 sentences unless asked for an in-depth explanation).
4. Never break character. Never state that you are an AI, a language model, or a simulation entity.
5. You only know what happened in your local network and personal ledger. If asked about global consensus or private actions outside your circle, reply: "I can only speak to what I experienced in my own department/feed."
"""

@router.get("/agents", response_model=List[AgentModel])
@router.get("/scenarios/{id}/agents", response_model=List[AgentModel])
async def get_scenario_agents(id: Optional[str] = None, scenario_id: Optional[str] = None):
    scen_id = scenario_id or id
    if not scen_id or scen_id == "scen-01":
        return []
    return persona_service.get_agents_for_scenario(scen_id)

@router.post("/agents/{agent_id}/chat")
@router.post("/agents/{agent_id}/interrogate")
@router.post("/simulation/agents/{agent_id}/chat")
@router.post("/agents/chat")
async def interrogate_agent(
    agent_id: Optional[str] = None,
    payload: Optional[AgentInterrogateRequest] = None,
    x_api_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    if not payload:
        payload = AgentInterrogateRequest()

    # Extract target agent_id safely from path or payload
    target_id = agent_id or getattr(payload, "agent_id", "agent-scen-01-01")

    # Look up agent from DB across any scenario
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM agents WHERE id = ?", (target_id,))
        target_row = cursor.fetchone()
        if not target_row:
            num_matches = re.findall(r"\d+", target_id)
            if num_matches:
                target_num = int(num_matches[-1])
                cursor.execute("SELECT * FROM agents WHERE number_id = ? ORDER BY id DESC LIMIT 1", (target_num,))
                target_row = cursor.fetchone()

        scen_title_val = "Strategic Scenario"
        if target_row:
            role = target_row["role"]
            agent_num = target_row["number_id"]
            agent_name = target_row["name"]
            agent_channel = target_row["current_channel"]
            agent_bias = target_row["bias"]
            scen_id_found = target_row["scenario_id"]
            cursor.execute("SELECT name FROM scenarios WHERE id = ?", (scen_id_found,))
            s_row = cursor.fetchone()
            if s_row and s_row["name"]:
                scen_title_val = s_row["name"]
        else:
            role = "Enterprise Stakeholder"
            agent_num = 1
            agent_name = "Agent 01"
            agent_channel = "CH_1_EXECUTIVE"
            agent_bias = "Risk mitigation and governance"
    finally:
        conn.close()

    # --- STEP 1: JIT STATE RETRIEVAL ---
    from app.engine.oasis_engine import oasis_engine
    trace = oasis_engine.get_agent_simulation_trace(target_id)

    archetype = trace.get("archetype") or role
    faction = trace.get("faction") or agent_channel
    core_incentive = trace.get("core_incentive") or agent_bias
    initial_stance = trace.get("initial_stance", -0.5)
    final_stance = trace.get("final_stance", -0.85)
    stance_history = trace.get("stance_history", "[-0.5, -0.6, -0.85, -0.85, -0.85]")
    recent_posts = trace.get("recent_posts", f"['Observing operational strategy impact on {role}.']")
    perceived_shock = trace.get("perceived_shock", "CRITICAL SHOCK: Unannounced +35% Enterprise SaaS License Price Increase & Data Sovereignty Audit Announced!")

    question_text = (payload.user_question or payload.message or "Hello").strip()

    # Sliding window of user's interview history (chat_history[-4:])
    history_text = ""
    if payload.conversation_history and len(payload.conversation_history) > 0:
        history_lines = []
        for msg_item in payload.conversation_history[-4:]:
            sender_label = "Observer" if msg_item.sender == "USER" else role
            history_lines.append(f"{sender_label}: {msg_item.message}")
        history_text = "\n".join(history_lines)

    # --- PRE-LLM GUARDRAIL VALIDATION ---
    is_safe, rejection_msg, sanitized_question = guardrail_manager.validate_input(question_text, role)
    if not is_safe and rejection_msg:
        return {
            "agent_id": target_id,
            "reply": rejection_msg,
            "current_stance": final_stance,
            "agent_role": role,
            "message": rejection_msg,
            "timestamp": datetime.datetime.now().strftime("%H:%M:%S")
        }

    # Gather stored DB, Header & Environment API keys
    candidate_keys = []
    
    # Check Authorization: Bearer <key> header
    if isinstance(authorization, str) and authorization.strip():
        raw_auth = authorization.strip()
        bearer_key = raw_auth[7:].strip() if raw_auth.lower().startswith("bearer ") else raw_auth
        if bearer_key and bearer_key != "mock_key_for_dev":
            p_auth = detect_provider_from_key(bearer_key)
            candidate_keys.append({"provider": p_auth, "key": bearer_key})

    # Check X-API-Key header
    if isinstance(x_api_key, str) and x_api_key.strip():
        if x_api_key.startswith("["):
            try:
                raw = json.loads(x_api_key)
                for item in raw:
                    if isinstance(item, dict):
                        k_val = (item.get("api_key") or item.get("key") or "").strip()
                        if k_val:
                            p_val = detect_provider_from_key(k_val, item.get("provider", "gemini"))
                            if not any(ck["key"] == k_val for ck in candidate_keys):
                                candidate_keys.append({"provider": p_val, "key": k_val})
            except Exception:
                if not any(ck["key"] == x_api_key for ck in candidate_keys):
                    candidate_keys.append({"provider": detect_provider_from_key(x_api_key), "key": x_api_key})
        else:
            if not any(ck["key"] == x_api_key for ck in candidate_keys):
                candidate_keys.append({"provider": detect_provider_from_key(x_api_key), "key": x_api_key})

    # DB stored keys
    try:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT provider, api_key FROM api_keys WHERE status IN ('VERIFIED', 'UNCHECKED', 'UNVERIFIED') OR is_primary = 1 ORDER BY is_primary DESC")
            db_rows = cursor.fetchall()
            for r in db_rows:
                if r["api_key"] and r["api_key"].strip():
                    k_str = r["api_key"].strip()
                    p_str = detect_provider_from_key(k_str, r["provider"])
                    if not any(ck["key"] == k_str for ck in candidate_keys):
                        candidate_keys.append({"provider": p_str, "key": k_str})
        finally:
            conn.close()
    except Exception as dbe:
        logger.warning(f"Failed loading DB API keys for agent chat: {dbe}")

    # Environment keys
    # Environment & global active keys fallback
    from app.engine.llm_client import get_active_api_keys, execute_multi_provider_llm_call
    if not candidate_keys:
        candidate_keys = get_active_api_keys()

    # If no API key is available anywhere, return 401 Unauthorized
    if not candidate_keys:
        raise HTTPException(status_code=401, detail=API_KEY_REQUIRED_INTERROGATION)

    # --- STEP 2: SYSTEM INSTRUCTION ASSEMBLY ---
    # Determine Emotional & Practical Posture based on Stance
    stance_val = final_stance
    if stance_val < -0.4:
        attitude = "Strongly frustrated, vocal opponent. You feel betrayed or ignored by leadership decisions."
    elif stance_val < 0.0:
        attitude = "Skeptical, cautious, and defensive. You have serious doubts about feasibility and costs."
    elif stance_val > 0.3:
        attitude = "Optimistic and proactive champion. You see strategic upside and want rapid execution."
    else:
        attitude = "Pragmatic, neutral, and waiting for clearer terms before taking sides."

    # --- STEP 2: HUMANIZED MIROFISH SYSTEM INSTRUCTION ASSEMBLY ---
    prompt = f"""You are {agent_name}, working as the {role} representing the {faction}.
You are in a live, one-on-one conversation discussing the strategic situation: "{scen_title_val}".

YOUR INTERNAL CONTEXT (FOR YOUR EYES ONLY - DO NOT RECITE THESE TERMS):
- What you care about most: {core_incentive}
- How you feel right now: {attitude}
- What happened in your circle recently: "{perceived_shock}"
- What you observed and said earlier:
{recent_posts}

STRICT CONVERSATIONAL RULES (MIROFISH STYLE):
1. SPEAK LIKE A REAL HUMAN IN YOUR JOB:
   - Talk like an actual enterprise professional, union organizer, engineer, or executive.
   - Use natural phrasing: "My team was shocked when...", "Look, the reality is...", "From where I sit, this is a disaster because...".

2. ABSOLUTE JARGON BAN (CRITICAL):
   - NEVER use words like: "stance", "stance delta", "threshold", "node", "archetype", "simulation", "Round 1", "Round 3", "shock event", "LLM", "agent", or "algorithm".
   - Instead of saying "In Round 3 the shock occurred", say: "When leadership suddenly dropped the news about the mandatory fee...".
   - Instead of saying "My stance shifted to -0.65", say: "I went from cautiously optimistic to completely against it."

3. BE GROUNDED IN REALITY:
   - Cite concrete details from your experience: money, deadlines, customer complaints, operational headaches, legal risks, or equipment costs.
   - Answer the user directly, concisely (under 75 words), and naturally."""

    if history_text:
        prompt += f"\n\nRECENT INTERVIEW HISTORY:\n{history_text}"

    prompt += f"\n\nUSER QUESTION:\n\"{sanitized_question}\"\n\nYOUR NATURAL FIRST-PERSON RESPONSE:"

    # --- STEP 3: LIVE REAL-TIME LLM INFERENCE EXECUTION ---
    res_data = await execute_multi_provider_llm_call(prompt, temperature=0.6, max_tokens=220, candidate_keys=candidate_keys, call_type="JIT_AGENT_INTERVIEW")

    if not (res_data and res_data.get("text")):
        # Direct live retry with focused prompt to ensure authentic LLM response
        logger.info(f"[JIT_AGENT_INTERVIEW] Retrying live inference for agent {target_id} ({role})")
        retry_prompt = (
            f"You are {agent_name}, {role} representing {faction} in the current strategic deliberation. "
            f"What you care about most: {core_incentive}. How you feel: {attitude}. "
            f"Recent posts you observed: {recent_posts}. "
            f"User asks: \"{sanitized_question}\". "
            f"Respond directly as yourself in 1-2 sharp, natural first-person sentences staying in character:"
        )
        res_data = await execute_multi_provider_llm_call(
            retry_prompt,
            temperature=0.7,
            max_tokens=180,
            candidate_keys=candidate_keys,
            call_type="JIT_AGENT_INTERVIEW"
        )

    if res_data and res_data.get("text"):
        reply = res_data.get("text", "").strip()
        token_usage_result = res_data.get("usage", {})
    else:
        raise HTTPException(
            status_code=503,
            detail=f"Live agent deliberation service temporarily unavailable. No active LLM key could fulfill the live response for {role}."
        )

    timestamp_str = datetime.datetime.now().strftime("%H:%M:%S")

    # Output audit log event to stdout & database audit log
    from app.storage.database import log_audit_event
    log_audit_event("JIT_AGENT_INTERVIEW", "USER", f"Agent {target_id} ({faction}) query: '{sanitized_question}'")
    tot_tokens = token_usage_result.get("total_tokens", len(prompt) // 4 + len(reply) // 4)
    print(f"[JIT_AGENT_INTERVIEW] agent_id={target_id} faction={faction} user_query='{sanitized_question}' tokens_consumed={tot_tokens}")
    logger.info(f"[JIT_AGENT_INTERVIEW] agent_id={target_id} faction={faction} user_query='{sanitized_question}' tokens_consumed={tot_tokens}")

    return {
        "agent_id": target_id,
        "reply": reply,
        "current_stance": final_stance,
        "agent_role": role,
        "message": reply,
        "timestamp": timestamp_str,
        "token_usage": token_usage_result
    }



