import { GraphNode, GraphEdge } from "@/types";
import { API_BASE_URL } from "./baseUrl";

class GraphApiService {
  /**
   * Fetches real live 200-agent swarm graph from CAMEL OASIS simulation telemetry.
   * Returns empty graph if no scenario is active or backend reports no nodes.
   * ZERO synthetic/mock client-side fallback generation.
   */
  async getSwarmGraph(
    scenarioId?: string,
    roundNum: number = 1
  ): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const activeScenId =
      scenarioId ||
      (typeof window !== "undefined"
        ? localStorage.getItem("SWARMLENS_ACTIVE_SCENARIO_ID") ||
          localStorage.getItem("LOKI_ACTIVE_SCENARIO_ID") ||
          ""
        : "");

    if (!activeScenId || activeScenId === "scen-01") {
      return { nodes: [], edges: [] };
    }

    try {
      const graphUrl = `${API_BASE_URL}/scenarios/${activeScenId}/graph?round=${roundNum}`;
      const res = await fetch(graphUrl, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.nodes) && data.nodes.length > 0) {
          const nodes: GraphNode[] = data.nodes.map((n: any) => ({
            id: String(n.id),
            label: n.label || n.name || String(n.id),
            type: n.type || "AGENT",
            entityCategory: n.entityCategory || n.entity_category || "Boardroom",
            agentTier: n.agentTier !== undefined ? n.agentTier : (n.tier !== undefined ? n.tier : 4),
            stanceAxis: n.stanceAxis !== undefined ? n.stanceAxis : 0.0,
            sentiment: n.sentiment || "NEUTRAL",
            state: n.state || "ACTIVE",
            x: n.x || 0,
            y: n.y || 0,
            val: n.val || (n.is_hub ? 14 : 7),
            connections: Array.isArray(n.connections) ? n.connections : [],
            is_hub: Boolean(n.is_hub),
            weight: n.weight || 1.0,
          }));

          const edges: GraphEdge[] = (data.edges || []).map((e: any) => ({
            id: String(e.id),
            source: typeof e.source === "object" && e.source ? String(e.source.id) : String(e.source),
            target: typeof e.target === "object" && e.target ? String(e.target.id) : String(e.target),
            relationship: e.relationship || "CONNECTS",
            strength: e.strength || 3,
            isCrossTier: Boolean(e.isCrossTier || e.is_cross_tier),
            is_cross_tier: Boolean(e.isCrossTier || e.is_cross_tier),
          }));

          return { nodes, edges };
        }
      }
    } catch (err) {
      console.warn("[graphApi] Error fetching live swarm graph:", err);
    }

    return { nodes: [], edges: [] };
  }

  /**
   * Fetches real live extracted GraphRAG knowledge graph (entities and relationships).
   * Returns empty graph if no scenario is active or backend reports no entities.
   * ZERO hardcoded mock entities.
   */
  async getKnowledgeGraph(
    scenarioId?: string,
    roundNum: number = 1
  ): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const activeScenId =
      scenarioId ||
      (typeof window !== "undefined"
        ? localStorage.getItem("SWARMLENS_ACTIVE_SCENARIO_ID") ||
          localStorage.getItem("LOKI_ACTIVE_SCENARIO_ID") ||
          ""
        : "");

    if (!activeScenId || activeScenId === "scen-01") {
      return { nodes: [], edges: [] };
    }

    try {
      // First try dedicated knowledge-graph route, fallback to ?type=knowledge
      let res = await fetch(`${API_BASE_URL}/scenarios/${activeScenId}/knowledge-graph?round=${roundNum}`, {
        credentials: "include",
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch(`${API_BASE_URL}/scenarios/${activeScenId}/graph?type=knowledge&round=${roundNum}`, {
          credentials: "include",
        }).catch(() => null);
      }

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && Array.isArray(data.nodes) && data.nodes.length > 0) {
          const nodes: GraphNode[] = data.nodes.map((n: any) => ({
            id: String(n.id),
            label: n.label || n.name || String(n.id),
            type: n.type || "ENTITY",
            entityCategory: n.entityCategory || n.entity_category || "Product",
            agentTier: n.agentTier !== undefined ? n.agentTier : (n.tier !== undefined ? n.tier : 4),
            x: n.x || 0,
            y: n.y || 0,
            val: n.val || 22,
            connections: Array.isArray(n.connections) ? n.connections : [],
            state: n.state || "ACTIVE",
            stanceAxis: n.stanceAxis !== undefined ? n.stanceAxis : 0.0,
            sentiment: n.sentiment || "NEUTRAL",
            is_hub: Boolean(n.is_hub),
            weight: n.weight || 1.0,
          }));

          const edges: GraphEdge[] = (data.edges || []).map((e: any) => ({
            id: String(e.id),
            source: typeof e.source === "object" && e.source ? String(e.source.id) : String(e.source),
            target: typeof e.target === "object" && e.target ? String(e.target.id) : String(e.target),
            relationship: e.relationship || "CONNECTS",
            strength: e.strength || 3,
            isCrossTier: Boolean(e.isCrossTier || e.is_cross_tier),
            is_cross_tier: Boolean(e.isCrossTier || e.is_cross_tier),
          }));

          return { nodes, edges };
        }
      }
    } catch (err) {
      console.warn("[graphApi] Error fetching live knowledge graph:", err);
    }

    return { nodes: [], edges: [] };
  }
}

export const graphApi = new GraphApiService();
