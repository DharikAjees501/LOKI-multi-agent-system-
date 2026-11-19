import json
import math
from typing import List, Optional
from app.models.graph import GraphRAGOutput, ScenarioGraphResponse, GraphNodeModel, GraphEdgeModel
from app.storage.graph_store import graph_store
from app.storage.database import get_db_connection
from app.core.logging import logger

class GraphService:
    def populate_scenario_graph_from_rag(
        self, scenario_id: str, document_id: str, rag_outputs: List[GraphRAGOutput]
    ) -> ScenarioGraphResponse:
        seen_nodes = {}
        seen_edges = set()

        if not rag_outputs:
            from app.services.extraction_service import extraction_service
            rag_outputs = [extraction_service._rule_based_extraction("Scenario Strategy Document", 0, "Strategic risk framework", f"Scenario {scenario_id}")]

        all_entities = []
        for rag_out in rag_outputs:
            for ent in rag_out.entities:
                if ent.name not in [e.name for e in all_entities]:
                    all_entities.append(ent)

        if not all_entities or len(all_entities) < 4:
            from app.services.extraction_service import extraction_service
            fallback_out = extraction_service._rule_based_extraction("Scenario Strategy Document", 0, "Strategic risk framework", f"Scenario {scenario_id}")
            for ent in fallback_out.entities:
                if ent.name not in [e.name for e in all_entities]:
                    all_entities.append(ent)
            if not rag_outputs:
                rag_outputs = [fallback_out]
            else:
                rag_outputs.append(fallback_out)

        total = len(all_entities)
        center_x, center_y = 600.0, 480.0
        radius = 250.0

        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM scenarios WHERE id = ?", (scenario_id,))
            if not cursor.fetchone():
                cursor.execute(
                    """INSERT OR REPLACE INTO scenarios (id, name, description, document_id, created_date, status)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (scenario_id, f"Scenario {scenario_id}", "Auto-generated simulation scenario.", document_id, "2026-09-23", "READY")
                )

            cursor.execute("DELETE FROM graph_nodes WHERE scenario_id = ?", (scenario_id,))
            cursor.execute("DELETE FROM graph_edges WHERE scenario_id = ?", (scenario_id,))

            for i, ent in enumerate(all_entities):
                node_id = f"ent-{abs(hash(ent.name)) % 10000:04d}"
                angle = (2 * math.pi * i) / max(1, total)
                x = center_x + radius * math.cos(angle)
                y = center_y + radius * math.sin(angle)

                # Adjust slightly based on category
                if ent.type == "Risk":
                    y -= 30
                elif ent.type == "Regulator":
                    x -= 30

                val = 26 if ent.type in ["Pricing", "Product", "Risk"] else 20
                seen_nodes[ent.name] = node_id

                graph_store.add_node(
                    scenario_id,
                    node_id,
                    label=ent.name,
                    name=ent.name,
                    type="ENTITY",
                    entityCategory=ent.type,
                    x=round(x, 2),
                    y=round(y, 2),
                    val=val,
                    source_document_id=document_id,
                    source_chunk=ent.source_chunk
                )

                cursor.execute(
                    """INSERT OR REPLACE INTO graph_nodes
                       (id, scenario_id, label, node_type, entity_category, x, y, val, connections, source_document_id, source_chunk)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (node_id, scenario_id, ent.name, "ENTITY", ent.type, round(x, 2), round(y, 2), val, "[]", document_id, ent.source_chunk)
                )

            for rag_out in rag_outputs:
                for rel in rag_out.relationships:
                    src_id = seen_nodes.get(rel.source, f"ent-{abs(hash(rel.source)) % 10000:04d}")
                    tgt_id = seen_nodes.get(rel.target, f"ent-{abs(hash(rel.target)) % 10000:04d}")
                    edge_id = f"ke-{abs(hash(f'{src_id}-{tgt_id}')) % 10000:04d}"

                    if edge_id in seen_edges:
                        continue
                    seen_edges.add(edge_id)

                    graph_store.add_edge(
                        scenario_id,
                        src_id,
                        tgt_id,
                        id=edge_id,
                        relationship=rel.relationship,
                        confidence=rel.confidence,
                        strength=4,
                        source_chunk=rel.source_chunk
                    )

                    cursor.execute(
                        """INSERT OR REPLACE INTO graph_edges
                           (id, scenario_id, source, target, relationship, strength, confidence, source_chunk)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                        (edge_id, scenario_id, src_id, tgt_id, rel.relationship, 4, rel.confidence, rel.source_chunk)
                    )

            conn.commit()
        finally:
            conn.close()

        logger.info(f"Populated scenario graph {scenario_id} with {len(seen_nodes)} nodes and {len(seen_edges)} edges.")
        return graph_store.export_graph(scenario_id)

    def get_scenario_graph(self, scenario_id: str, round_num: Optional[int] = None) -> ScenarioGraphResponse:
        """
        Neo4j Bloom Hub-and-Spoke Topology Generator for Scenario Swarm:
        1. Guarantees every tier (T0_SYSTEM, T1_BOARDROOM, T2_REGULATORS, T3_MEDIA, T4_PUBLIC) forms a connected sub-graph.
        2. Designates top 2 highest-weight agents per tier as Cluster Hubs (is_hub: true).
        3. Connects regular agents to nearest Cluster Hub (relation: "REPORTS_TO" or "INFLUENCED_BY").
        4. Connects Cluster Hubs across tiers (relation: "CROSS_TIER_DEBATE", isCrossTier: true).
        """
        return self.generate_connected_swarm_graph(scenario_id, round_num=round_num)

    def generate_connected_swarm_graph(self, scenario_id: str, round_num: Optional[int] = None) -> ScenarioGraphResponse:
        from app.services.persona_service import persona_service
        agents = persona_service.get_agents_for_scenario(scenario_id)
        if not agents or len(agents) < 50:
            agents = persona_service.generate_personas_for_scenario(scenario_id, total_agents=200)

        current_round = round_num if round_num is not None else 1

        tier_categories = {
            0: "T0_SYSTEM",
            1: "T1_BOARDROOM",
            2: "T2_REGULATORS",
            3: "T3_MEDIA",
            4: "T4_PUBLIC",
        }

        # Group agents by tier (0 to 4)
        tiered_agents = {0: [], 1: [], 2: [], 3: [], 4: []}
        for ag in agents:
            t = ag.tier if ag.tier in [0, 1, 2, 3, 4] else (
                0 if ag.numberId <= 2 else (
                    1 if ag.numberId <= 20 else (
                        2 if ag.numberId <= 45 else (
                            3 if ag.numberId <= 100 else 4
                        )
                    )
                )
            )
            tiered_agents[t].append(ag)

        nodes: List[GraphNodeModel] = []
        edges: List[GraphEdgeModel] = []
        edge_ids = set()
        tier_hubs = {0: [], 1: [], 2: [], 3: [], 4: []}

        # Clean circular layout seed coordinates for organic physics settlement
        tier_center_radii = {0: 0, 1: 170, 2: 300, 3: 440, 4: 590}

        # 1. Designate Cluster Hubs per tier & build nodes
        for tier, ag_list in tiered_agents.items():
            if not ag_list:
                continue

            def get_agent_weight(a):
                inf = getattr(a, "metrics", {}).get("influenceScore", 70) if hasattr(a, "metrics") and isinstance(a.metrics, dict) else 70
                r = (a.role or "").lower()
                if any(k in r for k in ["ceo", "cfo", "chair", "lead", "ftc", "gdpr", "wsj", "bloomberg", "director", "extractor", "founder"]):
                    inf += 25
                return inf

            sorted_by_weight = sorted(ag_list, key=get_agent_weight, reverse=True)
            hubs = sorted_by_weight[:2]
            tier_hubs[tier] = hubs
            hub_ids = {h.id for h in hubs}

            base_r = tier_center_radii.get(tier, 300)
            total_in_tier = len(ag_list)

            for idx_in_tier, ag in enumerate(ag_list):
                is_hub = ag.id in hub_ids
                weight = round(get_agent_weight(ag) / 100.0, 2)

                # Stance determination
                stance_val = -0.1
                if hasattr(ag, "currentPosition") and ag.currentPosition and "Stance:" in ag.currentPosition:
                    try:
                        stance_val = float(ag.currentPosition.split("Stance:")[1].strip().split()[0])
                    except Exception:
                        stance_val = -0.25 if ag.sentiment == "NEGATIVE" else (0.55 if ag.sentiment == "POSITIVE" else -0.1)
                elif ag.sentiment == "CRITICAL":
                    stance_val = -0.8
                elif ag.sentiment == "NEGATIVE":
                    stance_val = -0.4
                elif ag.sentiment == "POSITIVE":
                    stance_val = 0.6

                if current_round >= 3 and (is_hub or tier in [1, 2]):
                    stance_val = round(max(-1.0, stance_val - 0.25), 2)

                node_state = "ALERT" if stance_val <= -0.35 or ag.currentState == "ALERT" else "ACTIVE"
                role_name = ag.role or ag.name
                label = f"A{ag.numberId:02d} {role_name}"

                angle = (2 * math.pi * idx_in_tier) / max(1, total_in_tier) - math.pi / 2
                seed_x = round(base_r * math.cos(angle), 1)
                seed_y = round(base_r * math.sin(angle), 1)

                nodes.append(
                    GraphNodeModel(
                        id=ag.id,
                        label=label,
                        type="AGENT",
                        entityCategory=tier_categories.get(tier, "T4_PUBLIC"),
                        agentTier=tier,
                        state=node_state,
                        x=seed_x,
                        y=seed_y,
                        val=14 if is_hub else 7,
                        connections=[],
                        is_hub=is_hub,
                        weight=weight,
                        stanceAxis=stance_val,
                        sentiment="CRITICAL" if stance_val <= -0.5 else ("NEGATIVE" if stance_val < 0 else "POSITIVE"),
                    )
                )

            # 2. Intra-Tier Hub-and-Spoke Topology
            # Connect the 2 hubs together
            if len(hubs) >= 2:
                h_edge = f"e-hub-{hubs[0].id}-{hubs[1].id}"
                if h_edge not in edge_ids:
                    edge_ids.add(h_edge)
                    edges.append(
                        GraphEdgeModel(
                            id=h_edge,
                            source=hubs[0].id,
                            target=hubs[1].id,
                            relationship="CO_LEADS" if tier <= 1 else "SYNCHRONIZES_WITH",
                            strength=5,
                            confidence=0.98,
                            isCrossTier=False,
                            is_cross_tier=False
                        )
                    )

            # Connect every regular agent to nearest Cluster Hub
            for i, ag in enumerate(ag_list):
                if ag.id in hub_ids:
                    continue
                assigned_hub = hubs[i % len(hubs)]
                rel = "REPORTS_TO" if tier <= 1 else "INFLUENCED_BY"
                e_id = f"e-spoke-{ag.id}-{assigned_hub.id}"
                if e_id not in edge_ids:
                    edge_ids.add(e_id)
                    edges.append(
                        GraphEdgeModel(
                            id=e_id,
                            source=ag.id,
                            target=assigned_hub.id,
                            relationship=rel,
                            strength=3,
                            confidence=0.92,
                            isCrossTier=False,
                            is_cross_tier=False
                        )
                    )

                # Connect sequential neighbors within tier for rich cohesive sub-graph lines
                neighbor = ag_list[(i + 1) % len(ag_list)]
                if neighbor.id != ag.id:
                    nbr_id = f"e-nbr-{ag.id}-{neighbor.id}"
                    if nbr_id not in edge_ids:
                        edge_ids.add(nbr_id)
                        edges.append(
                            GraphEdgeModel(
                                id=nbr_id,
                                source=ag.id,
                                target=neighbor.id,
                                relationship="PEER_ALIGNED",
                                strength=2,
                                confidence=0.88,
                                isCrossTier=False,
                                is_cross_tier=False
                            )
                        )

        # 3. Cross-Tier Macro Connections between Cluster Hubs
        cross_pairs = [
            (0, 1, "SYSTEM_GOVERNANCE"),
            (1, 2, "CROSS_TIER_DEBATE"),
            (1, 3, "CROSS_TIER_DEBATE"),
            (2, 3, "CROSS_TIER_DEBATE"),
            (3, 4, "INFLUENCES_MARKET"),
        ]

        for t1, t2, rel in cross_pairs:
            hubs1 = tier_hubs.get(t1, [])
            hubs2 = tier_hubs.get(t2, [])
            for h1 in hubs1:
                for h2 in hubs2:
                    ct_id = f"e-ct-{h1.id}-{h2.id}"
                    if ct_id not in edge_ids:
                        edge_ids.add(ct_id)
                        edges.append(
                            GraphEdgeModel(
                                id=ct_id,
                                source=h1.id,
                                target=h2.id,
                                relationship=rel,
                                strength=4,
                                confidence=0.95,
                                isCrossTier=True,
                                is_cross_tier=True
                            )
                        )

        return ScenarioGraphResponse(scenario_id=scenario_id, nodes=nodes, edges=edges)

    def get_raw_entity_graph(self, scenario_id: str, round_num: Optional[int] = None) -> ScenarioGraphResponse:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()

            cursor.execute("SELECT * FROM graph_nodes WHERE scenario_id = ?", (scenario_id,))
            nodes_rows = cursor.fetchall()

            cursor.execute("SELECT * FROM graph_edges WHERE scenario_id = ?", (scenario_id,))
            edges_rows = cursor.fetchall()

            cursor.execute("SELECT name, description, document_id FROM scenarios WHERE id = ?", (scenario_id,))
            scen = cursor.fetchone()
        finally:
            conn.close()

        if not nodes_rows or len(nodes_rows) < 4:
            doc_id = scen["document_id"] if scen else "doc-default"
            doc_title = scen["name"] if scen else "Strategy Scenario"
            doc_desc = scen["description"] if scen else "Strategic risk framework"
            from app.services.extraction_service import extraction_service
            rag_output = extraction_service._rule_based_extraction("Strategy Document", 0, doc_desc, doc_title)
            return self.populate_scenario_graph_from_rag(scenario_id, doc_id, [rag_output])

        current_round = round_num if round_num is not None else 1

        nodes: List[GraphNodeModel] = []
        for r in nodes_rows:
            cat = r["entity_category"] or ""
            lbl = (r["label"] or "").lower()

            # Dynamic round-driven node alert state transition
            node_state = "ACTIVE"
            if current_round >= 2 and cat == "Regulator":
                node_state = "ALERT"
            elif current_round >= 3 and (cat == "Risk" or "mid-market" in lbl or "churn" in lbl):
                node_state = "ALERT"
            elif current_round >= 4 and cat == "Competitor":
                node_state = "ALERT"
            elif r["state"]:
                node_state = r["state"]

            nodes.append(
                GraphNodeModel(
                    id=r["id"],
                    label=r["label"],
                    type=r["node_type"],
                    entityCategory=r["entity_category"],
                    agentTier=r["agent_tier"],
                    state=node_state,
                    x=r["x"] or 500.0,
                    y=r["y"] or 400.0,
                    val=r["val"] or 20,
                    connections=json.loads(r["connections"] or "[]"),
                    source_document_id=r["source_document_id"],
                    source_chunk=r["source_chunk"]
                )
            )

        edges: List[GraphEdgeModel] = []
        for r in edges_rows:
            edges.append(
                GraphEdgeModel(
                    id=r["id"],
                    source=r["source"],
                    target=r["target"],
                    relationship=r["relationship"],
                    strength=r["strength"] or 3,
                    confidence=r["confidence"] or 0.9,
                    source_chunk=r["source_chunk"]
                )
            )

        return ScenarioGraphResponse(scenario_id=scenario_id, nodes=nodes, edges=edges)

    def calculate_graph_reality_for_scenario(self, scenario_id: str) -> dict:
        """
        Calculates Graph as Agent Reality metrics:
        1. Degree & Centrality scores for high-centrality opinion leader seeding.
        2. Graph community memberships (Regulatory, Executive, Tech, Market, Public).
        3. Stance vectors (-1.0 to +1.0) and belief statements derived directly from graph relations.
        4. Pre-populated agent relationships and influence asymmetries from graph edges.
        """
        graph_data = self.get_scenario_graph(scenario_id)
        nodes = graph_data.nodes
        edges = graph_data.edges

        if not nodes:
            return {}

        node_map = {n.id: n for n in nodes}
        node_degrees = {n.id: 0 for n in nodes}
        adjacency = {n.id: [] for n in nodes}

        for e in edges:
            if e.source in node_degrees:
                node_degrees[e.source] += 1
                adjacency[e.source].append(e)
            if e.target in node_degrees:
                node_degrees[e.target] += 1
                adjacency[e.target].append(e)

        max_deg = max(node_degrees.values()) if node_degrees and max(node_degrees.values()) > 0 else 1

        centrality_scores = {nid: round(min(0.98, max(0.1, 0.3 + (deg / max_deg) * 0.65)), 2) for nid, deg in node_degrees.items()}

        sorted_nodes = sorted(nodes, key=lambda n: centrality_scores[n.id], reverse=True)
        opinion_leader_threshold = sorted_nodes[min(len(sorted_nodes) - 1, max(1, int(len(sorted_nodes) * 0.2)))].id

        reality_map = {}
        for n in nodes:
            nid = n.id
            c_score = centrality_scores[nid]
            is_leader = c_score >= centrality_scores.get(opinion_leader_threshold, 0.6)

            cat = n.entityCategory or "General"
            if cat in ["Regulator", "Legal", "Compliance"]:
                community = "Institutional Regulatory Oversight"
            elif cat in ["Executive", "Boardroom", "Pricing"]:
                community = "Executive Strategy & Governance"
            elif cat in ["Technology", "Product", "MLOps", "Cloud"]:
                community = "Deep Tech & Architecture"
            elif cat in ["Competitor", "Market", "VC"]:
                community = "Ecosystem & Market Dynamics"
            else:
                community = "Broad Market & User Population"

            node_edges = adjacency.get(nid, [])
            beliefs = []
            stance_vector = 0.0
            relationships = []

            for edge in node_edges:
                is_source = edge.source == nid
                other_nid = edge.target if is_source else edge.source
                other_node = node_map.get(other_nid)
                other_label = other_node.label if other_node else other_nid
                rel = edge.relationship.lower()

                if any(k in rel for k in ["oppose", "violate", "restrict", "penalize", "reject", "block", "conflict"]):
                    stance_val = -0.8
                    b_str = f"Opposes {other_label} (relation: '{edge.relationship}', stance = -0.8 on regulation axis)"
                elif any(k in rel for k in ["support", "enable", "adopt", "drive", "accelerate", "partner", "invest"]):
                    stance_val = +0.7
                    b_str = f"Supports {other_label} (relation: '{edge.relationship}', stance = +0.7 on growth axis)"
                elif any(k in rel for k in ["audit", "regulate", "monitor", "inspect", "scrutinize"]):
                    stance_val = -0.5
                    b_str = f"Audits compliance of {other_label} (relation: '{edge.relationship}', stance = -0.5 on compliance axis)"
                else:
                    stance_val = 0.0
                    b_str = f"Linked to {other_label} (relation: '{edge.relationship}', stance = 0.0)"

                beliefs.append(b_str)
                stance_vector += stance_val

                other_c_score = centrality_scores.get(other_nid, 0.5)
                if c_score > other_c_score + 0.15:
                    asymmetry = "dominant_influence"
                elif c_score < other_c_score - 0.15:
                    asymmetry = "influenced_by_target"
                else:
                    asymmetry = "peer_influence"

                relationships.append({
                    "target_entity": other_label,
                    "target_id": other_nid,
                    "relationship": edge.relationship,
                    "direction": "outgoing" if is_source else "incoming",
                    "influence_asymmetry": asymmetry
                })

            if node_edges:
                stance_vector = round(max(-1.0, min(1.0, stance_vector / len(node_edges))), 2)

            reality_map[n.label] = {
                "graph_node_id": nid,
                "centrality_score": c_score,
                "is_opinion_leader": is_leader,
                "graph_community": community,
                "graph_beliefs": beliefs[:5] if beliefs else [f"Evaluates strategic alignment of {n.label} within graph."],
                "stance_axis": stance_vector,
                "graph_edges": relationships[:5]
            }

        return reality_map

graph_service = GraphService()

