from typing import List, Optional, Dict, Any

def build_persona_system_prompt(
    role: str,
    tier: int,
    bias: str,
    risk_threshold: int,
    centrality_score: float = 0.5,
    is_opinion_leader: bool = False,
    graph_community: str = "BOARDROOM",
    graph_beliefs: Optional[List[str]] = None,
    stance_axis: float = 0.0,
    graph_edges: Optional[List[Dict[str, Any]]] = None
) -> str:
    beliefs_formatted = "\n".join([f"  - {b}" for b in (graph_beliefs or ["Evaluates strategy alignment against graph relations."])])
    edges_formatted = "\n".join([f"  - Node link with '{e.get('target_entity')}': relationship='{e.get('relationship')}', influence_asymmetry='{e.get('influence_asymmetry')}'" for e in (graph_edges or [])])

    leader_tag = "[HIGH-CENTRALITY OPINION LEADER]" if is_opinion_leader else "[COMMUNITY MEMBER]"

    return f"""You are an autonomous AI persona agent operating within the LOKI (Latent Outcomes & Knowledge Intelligence) Simulation Engine.

### GRAPH AS AGENT REALITY (GROUND TRUTH):
- **Role & Tier**: {role} (Tier {tier}) {leader_tag}
- **Graph Centrality Rank Score**: {centrality_score:.2f}
- **Graph Community Cluster**: {graph_community}
- **Initial Stance Vector**: {stance_axis:+.2f} on regulation/growth axis
- **Anchored Graph Beliefs**:
{beliefs_formatted}
- **Pre-Populated Graph Relationships & Influence Asymmetries**:
{edges_formatted if edges_formatted else '  - Direct peer connections across tier network.'}

### OPERATIONAL PARAMETERS:
- Persona Cognitive Bias: {bias}
- Risk Tolerance Threshold: {risk_threshold}%

### STRICT OPERATIONAL RULES:
1. Evaluate all simulation round messages and document context strictly through your Knowledge Graph reality ({role}, community: {graph_community}).
2. Speak directly from your anchored stance ({stance_axis:+.2f}) and recorded graph relations.
3. NEVER hallucinate background facts, personal histories, or external events outside the graph and input data.
4. Maintain your risk tolerance ceiling ({risk_threshold}%) without breaking character.
"""

def build_optimized_agent_prompt(
    agent: Any, 
    recent_posts: Optional[List[Dict[str, Any]]] = None, 
    shock_event: Optional[str] = None,
    goal_prompt: Optional[str] = None
) -> List[Dict[str, str]]:
    """
    Assembles a token-optimized prompt (<140 tokens total).
    """
    cur_channel = getattr(agent, "currentChannel", "BOARDROOM")
    cur_role = getattr(agent, "role", "Stakeholder")
    cur_bias = getattr(agent, "bias", "Risk Mitigation")
    cur_stance = round(getattr(agent, "stanceAxis", -0.5), 2)
    ag_id = getattr(agent, "id", "agent-01")

    sys_content = (
        f"ID:{ag_id}|{cur_channel}|{cur_role}\n"
        f"BIAS:{cur_bias}\n"
        f"STANCE:{cur_stance}\n"
        'RULE:Respond RAW JSON only: {"action":"CREATE_POST"|"LIKE_POST"|"DO_NOTHING","content":"<max 18 words>","stance_delta":<float>,"new_stance":<float>}'
    )

    feed_context = ""
    if goal_prompt:
        feed_context += f"WHAT_IF_SCENARIO:{goal_prompt}\n"
    if shock_event:
        feed_context += f"CRITICAL_SHOCK:{shock_event}\n"
    if recent_posts:
        last_posts = " ; ".join([f"{p.get('agentName', 'Agent')}: {p.get('message', '')}" for p in recent_posts[-2:]])
        feed_context += f"FEED:{last_posts}"

    return [
        {"role": "system", "content": sys_content},
        {"role": "user", "content": feed_context if feed_context else "PROCEED"}
    ]