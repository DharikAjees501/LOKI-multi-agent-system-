export type AgentTier = 0 | 1 | 2 | 3 | 4;

export type AgentTierName =
  | "TIER 0 · ORCHESTRATION & SYSTEM"
  | "TIER 1 · BOARDROOM & EXECUTIVE LEADERSHIP"
  | "TIER 2 · INSTITUTIONAL & REGULATORY WATCHDOGS"
  | "TIER 3 · MEDIA, AMPLIFIERS & PUBLIC CRITICS"
  | "TIER 4 · BROAD MARKET & CONSUMER POPULATION";

export type AgentState = "IDLE" | "THINKING" | "ACTIVE" | "RESPONDING" | "ALERT";

export type ChannelId = "BOARDROOM" | "MEDIA" | "PUBLIC";

export type Sentiment = "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "CRITICAL";

export interface Agent {
  id: string;
  numberId: number;
  name: string;
  role: string;
  tier: AgentTier;
  tierName: AgentTierName;
  riskThreshold: number; // 0 to 100
  bias: string;
  currentState: AgentState;
  currentChannel: ChannelId;
  currentPosition: string;
  sentiment: Sentiment;
  stanceAxis?: number;
  avatar?: string;
  confidence: number; // percentage
  metrics: {
    postsCount: number;
    influenceScore: number;
    agreementRate: number;
  };
}

export interface FeedEvent {
  id: string;
  timestamp: string;
  agentId: string;
  agentNumberId: number;
  role: string;
  agentName: string;
  message: string;
  sentiment: Sentiment;
  channel: ChannelId;
  round: number;
}

export interface GraphNode {
  id: string;
  label: string;
  type: "AGENT" | "ENTITY";
  entityCategory?: "Product" | "Pricing" | "Customer" | "Competitor" | "Regulator" | "Market" | "Policy" | "Risk";
  agentTier?: AgentTier;
  state?: AgentState;
  stanceAxis?: number;
  sentiment?: Sentiment;
  x: number;
  y: number;
  val: number;
  connections: string[];
  is_hub?: boolean;
  weight?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  strength: number; // 1-5
  isCrossTier?: boolean;
  is_cross_tier?: boolean;
  isHighlighted?: boolean;
}

export interface RiskVector {
  id: string;
  title: string;
  score: number; // 0 - 100
  trend: "UP" | "DOWN" | "STABLE";
  severity: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  description: string;
  impactedAgentsCount: number;
}

export interface ConsensusItem {
  agentId: string;
  agentName: string;
  role: string;
  tier: AgentTier;
  position: string;
  confidence: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface TurningPoint {
  id: string;
  round: number;
  event: string;
  impact: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface SimulationState {
  currentRound: number;
  totalRounds: number;
  status: "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED";
  speed: "SLOW" | "NORMAL" | "FAST";
  temperature: number; // 0.1 to 1.0
  activeAgentsCount: number;
  totalAgentsCount: number;
  model: string;
  activeScenarioId: string;
  loadedDocument?: {
    name: string;
    pages: number;
    status: "PARSED" | "UPLOADING" | "GRAPH_BUILDING";
    lastExtracted: string;
  };
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  documentName: string;
  createdDate: string;
  lastSimulation: string;
  status: "READY" | "RUNNING" | "COMPLETED" | "DRAFT";
  agentCount: number;
  overallRiskScore: number;
}

export interface PlaybookItem {
  priority: string;
  action: string;
  target_risk?: string;
  targetRisk?: string;
  projected_risk_drop?: string;
  projectedRiskDrop?: string;
}

export interface StructuredRiskItem {
  title: string;
  detail?: string;
  plain_explanation?: string;
  plainExplanation?: string;
  severity?: string;
  impacted_group?: string;
  impactedGroup?: string;
  evidence_quote?: string;
  evidenceQuote?: string;
  score?: number;
  impacted_agents?: number;
}

export interface MarketPushbackItem {
  title: string;
  stakeholder_group: string;
  stakeholderGroup?: string;
  quote: string;
  explanation: string;
  severity?: string;
}

export interface TradeoffAnalysis {
  advantages: string[];
  disadvantages: string[];
  verdict: string;
  verdict_explanation: string;
  verdictExplanation?: string;
}

export interface ExecutiveReport {
  id: string;
  title: string;
  generatedAt: string;
  scenarioName: string;
  documentName: string;
  file_source?: string;
  decision_verdict?: "GO" | "CONDITIONAL_GO" | "HOLD";
  decisionVerdict?: "GO" | "CONDITIONAL_GO" | "HOLD";
  one_line_verdict?: string;
  oneLineVerdict?: string;
  total_agents?: number;
  totalAgents?: number;
  agentCount?: number;
  risk_score?: number;
  riskScore?: number;
  overallRiskScore?: number;
  primary_concern?: string;
  primaryConcern?: string;
  executiveSummary: string;
  executive_summary?: string;
  audioScript?: string;
  audio_script?: string;
  audio_briefing_script?: string;
  keyRisks: (string | StructuredRiskItem)[];
  key_risks?: (string | StructuredRiskItem)[];
  action_playbook?: PlaybookItem[];
  actionPlaybook?: PlaybookItem[];
  market_pushback?: MarketPushbackItem[];
  marketPushback?: MarketPushbackItem[];
  tradeoff_analysis?: TradeoffAnalysis;
  tradeoffAnalysis?: TradeoffAnalysis;
  emergingRisks: string[];
  agentConsensus?: string;
  sentimentEvolution: string;
  sentimentBreakdown?: {
    positive: number;
    neutral: number;
    negative: number;
    critical: number;
  };
  turningPoints?: TurningPoint[];
  criticalTurningPoints?: TurningPoint[];
  stakeholderReactions?: Record<string, string>;
  recommendedInvestigationAreas: string[];
  slides?: any[];
}
