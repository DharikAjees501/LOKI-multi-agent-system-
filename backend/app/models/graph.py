from pydantic import BaseModel, Field
from typing import List, Optional

class ExtractedEntity(BaseModel):
    name: str = Field(description="Name of the entity, actor, or concept")
    type: str = Field(description="Entity type: Product, Pricing, Customer, Competitor, Regulator, Market, Policy, Risk")
    description: str = Field(description="Brief summary of the entity in context")
    source_chunk: int = Field(default=0, description="Chunk index where this entity was found")

class ExtractedRelationship(BaseModel):
    source: str = Field(description="Source entity name")
    target: str = Field(description="Target entity name")
    relationship: str = Field(description="Relationship label: AFFECTS, COMPETES_WITH, REGULATES, DEPENDS_ON, TARGETS, CAUSES")
    confidence: float = Field(default=0.9, description="Confidence score 0.0 to 1.0")
    description: Optional[str] = Field(default=None, description="Explanation of relationship")
    source_chunk: int = Field(default=0, description="Chunk index where this relationship was identified")

class GraphRAGOutput(BaseModel):
    entities: List[ExtractedEntity] = Field(default_factory=list)
    relationships: List[ExtractedRelationship] = Field(default_factory=list)
    constraints: List[str] = Field(default_factory=list)
    risks: List[str] = Field(default_factory=list)

class GraphNodeModel(BaseModel):
    id: str
    label: str
    type: str = "ENTITY"  # "ENTITY" | "AGENT"
    entityCategory: Optional[str] = None
    agentTier: Optional[int] = None
    state: Optional[str] = None
    x: float = 0.0
    y: float = 0.0
    val: int = 15
    connections: List[str] = Field(default_factory=list)
    source_document_id: Optional[str] = None
    source_chunk: Optional[int] = None
    is_hub: Optional[bool] = False
    weight: Optional[float] = 1.0
    stanceAxis: Optional[float] = 0.0
    sentiment: Optional[str] = None

class GraphEdgeModel(BaseModel):
    id: str
    source: str
    target: str
    relationship: str
    strength: int = 3
    confidence: float = 0.9
    source_chunk: Optional[int] = None
    isCrossTier: Optional[bool] = False
    is_cross_tier: Optional[bool] = False

class ScenarioGraphResponse(BaseModel):
    scenario_id: str
    nodes: List[GraphNodeModel]
    edges: List[GraphEdgeModel]
