import networkx as nx
from typing import Dict, List, Any, Optional
from app.models.graph import GraphNodeModel, GraphEdgeModel, ScenarioGraphResponse

class NetworkXGraphStore:
    def __init__(self):
        # Scenario ID -> nx.Graph
        self._graphs: Dict[str, nx.Graph] = {}

    def get_or_create_graph(self, scenario_id: str) -> nx.Graph:
        if scenario_id not in self._graphs:
            self._graphs[scenario_id] = nx.Graph()
        return self._graphs[scenario_id]

    def add_node(self, scenario_id: str, node_id: str, **attributes):
        G = self.get_or_create_graph(scenario_id)
        G.add_node(node_id, **attributes)

    def add_edge(self, scenario_id: str, u: str, v: str, **attributes):
        G = self.get_or_create_graph(scenario_id)
        G.add_edge(u, v, **attributes)

    def export_graph(self, scenario_id: str) -> ScenarioGraphResponse:
        G = self.get_or_create_graph(scenario_id)
        nodes_out: List[GraphNodeModel] = []
        edges_out: List[GraphEdgeModel] = []

        for node_id, attrs in G.nodes(data=True):
            connections = list(G.neighbors(node_id))
            nodes_out.append(
                GraphNodeModel(
                    id=node_id,
                    label=attrs.get("label", attrs.get("name", node_id)),
                    type=attrs.get("type", "ENTITY"),
                    entityCategory=attrs.get("entityCategory", None),
                    agentTier=attrs.get("agentTier", None),
                    state=attrs.get("state", None),
                    x=float(attrs.get("x", 500.0)),
                    y=float(attrs.get("y", 400.0)),
                    val=int(attrs.get("val", 18)),
                    connections=connections,
                    source_document_id=attrs.get("source_document_id", None),
                    source_chunk=attrs.get("source_chunk", None),
                )
            )

        edge_idx = 0
        for u, v, attrs in G.edges(data=True):
            edge_idx += 1
            edges_out.append(
                GraphEdgeModel(
                    id=attrs.get("id", f"e-{edge_idx}"),
                    source=u,
                    target=v,
                    relationship=attrs.get("relationship", "AFFECTS"),
                    strength=int(attrs.get("strength", 3)),
                    confidence=float(attrs.get("confidence", 0.9)),
                    source_chunk=attrs.get("source_chunk", None),
                )
            )

        return ScenarioGraphResponse(
            scenario_id=scenario_id,
            nodes=nodes_out,
            edges=edges_out
        )

graph_store = NetworkXGraphStore()
