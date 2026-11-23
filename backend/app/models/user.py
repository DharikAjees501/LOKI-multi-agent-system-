import uuid
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field

class UserModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    google_sub: Optional[str] = None
    free_sessions_remaining: int = 2
    total_sessions_run: int = 0
    created_at: str
    last_login_at: Optional[str] = None

class GoogleAuthRequest(BaseModel):
    credential: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    picture: Optional[str] = None

class GoogleAuthResponse(BaseModel):
    access_token: str
    token: str
    is_new_user: bool
    user: UserModel
    message: str = "Google authentication successful"

class UserMeResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    picture: Optional[str] = None
    google_sub: Optional[str] = None
    free_sessions_remaining: int = 2
    total_sessions_run: int = 0
    created_at: str
    last_login_at: Optional[str] = None
    saved_scenarios: List[Dict[str, Any]] = Field(default_factory=list)
    saved_documents: List[Dict[str, Any]] = Field(default_factory=list)

