import os
import json
from typing import List, Any
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "LOKI - Latent Outcomes & Knowledge Intelligence"
    API_V1_STR: str = "/api"
    GEMINI_API_KEY: str = "mock_key_for_dev"
    GROQ_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    DATABASE_URL: str = "postgresql://postgres:dharikajees@localhost:5432/swarmlens_db"
    CORS_ORIGINS: Any = ["http://localhost:3000", "http://127.0.0.1:3000"]
    LOG_LEVEL: str = "INFO"

    # Langfuse Observability Settings
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_HOST: str = "https://us.cloud.langfuse.com"
    LANGFUSE_BASE_URL: str = "https://us.cloud.langfuse.com"

    # Production Hardening Guardrails
    MAX_UPLOAD_SIZE_BYTES: int = 15 * 1024 * 1024  # 15 MB
    ALLOWED_EXTENSIONS: List[str] = [".pdf", ".docx", ".txt"]
    RATE_LIMIT_PER_MINUTE: int = 120
    UPLOAD_RATE_LIMIT_PER_MINUTE: int = 15
    LLM_MAX_RETRIES: int = 3
    LLM_BACKOFF_FACTOR: float = 1.5

    @property
    def cors_origins_list(self) -> List[str]:
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        if isinstance(self.CORS_ORIGINS, str):
            try:
                return json.loads(self.CORS_ORIGINS)
            except Exception:
                return [i.strip() for i in self.CORS_ORIGINS.split(",") if i.strip()]
        return ["*"]

    model_config = SettingsConfigDict(
        env_file=[".env", "backend/.env"],
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
