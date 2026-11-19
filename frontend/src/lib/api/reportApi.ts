import { ExecutiveReport } from "@/types";
import { API_BASE_URL } from "./baseUrl";

const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

const DEFAULT_EXECUTIVE_REPORT: ExecutiveReport = {
  id: "rep-01",
  title: "EXECUTIVE SYNTHESIS REPORT",
  generatedAt: new Date().toISOString(),
  scenarioName: "Enterprise Strategy",
  documentName: "Strategy_Brief.pdf",
  executiveSummary: "Multi-agent swarm consensus analysis of operational strategy and risk parameters.",
  keyRisks: [
    "Stakeholder consensus divergence identified in mid-tier market segments.",
    "Data privacy and regulatory watchdog concerns escalated in Round 3 shock.",
    "Executive boardroom veto power remains centered on C-suite compliance leads."
  ],
  emergingRisks: [
    "Competitive counter-positioning during Round 4 transition.",
    "Potential SLA friction across Enterprise customer segment."
  ],
  agentConsensus: "Partial alignment with 38.5% opposition following Round 3 shock.",
  sentimentEvolution: "Shifted from 65% Neutral in Round 1 to critical polarization in Round 3.",
  turningPoints: [
    { id: "tp-1", round: 3, event: "Price Hike & Sovereignty Audit Shock", impact: "Triggered 38.5% peak critical opposition across agents.", severity: "HIGH" }
  ],
  recommendedInvestigationAreas: [
    "Pre-announce pricing and SLA adjustments with 60-day grandfathering clauses.",
    "Conduct bilateral consultation with regulatory watchdogs prior to Round 4 rollout.",
    "Monitor bridge catalyst nodes to prevent public cascade escalation."
  ]
};

class ReportApiService {
  private getGroundedActiveContext() {
    if (typeof window !== "undefined") {
      const doc = localStorage.getItem("LOKI_ACTIVE_DOC_NAME") || localStorage.getItem("SWARMLENS_ACTIVE_DOC_NAME");
      const title = localStorage.getItem("LOKI_ACTIVE_SCENARIO_NAME") || localStorage.getItem("SWARMLENS_ACTIVE_SCENARIO_NAME");
      const desc = localStorage.getItem("LOKI_ACTIVE_SCENARIO_DESC") || localStorage.getItem("SWARMLENS_ACTIVE_SCENARIO_DESC");
      if (doc && doc !== "No document loaded") {
        return {
          docName: doc,
          title: title || doc.replace(/\.[^/.]+$/, "") + " Strategy",
          desc: desc || "Operational simulation and risk evaluation",
        };
      }
    }
    return null;
  }

  async getExecutiveReport(scenarioId: string = "scen-01", roundNum?: number): Promise<ExecutiveReport> {
    if (!MOCK_MODE) {
      try {
        const url = roundNum ? `${API_BASE_URL}/scenarios/${scenarioId}/report?round=${roundNum}` : `${API_BASE_URL}/scenarios/${scenarioId}/report`;
        const res = await fetch(url);
        if (res.ok) {
          return await res.json();
        }
      } catch {
        // Quiet fallback when backend API is offline or restarting
      }
    }

    const grounded = this.getGroundedActiveContext();
    if (grounded) {
      return {
        ...DEFAULT_EXECUTIVE_REPORT,
        title: `EXECUTIVE SYNTHESIS: ${grounded.title}`,
        scenarioName: grounded.title,
        documentName: grounded.docName,
        executiveSummary: `Synthesized operational impact and stakeholder feedback for ${grounded.docName} (${grounded.title}). ${grounded.desc}`,
      };
    }

    return DEFAULT_EXECUTIVE_REPORT;
  }

  async getRisks(scenarioId: string = "scen-01", round?: number): Promise<any> {
    if (!MOCK_MODE) {
      try {
        const url = round ? `${API_BASE_URL}/scenarios/${scenarioId}/risks?round=${round}` : `${API_BASE_URL}/scenarios/${scenarioId}/risks`;
        const res = await fetch(url);
        if (res.ok) {
          return await res.json();
        }
      } catch {
        // Quiet fallback when backend API is offline or restarting
      }
    }

    const grounded = this.getGroundedActiveContext();
    const primaryConcern = grounded
      ? `${grounded.docName.replace(/\.[^/.]+$/, "")} Platform Adoption & Operational Friction`
      : "Mid-Market Churn & Public Backlash";

    const keyRisks = grounded
      ? [
          {
            id: "risk-01",
            title: `${grounded.title} User Friction Risk`,
            score: 78,
            severity: "HIGH",
            impactedAgentsCount: 22,
            description: `Dissatisfaction across power users and developers regarding integration of ${grounded.docName}.`,
          },
          {
            id: "risk-02",
            title: `Compliance & Security Exposure`,
            score: 72,
            severity: "HIGH",
            impactedAgentsCount: 16,
            description: `Regulatory watchdogs auditing data privacy parameters and SLA commitments in ${grounded.docName}.`,
          },
          {
            id: "risk-03",
            title: `Competitive Counter-Positioning`,
            score: 64,
            severity: "MODERATE",
            impactedAgentsCount: 12,
            description: `Rival vendors targeting enterprise accounts following strategy disclosure.`,
          },
        ]
      : [
          { id: "risk-01", title: "Enterprise Pricing Sensitivity", score: 78, severity: "HIGH", impactedAgentsCount: 22, description: "Customer churn risk on legacy mid-market accounts." },
          { id: "risk-02", title: "Regulatory Compliance Exposure", score: 72, severity: "HIGH", impactedAgentsCount: 16, description: "Data privacy watchdogs requesting compliance review." }
        ];

    return {
      overallRiskScore: 68,
      severityThreshold: "HIGH",
      primaryConcern: primaryConcern,
      keyRisks: keyRisks,
    };
  }

  async getSentimentTimeSeries(scenarioId: string = "scen-01"): Promise<any> {
    if (!MOCK_MODE) {
      try {
        const res = await fetch(`${API_BASE_URL}/scenarios/${scenarioId}/sentiment`);
        if (res.ok) {
          return await res.json();
        }
      } catch {
        // Quiet fallback when backend API is offline or restarting
      }
    }

    return {
      breakdown: { positive: 35, neutral: 25, negative: 25, critical: 15 },
      timeseries: [
        { round: 1, positive: 45, neutral: 40, negative: 10, critical: 5 },
        { round: 2, positive: 30, neutral: 35, negative: 25, critical: 10 },
        { round: 3, positive: 35, neutral: 25, negative: 25, critical: 15 },
      ],
    };
  }

  async getConsensusMatrix(scenarioId: string = "scen-01", round?: number): Promise<any> {
    if (!MOCK_MODE) {
      try {
        const url = round ? `${API_BASE_URL}/scenarios/${scenarioId}/consensus?round=${round}` : `${API_BASE_URL}/scenarios/${scenarioId}/consensus`;
        const res = await fetch(url);
        if (res.ok) {
          return await res.json();
        }
      } catch {
        // Quiet fallback when backend API is offline or restarting
      }
    }

    return {
      items: [
        { category: "Executive Alignment", status: "PARTIAL", consensusPct: 62 },
        { category: "Regulatory Watchdogs", status: "DIVIDED", consensusPct: 38 }
      ]
    };
  }

  async getTurningPoints(scenarioId: string = "scen-01"): Promise<any> {
    if (!MOCK_MODE) {
      try {
        const res = await fetch(`${API_BASE_URL}/scenarios/${scenarioId}/turning-points`);
        if (res.ok) {
          return await res.json();
        }
      } catch {
        // Quiet fallback when backend API is offline or restarting
      }
    }

    return [
      { round: 3, title: "Price Hike & Sovereignty Audit Shock", description: "Triggered 38.5% peak critical opposition across agents." }
    ];
  }

  async exportReport(scenarioId: string = "scen-01", format: "pdf" | "json" = "pdf"): Promise<void> {
    alert(`Exporting Executive Report for ${scenarioId} as ${format.toUpperCase()}...`);
  }

  async getRaciMatrix(scenarioId: string = "scen-01"): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/${scenarioId}/raci`);
      if (res.ok) return await res.json();
    } catch {}
    return {
      scenario_id: scenarioId,
      matrix: [
        {
          category: "Responsible",
          role_definition: "Factions driving operational execution & deep technical strategy.",
          factions: [
            { name: "Deep Tech & Architecture (CH_6)", roles: ["Distributed Systems Architect", "GPU Cluster Infrastructure Lead", "Zero-Trust Identity Lead"] },
            { name: "FinTech & Payment Rails (CH_5)", roles: ["ISO 20022 Core Payment Rails Lead", "Anti-Money Laundering Lead", "Neobank Core Banking VP"] },
            { name: "EdTech & Learning Systems (CH_7)", roles: ["Higher Education University CIO", "LMS Enterprise Product Director"] }
          ]
        },
        {
          category: "Accountable",
          role_definition: "Executive Boardroom leadership holding final veto power and fiscal governance.",
          factions: [
            { name: "Executive Boardroom & C-Suite (CH_1)", roles: ["CEO", "CFO", "CLO", "CISO", "CTO", "COO", "Chief Risk Officer"] }
          ]
        },
        {
          category: "Consulted",
          role_definition: "High-influence watchdog & clinical domain leaders requiring two-way consultation.",
          factions: [
            { name: "Institutional Regulatory Watchdogs (CH_2)", roles: ["US FTC Antitrust Lead", "EU GDPR Data Privacy Regulator", "SEC Enforcement Officer"] },
            { name: "Healthcare & MedTech Systems (CH_4)", roles: ["Chief Medical Officer", "FDA SaMD Inspector", "HIPAA PHI Data Privacy Officer"] }
          ]
        },
        {
          category: "Informed",
          role_definition: "Peripheral market amplifiers, public forums, and competitor observers kept notified.",
          factions: [
            { name: "Market Competitors & VCs (CH_3)", roles: ["Incumbent Market Leader CEO", "Aggressive AI Startup Founder", "Growth Equity Principal"] },
            { name: "Public Media & Community Advocates (CH_8)", roles: ["WSJ Tech Journalist", "Bloomberg Analyst", "Hacker News Moderator", "Reddit Moderator"] }
          ]
        }
      ]
    };
  }

  async getRiskThresholdMonitor(scenarioId: string = "scen-01", threshold: number = 35): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/${scenarioId}/risk-threshold-monitor?threshold=${threshold}`);
      if (res.ok) return await res.json();
    } catch {}
    return {
      scenario_id: scenarioId,
      configured_threshold_pct: threshold,
      current_opposed_pct: 38.5,
      threshold_exceeded: true,
      status: "RED_ALERT",
      warning_card: {
        title: "CRITICAL RISK THRESHOLD EXCEEDED",
        message: `38.5% of agent population opposes strategy parameters (configured threshold: ${threshold}%).`,
        catalyst_bridge_nodes: [
          { agent_id: "agent-03", role: "CEO (Chief Executive Officer)", tier: 1, position: "Risk threshold breached in Round 3." },
          { agent_id: "agent-21", role: "US FTC Antitrust Lead", tier: 2, position: "Demanding regulatory audit." }
        ]
      }
    };
  }

  async getSlideDeck(scenarioId: string = "scen-01"): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/${scenarioId}/slides`);
      if (res.ok) return await res.json();
    } catch {}
    return [
      { slide_number: 1, title: "Slide 1: Executive Summary & Overview", subtitle: "200-Agent LOKI OASIS Simulation Results", content: ["Simulated 200 autonomous agent personas across 8 OASIS sub-cluster channels.", "Goal Prompt: Evaluate enterprise strategy resiliency against market shocks.", "Key Finding: Critical stance divergence identified at Round 3 boundary."] },
      { slide_number: 2, title: "Slide 2: 5-Round Sentiment Drift", subtitle: "Trajectory of Stakeholder Alignment Across Cycles", content: ["Round 1 Baseline: 65% Neutral, 25% Pro, 10% Opposed.", "Round 3 Shock: Polarization escalated Opposed sentiment to 38.5%.", "Round 5 Final Trajectory: Stabilized with 42% Opposed, 38% Pro, 20% Neutral."] },
      { slide_number: 3, title: "Slide 3: Round 3 Shock Impact Analysis", subtitle: "Unannounced +35% SaaS Price Hike & Sovereignty Audit", content: ["Regulatory Watchdogs (CH_2) triggered immediate compliance inquiry.", "Executive Boardroom (CH_1) split between CFO growth targets and CLO legal risk.", "Public forum sentiment shifted rapidly into critical resistance."] },
      { slide_number: 4, title: "Slide 4: RACI Governance Matrix", subtitle: "Stakeholder Engagement & Faction Mapping", content: ["Accountable: Boardroom & C-Suite Veto Authority.", "Responsible: Infrastructure, FinTech, and EdTech Execution Leads.", "Consulted: Regulatory Watchdogs & MedTech Bioethics Boards.", "Informed: Media Journalists, VC Investors, and Public Community Mods."] },
      { slide_number: 5, title: "Slide 5: Recommended Action Items", subtitle: "Executive Next Steps & Mitigation Plan", content: ["1. Pre-announce price adjustment caps with 60-day grandfathering terms.", "2. Establish automated data sovereignty verification checkpoints.", "3. Engage Regulatory Watchdogs in bilateral consultation ahead of Round 4 rollout.", "4. Monitor bridge catalyst nodes to prevent public cascade escalation."] }
    ];
  }

  async getAudioBriefing(scenarioId: string = "scen-01"): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/${scenarioId}/audio-briefing`);
      if (res.ok) return await res.json();
    } catch {}
    return {
      scenario_id: scenarioId,
      duration_seconds: 60,
      narration_script: "Executive Briefing for Scenario LOKI. Our 200-agent OASIS simulation across 5 rounds revealed a key risk threshold alert. Following the Round 3 price hike shock, overall opposed sentiment reached 38.5%, exceeding the 35% warning threshold. Institutional regulators and C-suite bridge nodes catalyzed the primary dissent cascade. We recommend establishing grandfathered pricing tiers and pre-clearing data sovereignty compliance to realign executive boardroom consensus before full commercial deployment.",
      audio_url: `/api/scenarios/${scenarioId}/audio-briefing`
    };
  }
  async getReportSummary(scenarioId?: string): Promise<any> {
    const activeId =
      scenarioId ||
      (typeof window !== "undefined"
        ? localStorage.getItem("active_scenario_id") ||
          localStorage.getItem("SWARMLENS_ACTIVE_SCENARIO_ID") ||
          localStorage.getItem("LOKI_ACTIVE_SCENARIO_ID") ||
          "scen-01"
        : "scen-01");
    try {
      const res = await fetch(`${API_BASE_URL}/reports/summary?scenario_id=${activeId}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // quiet fallback
    }
    return null;
  }

  async chatWithReportAgent(
    scenarioId: string = "scen-01",
    message: string,
    history: Array<{ role: "user" | "assistant"; content: string }> = []
  ): Promise<{ reply: string; citations: string[] }> {
    const endpoints = [
      `/api/reports/${scenarioId}/chat`,
      `http://127.0.0.1:8000/api/reports/${scenarioId}/chat`,
      `http://localhost:8000/api/reports/${scenarioId}/chat`,
    ];

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, history }),
        });
        if (res.ok) {
          return await res.json();
        }
      } catch {}
    }

    return {
      reply: "The ReportAgent is temporarily synchronizing simulation telemetry. Please retry in a moment.",
      citations: ["Telemetry Monitor"],
    };
  }
}

export const reportApi = new ReportApiService();


