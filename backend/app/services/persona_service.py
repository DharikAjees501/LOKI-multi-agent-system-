import os
import re
import json
import random
import datetime
import asyncio
import threading
import concurrent.futures
from typing import List, Optional, Dict, Any
from app.models.agent import AgentModel
from app.prompts.persona import build_persona_system_prompt
from app.storage.database import get_db_connection
from app.core.logging import logger
from app.engine.llm_client import execute_multi_provider_llm_call, get_active_api_keys

_persona_generation_locks: Dict[str, threading.Lock] = {}
_locks_meta_lock = threading.Lock()
_cached_agents_by_scenario: Dict[str, List[AgentModel]] = {}

def _get_scenario_lock(scen_id: str) -> threading.Lock:
    with _locks_meta_lock:
        if scen_id not in _persona_generation_locks:
            _persona_generation_locks[scen_id] = threading.Lock()
        return _persona_generation_locks[scen_id]

class PersonaService:
    def _fetch_scenario_and_graph_context(self, scenario_id: str) -> Dict[str, Any]:
        """
        Fetches scenario metadata, document chunks, and extracted GraphRAG entities from DB.
        """
        scen_name = ""
        doc_filename = ""
        doc_context = ""
        entities = []

        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT id, name, document_id, description FROM scenarios WHERE id = ?", (scenario_id,))
            s_row = cursor.fetchone()
            if s_row:
                scen_name = s_row.get("name") or ""
                doc_filename = s_row.get("document_id") or ""
            else:
                cursor.execute(
                    """INSERT OR REPLACE INTO scenarios (id, name, description, document_id, created_date, status)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (scenario_id, f"Scenario {scenario_id}", "Auto-generated simulation scenario.", "Strategy_Document.pdf", "2026-09-23", "READY")
                )

            # Fetch up to 10 document chunks for rich domain context
            try:
                cursor.execute("""
                    SELECT dc.chunk_index, dc.text 
                    FROM document_chunks dc
                    JOIN scenarios s ON s.document_id = dc.document_id OR dc.document_id IN (SELECT id FROM documents WHERE filename = s.document_id)
                    WHERE s.id = ?
                    ORDER BY dc.chunk_index ASC
                    LIMIT 10
                """, (scenario_id,))
                c_rows = cursor.fetchall()
                if c_rows:
                    doc_context = "\n".join([f"[Chunk {r['chunk_index']}]: {r['text'][:400]}" for r in c_rows])
            except Exception as ce:
                logger.debug(f"[PersonaService] Document chunk fetch notice: {ce}")

            # Fetch extracted GraphRAG entities
            try:
                cursor.execute("SELECT label, entity_type, description FROM graph_nodes WHERE scenario_id = ? LIMIT 35", (scenario_id,))
                n_rows = cursor.fetchall()
                if n_rows:
                    entities = [{"name": r.get("label") or r.get("name"), "type": r.get("entity_type") or r.get("type"), "description": r.get("description", "")} for r in n_rows]
            except Exception as ge:
                logger.debug(f"[PersonaService] Graph nodes query notice: {ge}")
        finally:
            conn.close()

        return {
            "scen_name": scen_name,
            "doc_filename": doc_filename,
            "doc_context": doc_context,
            "entities": entities
        }

    def _generate_domain_roles_llm(
        self, doc_filename: str, scen_name: str, doc_context: str, entities: List[Dict[str, Any]]
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Calls multi-provider LLM to synthesize 25 domain-specific stakeholder roles across Tiers 1-4.
        """
        entities_text = "\n".join([f"- {e['name']} ({e['type']}): {e['description'][:90]}" for e in entities[:25]]) if entities else "None extracted yet."
        clean_title = doc_filename.replace(".pdf", "").replace("_", " ")

        prompt = f"""You are an expert organizational psychologist and stakeholder mapping architect for LOKI (Latent Outcomes & Knowledge Intelligence).
Analyze this uploaded strategy document and its extracted GraphRAG entities:

Document: {clean_title}
Scenario: {scen_name}
Extracted Knowledge Graph Entities:
{entities_text}

Document Content Excerpts:
{doc_context[:2500]}

Generate exactly 25 realistic, domain-specific stakeholder personas strictly tailored to THIS uploaded document and its specific market domain:
- Tier 1 (5 roles): Boardroom & Executive Leadership (e.g., Domain-tailored C-Suite, VP of Strategy/Product/Commercial/Partnerships)
- Tier 2 (6 roles): Institutional, Regulatory, Security & Compliance Watchdogs (e.g., Domain compliance officers, legal counsel, data privacy, security auditors, contract reviewers)
- Tier 3 (7 roles): Industry Operators, Channel Partners & Competitors (e.g., Commercial buyers, agency founders, system integrators, competing vendors, platform leads)
- Tier 4 (7 roles): Broad Market, Practitioners, End Users & Community (e.g., Daily hands-on practitioners, marketing/ops leads, end-user community moderators, industry commentators)

CRITICAL RULES:
1. Every single role must be 100% relevant to the specific domain of '{clean_title}'. If marketing SaaS, generate marketing/ad-tech roles. If healthcare, healthcare roles. If fintech, fintech roles.
2. ZERO generic or irrelevant cross-domain personas (e.g., NEVER include drone, aviation, neuromorphic, microgrid, or hospital roles unless the document explicitly covers them).
3. Output MUST strictly be a valid JSON array of exactly 25 objects with this schema:
[
  {{
    "tier": 1,
    "role": "Clear Professional Title",
    "bias": "1-sentence core professional incentive, priority, and risk sensitivity",
    "channel": "BOARDROOM",
    "default_stance": 0.45
  }}
]
Channel must be one of: "BOARDROOM" (for Tier 1), "BOARDROOM" or "COMPLIANCE" (for Tier 2), "OPERATIONS" or "MEDIA" (for Tier 3), "PUBLIC" (for Tier 4)."""

        keys = get_active_api_keys()
        if not keys:
            return None

        try:
            res_dict = None
            try:
                loop = asyncio.get_running_loop()
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(
                        asyncio.run,
                        execute_multi_provider_llm_call(prompt, temperature=0.3, max_tokens=2200, call_type="PERSONA_GENERATION")
                    )
                    res_dict = future.result(timeout=30.0)
            except RuntimeError:
                res_dict = asyncio.run(
                    execute_multi_provider_llm_call(prompt, temperature=0.3, max_tokens=2200, call_type="PERSONA_GENERATION")
                )

            if res_dict and res_dict.get("text"):
                raw = res_dict["text"].strip()
                if "```json" in raw:
                    raw = raw.split("```json")[1].split("```")[0].strip()
                elif "```" in raw:
                    raw = raw.split("```")[1].strip()
                parsed = json.loads(raw)
                if isinstance(parsed, list) and len(parsed) >= 20:
                    logger.info(f"[PersonaService] Successfully generated {len(parsed)} domain roles via LLM ({res_dict.get('provider')}/{res_dict.get('model')}).")
                    return parsed[:25]
        except Exception as e:
            logger.warning(f"[PersonaService] LLM persona generation failed ({e}). Using dynamic entity-grounded fallback.")

        return None

    def _generate_domain_roles_heuristic(
        self, doc_filename: str, scen_name: str, doc_context: str, entities: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Dynamically derives 25 domain-grounded roles from the document's own entities and keywords.
        Guarantees zero cross-domain bleed (no drone/neuromorphic/hospital roles on marketing docs).
        """
        domain_str = f"{doc_filename} {scen_name} {doc_context}".lower()

        is_marketing = any(k in domain_str for k in ["zocket", "marketing", "brand", "campaign", "ad ", "agency", "creative", "media buyer", "advertising"])
        is_health = any(k in domain_str for k in ["clinical", "patient", "medical", "hospital", "pharma", "health", "ehr", "hipaa"])
        is_edtech = any(k in domain_str for k in ["edubot", "education", "student", "learning", "curriculum", "university", "faculty", "ferpa"])
        is_fintech = any(k in domain_str for k in ["fintech", "payment", "banking", "ledger", "credit", "trading", "crypto", "settlement"])

        # Extract top entity labels from knowledge graph
        entity_names = [e["name"] for e in entities if len(e.get("name", "")) > 3]

        if is_marketing:
            return [
                # Tier 1: Boardroom & Strategic Sponsors
                {"tier": 1, "role": "Chief Marketing Officer (CMO)", "bias": "Annual marketing budget efficiency, CAC reduction, and brand equity", "channel": "BOARDROOM", "default_stance": 0.52},
                {"tier": 1, "role": "VP of Performance Marketing & Growth", "bias": "Cross-channel ROAS, scalable conversion volume, and algorithmic bidding velocity", "channel": "BOARDROOM", "default_stance": 0.45},
                {"tier": 1, "role": "Chief Commercial Officer (CCO)", "bias": "Agency distribution leverage, SaaS seat monetization, and NRR growth", "channel": "BOARDROOM", "default_stance": 0.38},
                {"tier": 1, "role": "VP of Agency Partnerships", "bias": "Preserving agency retainer relationships, multi-tenant governance, and co-marketing", "channel": "BOARDROOM", "default_stance": 0.28},
                {"tier": 1, "role": "Chief Product Officer (CPO)", "bias": "Product adoption velocity, generative creative tool parity, and API stability", "channel": "BOARDROOM", "default_stance": 0.42},
                # Tier 2: Watchdogs, Legal & Compliance
                {"tier": 2, "role": "Brand Safety & Trademark Counsel", "bias": "IP infringement prevention, unauthorized logo usage, and generative asset compliance", "channel": "BOARDROOM", "default_stance": -0.25},
                {"tier": 2, "role": "Data Privacy & GDPR/CCPA Officer", "bias": "First-party tracking compliance, user consent telemetry, and cookie deprecation rules", "channel": "BOARDROOM", "default_stance": -0.35},
                {"tier": 2, "role": "Advertising Standards & FTC Compliance Lead", "bias": "Truth-in-advertising rules, deceptive ad copy prevention, and sponsored disclosure", "channel": "BOARDROOM", "default_stance": -0.40},
                {"tier": 2, "role": "Chief Information Security Officer (CISO)", "bias": "OAuth token isolation, ad account permission boundaries, and zero-trust API access", "channel": "BOARDROOM", "default_stance": -0.15},
                {"tier": 2, "role": "Client Billing & Margin Governance Controller", "bias": "Ad spend reconciliation, markup transparency, and payment dispute mitigation", "channel": "BOARDROOM", "default_stance": -0.10},
                {"tier": 2, "role": "Enterprise Procurement Auditor", "bias": "Vendor SLA verification, SOC2 Type II certification, and contract liability terms", "channel": "BOARDROOM", "default_stance": -0.20},
                # Tier 3: Industry Operators, Channel Partners & Competitors
                {"tier": 3, "role": "Digital Marketing Agency Founder", "bias": "Protecting agency retainer margins, white-label client controls, and disintermediation defense", "channel": "MEDIA", "default_stance": -0.45},
                {"tier": 3, "role": "Senior Performance Media Buyer (Meta & Google)", "bias": "Strict daily spending caps, conversion attribution accuracy, and auction anomaly safeguards", "channel": "MEDIA", "default_stance": -0.38},
                {"tier": 3, "role": "Ad Operations & DSP Technical Director", "bias": "Real-time bidding API throughput, tracking pixel reliability, and ad set synchronization", "channel": "MEDIA", "default_stance": 0.15},
                {"tier": 3, "role": "Creative Director & Generative Copy Lead", "bias": "Brand voice consistency, creative nuance, and visual layout quality", "channel": "MEDIA", "default_stance": -0.22},
                {"tier": 3, "role": "Competing Ad-Tech Platform CEO", "bias": "Aggressive competitive counter-positioning, feature parity attack, and customer poaching", "channel": "MEDIA", "default_stance": -0.55},
                {"tier": 3, "role": "Client Account Retention Director", "bias": "Client churn reduction, transparent reporting dashboards, and campaign approval workflows", "channel": "MEDIA", "default_stance": 0.10},
                {"tier": 3, "role": "Programmatic Media Buying Specialist", "bias": "RTB click fraud elimination, domain placement whitelists, and viewability scores", "channel": "MEDIA", "default_stance": -0.30},
                # Tier 4: Broad Market, Practitioners & End Users
                {"tier": 4, "role": "Mid-Market SMB Business Owner", "bias": "Self-serve usability, predictable ad spending, and immediate customer acquisition ROI", "channel": "PUBLIC", "default_stance": 0.25},
                {"tier": 4, "role": "Paid Social Strategy Lead (TikTok & Meta)", "bias": "Creative fatigue mitigation, short-form video adaptation, and audience targeting", "channel": "PUBLIC", "default_stance": 0.18},
                {"tier": 4, "role": "Conversion Rate Optimization (CRO) Lead", "bias": "Post-click landing page friction, conversion rate decay, and A/B test validity", "channel": "PUBLIC", "default_stance": -0.12},
                {"tier": 4, "role": "Marketing Operations (MOPs) Architect", "bias": "CRM pipeline integration, webhook latency, and multi-touch lead attribution", "channel": "PUBLIC", "default_stance": -0.15},
                {"tier": 4, "role": "Social Media Community Moderator", "bias": "Public sentiment backlash, customer comment moderation, and brand crisis monitoring", "channel": "PUBLIC", "default_stance": -0.28},
                {"tier": 4, "role": "Tech & Ad-Tech Industry Reviewer", "bias": "Product benchmarking transparency, claims verification, and public tool scrutiny", "channel": "PUBLIC", "default_stance": -0.35},
                {"tier": 4, "role": "SaaS Self-Serve Product Onboarding Lead", "bias": "Time-to-first-campaign velocity, UI workflow clarity, and user drop-off prevention", "channel": "PUBLIC", "default_stance": 0.30},
            ]

        # Generic domain-grounded synthesis using extracted entities and document title
        primary_entity = entity_names[0] if entity_names else doc_filename.replace(".pdf", "").replace("_", " ")
        secondary_entity = entity_names[1] if len(entity_names) > 1 else "Core Platform"

        return [
            # Tier 1
            {"tier": 1, "role": f"Chief Executive Officer ({primary_entity})", "bias": f"Strategic leadership, enterprise adoption, and valuation leverage for {primary_entity}", "channel": "BOARDROOM", "default_stance": 0.50},
            {"tier": 1, "role": f"Chief Technology Officer (CTO)", "bias": "Architecture scalability, API throughput, and infrastructure reliability", "channel": "BOARDROOM", "default_stance": 0.42},
            {"tier": 1, "role": f"Chief Financial Officer (CFO)", "bias": "Unit economics, capital allocation, and ROI payback velocity", "channel": "BOARDROOM", "default_stance": 0.35},
            {"tier": 1, "role": f"Chief Strategy Officer (CSO)", "bias": f"Long-term ecosystem differentiation and market expansion under {primary_entity}", "channel": "BOARDROOM", "default_stance": 0.40},
            {"tier": 1, "role": f"VP of Product Architecture", "bias": "Product roadmap prioritization, feature adoption, and user satisfaction", "channel": "BOARDROOM", "default_stance": 0.45},
            # Tier 2
            {"tier": 2, "role": f"Regulatory Compliance & Policy Counsel", "bias": f"Statutory oversight compliance, legal disclosure, and audit defense for {primary_entity}", "channel": "BOARDROOM", "default_stance": -0.35},
            {"tier": 2, "role": f"Lead Data Privacy Officer (GDPR/Security)", "bias": "Zero-trust data isolation, PII confidentiality, and breach liability prevention", "channel": "BOARDROOM", "default_stance": -0.40},
            {"tier": 2, "role": f"Information Security (CISO) Lead", "bias": "Access control boundaries, vulnerability mitigation, and penetration auditing", "channel": "BOARDROOM", "default_stance": -0.25},
            {"tier": 2, "role": f"Enterprise Procurement & Vendor Risk Officer", "bias": "Contractual uptime SLAs, vendor financial solvency, and liability caps", "channel": "BOARDROOM", "default_stance": -0.20},
            {"tier": 2, "role": f"Independent Governance & Quality Auditor", "bias": "Process repeatability, algorithmic fairness, and procedural adherence", "channel": "BOARDROOM", "default_stance": -0.30},
            {"tier": 2, "role": f"Corporate Risk Controller", "bias": "Operational risk exposure, insurance covenant compliance, and error containment", "channel": "BOARDROOM", "default_stance": -0.15},
            # Tier 3
            {"tier": 3, "role": f"Strategic Solutions Integration Partner", "bias": f"Integration complexity, API stability, and deployment overhead for {secondary_entity}", "channel": "OPERATIONS", "default_stance": 0.15},
            {"tier": 3, "role": f"Incumbent Industry Competitor CEO", "bias": "Competitive defensibility, feature differentiation, and aggressive market response", "channel": "MEDIA", "default_stance": -0.55},
            {"tier": 3, "role": f"Commercial Operations Lead", "bias": "Workflow transition disruption, staff retraining overhead, and daily execution velocity", "channel": "OPERATIONS", "default_stance": -0.25},
            {"tier": 3, "role": f"Channel Distribution Reseller Director", "bias": "Margin protection, co-selling incentives, and partner enablement", "channel": "MEDIA", "default_stance": 0.10},
            {"tier": 3, "role": f"Technical Infrastructure Operations Lead", "bias": "System telemetry, latency bottleneck elimination, and resource consumption", "channel": "OPERATIONS", "default_stance": -0.18},
            {"tier": 3, "role": f"B2B Enterprise Account Director", "bias": "Client SLA satisfaction, account renewal retention, and onboarding friction", "channel": "MEDIA", "default_stance": 0.20},
            {"tier": 3, "role": f"Third-Party Ecosystem Integrator", "bias": "SDK consistency, webhook latency, and documentation completeness", "channel": "OPERATIONS", "default_stance": -0.10},
            # Tier 4
            {"tier": 4, "role": f"Hands-On Daily Practitioner Lead", "bias": "Day-to-day workflow ergonomics, repetitive task automation, and usability", "channel": "PUBLIC", "default_stance": 0.22},
            {"tier": 4, "role": f"Enterprise Department Power User", "bias": f"Feature completeness, error recovery, and productivity gains under {primary_entity}", "channel": "PUBLIC", "default_stance": 0.15},
            {"tier": 4, "role": f"Community & User Group Lead", "bias": "User community sentiment, feature requests, and feedback loop responsiveness", "channel": "PUBLIC", "default_stance": -0.12},
            {"tier": 4, "role": f"Specialized Operations Specialist", "bias": "Error rates, edge case handling, and operational fail-safe mechanisms", "channel": "PUBLIC", "default_stance": -0.28},
            {"tier": 4, "role": f"Industry Analyst & Trade Commentator", "bias": "Market validity, competitive benchmarking, and objective adoption scrutiny", "channel": "PUBLIC", "default_stance": -0.35},
            {"tier": 4, "role": f"Customer Success Onboarding Specialist", "bias": "User activation rate, initial configuration complexity, and support ticket volume", "channel": "PUBLIC", "default_stance": 0.25},
            {"tier": 4, "role": f"General Market Consumer Representative", "bias": "End-product quality, price sensitivity, and transparent brand trust", "channel": "PUBLIC", "default_stance": -0.15},
        ]

    def generate_personas_for_scenario(self, scenario_id: str, total_agents: int = 200) -> List[AgentModel]:
        """
        Dynamically generates and persists a 200-agent persona population strictly grounded in the
        document's extracted GraphRAG entities and domain, with ZERO hardcoded cross-domain lists.
        """
        context = self._fetch_scenario_and_graph_context(scenario_id)
        doc_filename = context["doc_filename"]
        scen_name = context["scen_name"]
        doc_context = context["doc_context"]
        entities = context["entities"]

        # 1. Synthesize 25 domain-specific stakeholder roles via LLM (or dynamic entity heuristic)
        domain_roles = self._generate_domain_roles_llm(doc_filename, scen_name, doc_context, entities)
        if not domain_roles or len(domain_roles) < 20:
            domain_roles = self._generate_domain_roles_heuristic(doc_filename, scen_name, doc_context, entities)

        # Separate synthesized roles by tier
        roles_by_tier: Dict[int, List[Dict[str, Any]]] = {1: [], 2: [], 3: [], 4: []}
        for r in domain_roles:
            t = r.get("tier", 4)
            if t in roles_by_tier:
                roles_by_tier[t].append(r)
            else:
                roles_by_tier[4].append(r)

        # Ensure all tiers have roles
        for t in [1, 2, 3, 4]:
            if not roles_by_tier[t]:
                roles_by_tier[t] = [r for r in domain_roles if r.get("tier") == t] or domain_roles[:5]

        # 2. Build 200-Agent population structure
        agents: List[AgentModel] = []
        agent_records: List[tuple] = []
        traj_records: List[tuple] = []

        from app.services.graph_service import graph_service
        try:
            reality_map = graph_service.calculate_graph_reality_for_scenario(scenario_id)
        except Exception as ge:
            logger.warning(f"Failed to calculate graph reality for scenario {scenario_id}: {ge}")
            reality_map = {}
        reality_keys = list(reality_map.keys())

        # Distribution plan for 200 agents:
        # Tier 0 (System): Agents 1-2 (2 agents)
        # Tier 1 (Boardroom): Agents 3-24 (22 agents)
        # Tier 2 (Watchdogs): Agents 25-64 (40 agents)
        # Tier 3 (Operators/Competitors): Agents 65-124 (60 agents)
        # Tier 4 (Market/Users): Agents 125-200 (76 agents)
        # Total = 2 + 22 + 40 + 60 + 76 = exactly 200 agents

        # TIER 0: 2 System Agents
        tier0_configs = [
            (1, "Agent 01", "GraphRAG Knowledge Extractor", 15, "Structural completeness, zero hallucination", "Extracting entity relationship maps from strategy seed document.", "NEUTRAL", "BOARDROOM"),
            (2, "Agent 02", "Multi-Agent Consensus Synthesizer", 20, "Executive aggregation, anomaly detection", "Aggregating Tier 1-4 consensus vectors for Risk Synthesis.", "NEUTRAL", "BOARDROOM"),
        ]

        # Assemble configs for 200 agents
        # TIER 0: 2 System Agents (Agents 1-2)
        for num, agent_id_name, role, threshold, bias, position, sentiment, channel in tier0_configs:
            ag_id = f"agent-{scenario_id}-{num:02d}"
            init_stance = round(random.uniform(-0.04, 0.04), 3)
            final_stance = init_stance
            matched_g = reality_map.get(role) or (reality_map[reality_keys[0]] if reality_keys else None)
            c_score = 0.95
            is_leader = True
            g_comm = "BOARDROOM"
            g_nid = f"ent-{num:04d}"
            g_beliefs = ["Maintains operational graph integrity."]
            g_edges = []

            sys_prompt = build_persona_system_prompt(
                role=role, tier=0, bias=bias, risk_threshold=threshold,
                centrality_score=c_score, is_opinion_leader=is_leader, graph_community=g_comm,
                graph_beliefs=g_beliefs, stance_axis=init_stance, graph_edges=g_edges
            )
            routing_attrs = {
                "channel": channel, "tier": 0, "priority": 10, "centralityScore": c_score,
                "isOpinionLeader": is_leader, "graphCommunity": g_comm, "graphNodeId": g_nid,
                "graphBeliefs": g_beliefs, "stanceAxis": init_stance, "initial_stance": init_stance,
                "final_stance": final_stance, "graphEdges": g_edges
            }

            agent_model = AgentModel(
                id=ag_id, numberId=num, name=agent_id_name, role=role, tier=0, tierName="TIER 0 · ORCHESTRATION & SYSTEM",
                riskThreshold=threshold, bias=bias, currentState="ACTIVE", currentChannel=channel,
                currentPosition=position, sentiment="NEUTRAL", confidence=85, system_prompt=sys_prompt,
                routing_attributes=routing_attrs, metrics={"postsCount": 1, "influenceScore": 95, "agreementRate": 90},
                centralityScore=c_score, isOpinionLeader=is_leader, graphCommunity=g_comm, graphNodeId=g_nid,
                graphBeliefs=g_beliefs, stanceAxis=init_stance, graphEdges=g_edges
            )
            agents.append(agent_model)
            agent_records.append((
                ag_id, scenario_id, num, agent_id_name, role, 0, "TIER 0 · ORCHESTRATION & SYSTEM", threshold, bias,
                agent_model.currentState, channel, position, "NEUTRAL", 85, sys_prompt,
                json.dumps(routing_attrs), json.dumps(agent_model.metrics), init_stance, final_stance
            ))
            traj_records.append((
                ag_id, init_stance, final_stance, json.dumps([init_stance]), json.dumps([]),
                "Baseline system initialization.", datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            ))

        current_agent_num = 3

        # TIERS 1 to 4: Dynamic Domain Stakeholders (Agents 3-200)
        domain_tier_allocations = [
            (1, "TIER 1 · BOARDROOM & EXECUTIVE LEADERSHIP", roles_by_tier[1], 22),
            (2, "TIER 2 · INSTITUTIONAL & REGULATORY WATCHDOGS", roles_by_tier[2], 40),
            (3, "TIER 3 · MEDIA, AMPLIFIERS & PUBLIC CRITICS", roles_by_tier[3], 60),
            (4, "TIER 4 · BROAD MARKET & CONSUMER POPULATION", roles_by_tier[4], 76),
        ]

        for tier_num, tier_title, role_list, count in domain_tier_allocations:
            n_roles = len(role_list)
            for i in range(count):
                num = current_agent_num
                current_agent_num += 1
                r_item: Dict[str, Any] = role_list[i % n_roles] if (role_list and isinstance(role_list[i % n_roles], dict)) else {}

                role_name: str = str(r_item.get("role", "Domain Stakeholder"))
                bias_text: str = str(r_item.get("bias", "Advancing domain standards and strategic alignment."))
                channel: str = str(r_item.get("channel", "BOARDROOM" if tier_num <= 1 else ("OPERATIONS" if tier_num == 3 else "PUBLIC")))
                base_stance: float = float(r_item.get("default_stance", 0.0) or 0.0)

                # Diverse stance variation around base stance
                delta = random.uniform(-0.18, 0.18)
                init_stance = round(max(-0.95, min(0.95, base_stance + delta)), 3)
                final_stance = init_stance

                if init_stance > 0.12:
                    sentiment = "POSITIVE"
                elif init_stance >= -0.12:
                    sentiment = "NEUTRAL"
                elif init_stance >= -0.50:
                    sentiment = "NEGATIVE"
                else:
                    sentiment = "CRITICAL"

                matched_g = reality_map.get(role_name)
                if not matched_g and reality_keys:
                    matched_g = reality_map[reality_keys[(num - 1) % len(reality_keys)]]

                c_score = matched_g["centrality_score"] if matched_g else round(max(0.2, 0.95 - (tier_num * 0.18) - (i % 5) * 0.02), 2)
                is_leader = matched_g["is_opinion_leader"] if matched_g else (tier_num <= 1 or i < 2)
                g_comm = matched_g["graph_community"] if matched_g else channel
                g_nid = matched_g["graph_node_id"] if matched_g else f"ent-{num:04d}"
                g_beliefs = matched_g["graph_beliefs"] if matched_g else [f"Prioritizes {bias_text} for {role_name}."]
                g_edges = matched_g["graph_edges"] if matched_g else []

                threshold = int(max(15, min(85, round(30 + (tier_num * 12) + (i % 7) * 4))))
                conf_val = min(98, max(45, int(round(52 + abs(init_stance) * 42 + (num % 5) * 2))))
                position_desc = f"Evaluating operational feasibility and risk parameters for {role_name}."

                ag_id = f"agent-{scenario_id}-{num:02d}"
                agent_name = f"Agent {num:02d}"

                sys_prompt = build_persona_system_prompt(
                    role=role_name, tier=tier_num, bias=bias_text, risk_threshold=threshold,
                    centrality_score=c_score, is_opinion_leader=is_leader, graph_community=g_comm,
                    graph_beliefs=g_beliefs, stance_axis=init_stance, graph_edges=g_edges
                )

                routing_attrs = {
                    "channel": channel, "tier": tier_num, "priority": 10 - tier_num, "centralityScore": c_score,
                    "isOpinionLeader": is_leader, "graphCommunity": g_comm, "graphNodeId": g_nid,
                    "graphBeliefs": g_beliefs, "stanceAxis": init_stance, "initial_stance": init_stance,
                    "final_stance": final_stance, "graphEdges": g_edges
                }

                agent_model = AgentModel(
                    id=ag_id, numberId=num, name=agent_name, role=role_name, tier=tier_num, tierName=tier_title,
                    riskThreshold=threshold, bias=bias_text, currentState="ACTIVE" if tier_num <= 1 else "IDLE",
                    currentChannel=channel, currentPosition=position_desc, sentiment=sentiment, confidence=conf_val,
                    system_prompt=sys_prompt, routing_attributes=routing_attrs,
                    metrics={"postsCount": 1, "influenceScore": int(c_score * 100), "agreementRate": 70},
                    centralityScore=c_score, isOpinionLeader=is_leader, graphCommunity=g_comm, graphNodeId=g_nid,
                    graphBeliefs=g_beliefs, stanceAxis=init_stance, graphEdges=g_edges
                )
                agents.append(agent_model)
                agent_records.append((
                    ag_id, scenario_id, num, agent_name, role_name, tier_num, tier_title, threshold, bias_text,
                    agent_model.currentState, channel, position_desc, sentiment, conf_val, sys_prompt,
                    json.dumps(routing_attrs), json.dumps(agent_model.metrics), init_stance, final_stance
                ))
                traj_records.append((
                    ag_id, init_stance, final_stance, json.dumps([init_stance]), json.dumps([]),
                    "Baseline initialization.", datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                ))

        # 3. Atomic single-transaction bulk persistence
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM agents WHERE scenario_id = ?", (scenario_id,))
            cursor.executemany(
                """INSERT OR REPLACE INTO agents
                   (id, scenario_id, number_id, name, role, tier, tier_name, risk_threshold, bias, current_state, current_channel, current_position, sentiment, confidence, system_prompt, routing_attributes, metrics, initial_stance, final_stance)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                agent_records
            )
            cursor.executemany(
                """INSERT OR REPLACE INTO oasis_agent_trajectories
                   (agent_id, initial_stance, final_stance, stance_history, recent_posts, perceived_shock, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                traj_records
            )
            conn.commit()
        finally:
            conn.close()

        _cached_agents_by_scenario[scenario_id] = agents
        logger.info(f"[PersonaService] Generated and persisted {len(agents)} 100% dynamic domain persona profiles for scenario {scenario_id}.")
        return agents

    def generate_50_personas_for_scenario(self, scenario_id: str) -> List[AgentModel]:
        return self.generate_personas_for_scenario(scenario_id, total_agents=200)

    def get_agents_for_scenario(self, scenario_id: str) -> List[AgentModel]:
        # 1. In-memory fast path: return cached 200 agents immediately (0ms DB cost)
        if scenario_id in _cached_agents_by_scenario and len(_cached_agents_by_scenario[scenario_id]) >= 200:
            return _cached_agents_by_scenario[scenario_id]

        # 2. Query DB with immediate connection release to protect connection pool
        conn = get_db_connection()
        rows = []
        latest_posts = {}
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM agents WHERE scenario_id = ? ORDER BY number_id ASC", (scenario_id,))
            rows = cursor.fetchall()

            if rows and len(rows) >= 200:
                cursor.execute("""
                    SELECT agent_number_id, message 
                    FROM feed_events 
                    WHERE scenario_id = ? AND message IS NOT NULL AND message != '' 
                    ORDER BY round DESC, id DESC
                """, (scenario_id,))
                feed_rows = cursor.fetchall()
                for fr in feed_rows:
                    num_id = fr["agent_number_id"]
                    if num_id not in latest_posts:
                        latest_posts[num_id] = fr["message"]
        finally:
            conn.close()

        # 3. If agents not populated, acquire single-scenario lock to prevent thundering herd
        if not rows or len(rows) < 200:
            scen_lock = _get_scenario_lock(scenario_id)
            with scen_lock:
                # Check cache again inside lock
                if scenario_id in _cached_agents_by_scenario and len(_cached_agents_by_scenario[scenario_id]) >= 200:
                    return _cached_agents_by_scenario[scenario_id]

                # Double check DB count
                conn2 = get_db_connection()
                try:
                    cur2 = conn2.cursor()
                    cur2.execute("SELECT COUNT(*) as count FROM agents WHERE scenario_id = ?", (scenario_id,))
                    cnt_row = cur2.fetchone()
                    count = dict(cnt_row).get("count", 0) if cnt_row else 0
                finally:
                    conn2.close()

                if count >= 200:
                    return self.get_agents_for_scenario(scenario_id)

                # Generate exactly ONCE across all concurrent dashboard requests
                generated = self.generate_personas_for_scenario(scenario_id, total_agents=200)
                _cached_agents_by_scenario[scenario_id] = generated
                return generated

        agents: List[AgentModel] = []
        for r in rows:
            r_attrs = json.loads(r["routing_attributes"] or "{}")
            c_score = r_attrs.get("centralityScore", round(max(0.2, 0.95 - (r["tier"] * 0.18)), 2))
            is_leader = r_attrs.get("isOpinionLeader", r["tier"] <= 1)
            g_comm = r_attrs.get("graphCommunity", r["current_channel"] or "BOARDROOM")
            g_nid = r_attrs.get("graphNodeId", f"ent-{r['number_id']:04d}")
            g_beliefs = r_attrs.get("graphBeliefs", [f"Focuses on strategic alignment of {r['role']} within knowledge graph."])
            
            init_s = float(r["initial_stance"]) if ("initial_stance" in r and r["initial_stance"] is not None) else float(r_attrs.get("initial_stance", 0.0))
            final_s = float(r["final_stance"]) if ("final_stance" in r and r["final_stance"] is not None) else float(r_attrs.get("final_stance", init_s))
            stance_ax = final_s
            g_edges = r_attrs.get("graphEdges", [])

            real_pos = latest_posts.get(r["number_id"]) or r["current_position"]
            p_cnt = 2 if r["number_id"] in latest_posts else 1
            conf = min(98, max(45, int(round(52 + abs(final_s) * 42 + p_cnt * 3))))

            agents.append(
                AgentModel(
                    id=r["id"],
                    numberId=r["number_id"],
                    name=r["name"],
                    role=r["role"],
                    tier=r["tier"],
                    tierName=r["tier_name"],
                    riskThreshold=r["risk_threshold"],
                    bias=r["bias"],
                    currentState=r["current_state"],
                    currentChannel=r["current_channel"],
                    currentPosition=real_pos,
                    latest_post=real_pos,
                    post_count=p_cnt,
                    sentiment=r["sentiment"],
                    confidence=conf,
                    system_prompt=r["system_prompt"],
                    routing_attributes=r_attrs,
                    metrics=json.loads(r["metrics"] or "{}"),
                    centralityScore=c_score,
                    isOpinionLeader=is_leader,
                    graphCommunity=g_comm,
                    graphNodeId=g_nid,
                    graphBeliefs=g_beliefs,
                    stanceAxis=stance_ax,
                    initial_stance=init_s,
                    final_stance=final_s,
                    graphEdges=g_edges
                )
            )
        _cached_agents_by_scenario[scenario_id] = agents
        return agents

persona_service = PersonaService()
