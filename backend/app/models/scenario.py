# pyrefly: ignore [missing-import]
from pydantic import BaseModel
from typing import Optional, List

class ScenarioCreate(BaseModel):
    name: str
    description: str
    document_id: Optional[str] = None

class ScenarioModel(BaseModel):
    id: str
    name: str
    description: str
    documentName: str = "No document loaded"
    createdDate: str
    lastSimulation: str = "Never"
    status: str = "READY"  # READY, RUNNING, COMPLETED, DRAFT
    agentCount: int = 50
    overallRiskScore: int = 50
