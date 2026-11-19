from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class FeedEventModel(BaseModel):
    id: str
    timestamp: str
    agentId: str
    agentNumberId: int
    role: str
    agentName: str
    message: str
    sentiment: str  # POSITIVE, NEUTRAL, NEGATIVE, CRITICAL
    channel: str  # BOARDROOM, MEDIA, PUBLIC
    round: int

class RiskVectorModel(BaseModel):
    id: str
    title: str
    score: int
    severity: str
    description: str
    impactedAgentsCount: int

class ConsensusItemModel(BaseModel):
    agentId: str
    agentName: str
    role: str
    tier: int
    position: str
    confidence: int
    riskLevel: str

class TurningPointModel(BaseModel):
    id: str
    round: int
    event: str
    reason: Optional[str] = None
    impact: str
    severity: str

class SentimentBreakdownModel(BaseModel):
    positive: float
    neutral: float
    negative: float
    critical: float

class SentimentTimeSeriesPointModel(BaseModel):
    round: int
    positive: float
    neutral: float
    negative: float
    critical: float
    byChannel: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    byTier: Dict[int, Dict[str, float]] = Field(default_factory=dict)

class ConsensusMatrixIssueModel(BaseModel):
    issue: str
    support: float
    oppose: float
    neutral: float
    confidence: float
    agentDistribution: Dict[str, int] = Field(default_factory=dict)

class ExecutiveReportModel(BaseModel):
    id: str
    title: str
    generatedAt: str
    scenarioName: str
    documentName: str
    executiveSummary: str
    scenarioOverview: str
    keyRisks: List[str]
    emergingRisks: List[str]
    stakeholderReactions: Dict[str, str] = Field(default_factory=dict)
    sentimentEvolution: str
    competitiveResponse: str
    regulatoryResponse: str
    consumerResponse: str
    consensusMatrix: List[ConsensusItemModel] = Field(default_factory=list)
    criticalTurningPoints: List[TurningPointModel] = Field(default_factory=list)
    recommendedInvestigationAreas: List[str] = Field(default_factory=list)

class SimulationStateModel(BaseModel):
    scenario_id: str
    currentRound: int = 0
    totalRounds: int = 10
    status: str = "IDLE"  # IDLE, RUNNING, PAUSED, STEPPING, COMPLETED
    speed: str = "NORMAL"
    temperature: float = 0.7
    activeAgentsCount: int = 50
    totalAgentsCount: int = 50
    model: str = "Gemini 3.5 Flash"

class AgentDecisionOutput(BaseModel):
    decision: str = Field(description="Primary decision stance: APPROVE, OBJECT, ESCALATE, REVISE, CONCEDE, CONQUEST")
    reasoning_summary: str = Field(description="Concise 1-2 sentence executive reasoning summary for UI display")
    position: str = Field(description="Current position statement")
    sentiment: str = Field(description="One of: POSITIVE, NEUTRAL, NEGATIVE, CRITICAL")
    confidence: int = Field(default=85, ge=0, le=100)
    risk_level: str = Field(default="MODERATE", description="LOW, MODERATE, HIGH, CRITICAL")
    message: str = Field(description="Message to post to assigned channel")
    actions: List[str] = Field(default_factory=list, description="Downstream trigger actions")
    routing: Dict[str, Any] = Field(default_factory=dict, description="Channel and priority attributes")
