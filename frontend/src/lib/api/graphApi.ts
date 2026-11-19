import { GraphNode, GraphEdge } from "@/types";
import { API_BASE_URL } from "./baseUrl";

const IS_MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

const SWARM_ROLES_LIST: string[] = [
  // Tier 0 (1-2)
  "GraphRAG Extractor", "Report Synthesizer",
  // Tier 1 (3-20)
  "CEO", "CFO", "CLO", "CISO", "CTO", "COO", "CHRO", "CSO", "VP M&A", "VP Sales",
  "VP Customer Success", "PMM Lead", "ESG Lead", "Supply Chain Dir", "VP Enterprise", "VP IR", "Privacy Counsel", "CPO",
  // Tier 2 (21-45)
  "US FTC Antitrust Lead", "EU GDPR Regulator", "UK CMA Lead", "Japan METI Officer", "IP Patent Partner",
  "Cybersecurity Auditor", "Procurement Officer", "Gartner Lead Analyst", "Data Protection Inspector", "Treasury Officer",
  "Cyber Insurance Lead", "Labor Union Rep", "Franchise Operator", "Third-Party API Lead", "SEC Officer",
  "EU AI Act Officer", "Trade Compliance Director", "Consumer Protection Lead", "Environmental Auditor", "State AG Investigator",
  "HIPAA Privacy Officer", "ISO 27001 Auditor", "Customs Lead", "Cloud Infrastructure Auditor", "Open Source Counsel",
  // Tier 3 (46-100)
  "WSJ Tech Reporter", "Bloomberg Analyst", "Rival Incumbent CEO", "AI Startup Founder", "Growth Equity Principal",
  "Hacker News Moderator", "Reddit Community Mod", "EdTech Venture Investor", "Semiconductor Lead", "Edge Computing Lead",
  "Telecommunications Lead", "Power Grid Lead", "Workforce Reskilling Lead", "Cyber Threat Lead", "Zero-Trust Identity Lead",
  "Commercial Real Estate Lead", "BESS Energy Lead", "Synthetic Data Lead", "Chief AI Scientist", "Quant Trading Lead",
  "Customs Logistics Lead", "FX Lead", "SaaS Unit Lead", "Vector DB Lead", "Model Governance Lead",
  "Autonomous Agent Lead", "MLOps Lead", "Semiconductor Supply Lead", "K-12 Accreditation Lead", "B2B Program Lead",
  "Higher Ed CIO", "University CIO", "EdTech VP", "SLA Guarantee Lead", "BESS Lead",
  "OSHA Lead", "EV Charging Lead", "Data Center Substation Lead", "Structural Forensic Auditor", "Smart Building Lead",
  "BIM Lead Architect", "Zoning Board Chair", "PCI-DSS Auditor", "AML Lead", "General Contractor Lead",
  "Remediation Lead", "Heavy Supply Lead", "ISO 20022 Architect", "Open Banking Lead", "Neobank Core VP",
  "Payment Gateway VP", "Cross-Border SWIFT Lead", "Medical Device Architect", "ISO 13485 Quality Lead", "Micro-Transaction Lead",
  // Tier 4 (101-200)
  "LMS Director", "Course Modernizer", "Faculty Senate Chair", "Student Union President", "Curriculum Architect",
  "Instructional Designer", "Academic Dean", "University Provost", "Socratic Evaluator", "AI Companion Lead",
  "Admissions Director", "Campus IT Lead", "Distance Learning Director", "Learning Analytics Lead", "Student Privacy Officer",
  "Online Course Author", "Assessment Specialist", "Grade Passback Lead", "Brightspace Integration Lead", "Canvas Integration Lead",
  "LTI 1.3 Tech Lead", "SAML SSO Architect", "RBAC Security Specialist", "Course Content Reviewer", "Academic Integrity Officer",
  "Adaptive Learning Lead", "Media Asset Coordinator", "Student Success Advisor", "Socrates Assessment Mod", "Peer Review Coordinator",
  "Faculty Tenure Chair", "Dept Head Engineering", "Dept Head Business", "Dept Head Medicine", "Dept Head Law",
  "Research Grant Director", "Institutional Auditor", "Super Administrator Lead", "System Governance Dir", "Edubot Platform Architect",
  "Student User 01", "Student User 02", "Student User 03", "Student User 04", "Student User 05",
  "Faculty User 01", "Faculty User 02", "Faculty User 03", "Faculty User 04", "Faculty User 05",
  "Administrator 01", "Administrator 02", "Administrator 03", "Administrator 04", "Administrator 05",
  "Course Architect 01", "Course Architect 02", "Course Architect 03", "Course Architect 04", "Course Architect 05",
  "Auditor User 01", "Auditor User 02", "Auditor User 03", "Auditor User 04", "Auditor User 05",
  "Enterprise Client 01", "Enterprise Client 02", "Enterprise Client 03", "Enterprise Client 04", "Enterprise Client 05",
  "Mid-Market Client 01", "Mid-Market Client 02", "Mid-Market Client 03", "Mid-Market Client 04", "Mid-Market Client 05",
  "SaaS Partner 01", "SaaS Partner 02", "SaaS Partner 03", "SaaS Partner 04", "SaaS Partner 05",
  "Global Alumni Lead", "Student Advisory Lead", "Parent Association Lead", "Corporate Sponsor Lead", "Open Education Lead"
];

class GraphApiService {
  async getSwarmGraph(
    scenarioId?: string,
    roundNum: number = 1
  ): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const activeScenId =
      scenarioId ||
      (typeof window !== "undefined"
        ? localStorage.getItem("SWARMLENS_ACTIVE_SCENARIO_ID") ||
          localStorage.getItem("LOKI_ACTIVE_SCENARIO_ID") ||
          "scen-01"
        : "scen-01");

    try {
      const graphUrl = `${API_BASE_URL}/scenarios/${activeScenId}/graph?round=${roundNum}`;
      const res = await fetch(graphUrl).catch(() => null);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && Array.isArray(data.nodes) && data.nodes.length >= 10) {
          const nodes: GraphNode[] = data.nodes.map((n: any) => ({
            id: n.id,
            label: n.label || n.name,
            type: n.type || "AGENT",
            entityCategory: n.entityCategory || n.entity_category || "Boardroom",
            agentTier: n.agentTier !== undefined ? n.agentTier : 4,
            stanceAxis: n.stanceAxis !== undefined ? n.stanceAxis : 0.0,
            sentiment: n.sentiment || "NEUTRAL",
            state: n.state || "ACTIVE",
            x: n.x || 0,
            y: n.y || 0,
            val: n.val || (n.is_hub ? 14 : 7),
            connections: n.connections || [],
            is_hub: Boolean(n.is_hub),
            weight: n.weight || 1.0,
          }));

          const edges: GraphEdge[] = (data.edges || []).map((e: any) => ({
            id: e.id,
            source: typeof e.source === "object" && e.source ? e.source.id : e.source,
            target: typeof e.target === "object" && e.target ? e.target.id : e.target,
            relationship: e.relationship || "CONNECTS",
            strength: e.strength || 3,
            isCrossTier: Boolean(e.isCrossTier || e.is_cross_tier),
            is_cross_tier: Boolean(e.isCrossTier || e.is_cross_tier),
          }));

          return { nodes, edges };
        }
      }
    } catch {
      // Fallback below
    }

    // Dynamic Fallback Persona Generation grounded in Hub-and-Spoke topology
    const nodes: GraphNode[] = [];
    const tierAgents: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    const tierHubs: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };

    for (let i = 0; i < 200; i++) {
      const num = i + 1;
      const tier = i < 2 ? 0 : i < 20 ? 1 : i < 45 ? 2 : i < 100 ? 3 : 4;
      const agentId = `agent-${num}`;
      tierAgents[tier].push(agentId);

      // Top 2 in each tier are hubs
      const isHub = tierAgents[tier].length <= 2;
      if (isHub) {
        tierHubs[tier].push(agentId);
      }

      let stanceVal = -0.2 + (i % 5) * 0.1;
      if (roundNum === 3) stanceVal -= 0.35;
      else if (roundNum >= 4) stanceVal -= 0.45;
      stanceVal = Math.max(-1.0, Math.min(1.0, Number(stanceVal.toFixed(2))));

      const dynamicRole = SWARM_ROLES_LIST[i] || `Agent ${num}`;

      nodes.push({
        id: agentId,
        label: `A${String(num).padStart(2, "0")} ${dynamicRole}`,
        type: "AGENT",
        agentTier: tier,
        stanceAxis: stanceVal,
        sentiment: stanceVal <= -0.25 ? "CRITICAL" : stanceVal >= 0.2 ? "POSITIVE" : "NEUTRAL",
        state: stanceVal <= -0.3 ? "ALERT" : "ACTIVE",
        x: 0,
        y: 0,
        val: isHub ? 14 : 7,
        connections: [],
        is_hub: isHub,
        weight: isHub ? 0.95 : 0.6,
      });
    }

    const edges: GraphEdge[] = [];
    // Intra-tier hub-and-spoke
    Object.entries(tierAgents).forEach(([tStr, agentIds]) => {
      const t = Number(tStr);
      const hubs = tierHubs[t] || [];
      if (hubs.length >= 2) {
        edges.push({
          id: `fe-hub-${hubs[0]}-${hubs[1]}`,
          source: hubs[0],
          target: hubs[1],
          relationship: t <= 1 ? "CO_LEADS" : "SYNCHRONIZES_WITH",
          strength: 5,
          isCrossTier: false,
          is_cross_tier: false,
        });
      }

      agentIds.forEach((id, idx) => {
        if (!hubs.includes(id)) {
          const hub = hubs[idx % hubs.length];
          edges.push({
            id: `fe-spoke-${id}-${hub}`,
            source: id,
            target: hub,
            relationship: t <= 1 ? "REPORTS_TO" : "INFLUENCED_BY",
            strength: 3,
            isCrossTier: false,
            is_cross_tier: false,
          });

          // Neighbor peer link
          const nextId = agentIds[(idx + 1) % agentIds.length];
          if (nextId !== id) {
            edges.push({
              id: `fe-nbr-${id}-${nextId}`,
              source: id,
              target: nextId,
              relationship: "PEER_ALIGNED",
              strength: 2,
              isCrossTier: false,
              is_cross_tier: false,
            });
          }
        }
      });
    });

    // Cross-tier debate links between hubs
    const crossPairs = [
      [0, 1],
      [1, 2],
      [1, 3],
      [2, 3],
      [3, 4],
    ];
    crossPairs.forEach(([t1, t2]) => {
      const h1s = tierHubs[t1] || [];
      const h2s = tierHubs[t2] || [];
      h1s.forEach((h1) => {
        h2s.forEach((h2) => {
          edges.push({
            id: `fe-ct-${h1}-${h2}`,
            source: h1,
            target: h2,
            relationship: "CROSS_TIER_DEBATE",
            strength: 4,
            isCrossTier: true,
            is_cross_tier: true,
          });
        });
      });
    });

    return { nodes, edges };
  }

  async getKnowledgeGraph(
    scenarioId: string = "scen-01",
    roundNum: number = 1
  ): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    let resultNodes: GraphNode[] = [];
    let resultEdges: GraphEdge[] = [];

    if (!IS_MOCK_MODE) {
      try {
        const res = await fetch(`${API_BASE_URL}/scenarios/${scenarioId}/graph`).catch(() => null);
        if (res && res.ok) {
          const data = await res.json().catch(() => null);
          if (data && Array.isArray(data.nodes) && data.nodes.length > 0) {
            resultNodes = data.nodes.map((n: any) => ({
              id: n.id,
              label: n.label || n.name,
              type: n.type || "AGENT",
              entityCategory: n.entityCategory || n.entity_category || "Boardroom",
              agentTier: n.agentTier !== undefined ? n.agentTier : (n.tier !== undefined ? n.tier : 4),
              x: n.x || 0,
              y: n.y || 0,
              val: n.val || (n.is_hub ? 14 : 7),
              connections: n.connections || [],
              state: n.state || (roundNum >= 3 && n.is_hub ? "ALERT" : "ACTIVE"),
              stanceAxis: n.stanceAxis !== undefined ? n.stanceAxis : 0.0,
              sentiment: n.sentiment || "NEUTRAL",
              is_hub: Boolean(n.is_hub),
              weight: n.weight || 1.0,
            }));
            resultEdges = (data.edges || []).map((e: any) => ({
              id: e.id,
              source: typeof e.source === "object" && e.source ? e.source.id : e.source,
              target: typeof e.target === "object" && e.target ? e.target.id : e.target,
              relationship: e.relationship || "CONNECTS",
              strength: e.strength || 3,
              isCrossTier: Boolean(e.isCrossTier || e.is_cross_tier),
              is_cross_tier: Boolean(e.isCrossTier || e.is_cross_tier),
            }));
          }
        }
      } catch {
        // Fallback cleanly to grounded extraction
      }
    }

    if (resultNodes.length === 0 && typeof window !== "undefined") {
      const docName = localStorage.getItem("LOKI_ACTIVE_DOC_NAME") || localStorage.getItem("SWARMLENS_ACTIVE_DOC_NAME");
      const scenarioName = localStorage.getItem("LOKI_ACTIVE_SCENARIO_NAME") || localStorage.getItem("SWARMLENS_ACTIVE_SCENARIO_NAME");
      const scenarioDesc = localStorage.getItem("LOKI_ACTIVE_SCENARIO_DESC") || localStorage.getItem("SWARMLENS_ACTIVE_SCENARIO_DESC");

      if (docName && docName !== "No document loaded") {
        const baseTitle = scenarioName || docName.replace(/\.[^/.]+$/, "");
        const descText = scenarioDesc || "Extracted strategy framework & risk vectors";

        const dynamicNodes: GraphNode[] = [
          {
            id: "ent-01",
            label: `${baseTitle} Core Architecture`,
            type: "ENTITY",
            entityCategory: "Product",
            state: roundNum >= 1 ? "ACTIVE" : "IDLE",
            x: 500,
            y: 360,
            val: 28,
            connections: ["ent-02", "ent-03", "ent-05", "ent-07"],
          },
          {
            id: "ent-02",
            label: `${baseTitle} Operational Framework`,
            type: "ENTITY",
            entityCategory: "Pricing",
            state: roundNum >= 2 ? "ALERT" : "ACTIVE",
            x: 280,
            y: 240,
            val: 24,
            connections: ["ent-01", "ent-03", "ent-06"],
          },
          {
            id: "ent-03",
            label: "Target Adoption Community",
            type: "ENTITY",
            entityCategory: "Customer",
            state: "ACTIVE",
            x: 720,
            y: 240,
            val: 24,
            connections: ["ent-01", "ent-02", "ent-04"],
          },
          {
            id: "ent-04",
            label: "Broad Stakeholder Base",
            type: "ENTITY",
            entityCategory: "Customer",
            state: roundNum >= 3 ? "ALERT" : "ACTIVE",
            x: 780,
            y: 480,
            val: 22,
            connections: ["ent-03", "ent-05", "ent-08"],
          },
          {
            id: "ent-05",
            label: "Ecosystem Market Response",
            type: "ENTITY",
            entityCategory: "Competitor",
            state: roundNum >= 4 ? "ALERT" : "ACTIVE",
            x: 500,
            y: 600,
            val: 22,
            connections: ["ent-01", "ent-04"],
          },
          {
            id: "ent-06",
            label: "Institutional Regulatory Watchdogs",
            type: "ENTITY",
            entityCategory: "Regulator",
            state: roundNum >= 2 ? "ALERT" : "ACTIVE",
            x: 220,
            y: 480,
            val: 22,
            connections: ["ent-02", "ent-07"],
          },
          {
            id: "ent-07",
            label: `${baseTitle} Compliance Policy`,
            type: "ENTITY",
            entityCategory: "Policy",
            state: "ACTIVE",
            x: 340,
            y: 620,
            val: 20,
            connections: ["ent-01", "ent-06"],
          },
          {
            id: "ent-08",
            label: `${baseTitle} Primary Risk Vector`,
            type: "ENTITY",
            entityCategory: "Risk",
            state: roundNum >= 3 ? "ALERT" : "ACTIVE",
            x: 640,
            y: 620,
            val: 26,
            connections: ["ent-04", "ent-05"],
          },
        ];

        if (descText.toLowerCase().includes("ai") || descText.toLowerCase().includes("swarm")) {
          dynamicNodes.push({
            id: "ent-09",
            label: "Autonomous Swarm Analytics",
            type: "ENTITY",
            entityCategory: "Product",
            state: "ACTIVE",
            x: 500,
            y: 200,
            val: 24,
            connections: ["ent-01", "ent-03"],
          });
        }

        const dynamicEdges: GraphEdge[] = [
          { id: "e1", source: "ent-01", target: "ent-02", relationship: "AFFECTS", strength: 5 },
          { id: "e2", source: "ent-02", target: "ent-03", relationship: "AFFECTS", strength: 4 },
          { id: "e3", source: "ent-02", target: "ent-04", relationship: "CAUSES", strength: 4 },
          { id: "e4", source: "ent-05", target: "ent-04", relationship: "TARGETS", strength: 5 },
          { id: "e5", source: "ent-06", target: "ent-02", relationship: "REGULATES", strength: 5 },
          { id: "e6", source: "ent-07", target: "ent-01", relationship: "DEPENDS_ON", strength: 4 },
          { id: "e7", source: "ent-04", target: "ent-08", relationship: "CAUSES", strength: 5 },
          { id: "e8", source: "ent-05", target: "ent-08", relationship: "AFFECTS", strength: 4 },
        ];

        resultNodes = dynamicNodes;
        resultEdges = dynamicEdges;
      }
    }

    if (resultNodes.length === 0) {
      resultNodes = [
        { id: "ent-01", label: "Core Enterprise Strategy", type: "ENTITY", entityCategory: "Product", state: "ACTIVE", x: 500, y: 360, val: 28, connections: ["ent-02", "ent-03"] },
        { id: "ent-02", label: "Pricing Framework", type: "ENTITY", entityCategory: "Pricing", state: "ACTIVE", x: 280, y: 240, val: 24, connections: ["ent-01"] },
        { id: "ent-03", label: "Enterprise Segment", type: "ENTITY", entityCategory: "Customer", state: "ACTIVE", x: 720, y: 240, val: 24, connections: ["ent-01"] }
      ];
      resultEdges = [
        { id: "e1", source: "ent-01", target: "ent-02", relationship: "AFFECTS", strength: 5 },
        { id: "e2", source: "ent-01", target: "ent-03", relationship: "TARGETS", strength: 4 }
      ];
    }

    return { nodes: resultNodes, edges: resultEdges };
  }
}

export const graphApi = new GraphApiService();
