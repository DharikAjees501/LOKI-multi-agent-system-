from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class AgentModel(BaseModel):
    id: str
    numberId: int
    name: str
    role: str
    tier: int  # 0, 1, 2, 3, 4
    tierName: str
    riskThreshold: int = Field(default=50, ge=0, le=100)
    bias: str
    currentState: str = "IDLE"  # IDLE, THINKING, ACTIVE, RESPONDING, ALERT
    currentChannel: str = "BOARDROOM"  # BOARDROOM, MEDIA, PUBLIC
    currentPosition: str
    sentiment: str = "NEUTRAL"  # POSITIVE, NEUTRAL, NEGATIVE, CRITICAL
    confidence: int = 85
    system_prompt: str
    routing_attributes: Dict[str, Any] = Field(default_factory=dict)
    metrics: Dict[str, Any] = Field(default_factory=dict)

    # Graph as Agent Reality Grounding Attributes
    centralityScore: float = 0.5
    isOpinionLeader: bool = False
    graphCommunity: str = "BOARDROOM"
    graphNodeId: Optional[str] = None
    graphBeliefs: List[str] = Field(default_factory=list)
    stanceAxis: float = 0.0  # -1.0 (Strongly Oppose/Negative) to +1.0 (Strongly Support/Positive)
    initial_stance: float = 0.0
    final_stance: float = 0.0
    latest_post: Optional[str] = None
    post_count: Optional[int] = 1
    graphEdges: List[Dict[str, Any]] = Field(default_factory=list)


class ChatMessageItem(BaseModel):
    sender: str  # "USER" | "AGENT"
    message: str

class AgentInterrogateRequest(BaseModel):
    user_question: Optional[str] = None
    message: Optional[str] = None
    conversation_history: Optional[List[ChatMessageItem]] = None

class AgentInterrogateResponse(BaseModel):
    agent_id: str
    agent_role: str
    message: str
    timestamp: str
