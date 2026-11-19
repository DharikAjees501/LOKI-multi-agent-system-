import logging
import sys
import json
import datetime
from typing import Dict, Any, Optional
from app.core.config import settings

def setup_logging():
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )

logger = logging.getLogger("swarmlens")

def mask_secret(value: Any) -> Any:
    """
    Redaction Policy: NEVER log full API keys. Always mask them (e.g., sk-...a8B1).
    """
    if isinstance(value, str):
        val = value.strip()
        if any(val.startswith(p) for p in ["AIzaSy", "AQ.", "sk-", "gsk_", "sk-ant-", "sk-or-"]):
            prefix = val[:6] if len(val) >= 6 else val[:3]
            return f"{prefix}...{val[-4:]}" if len(val) >= 8 else "••••••••"
        return value
    elif isinstance(value, dict):
        return {k: mask_secret(v) for k, v in value.items()}
    elif isinstance(value, list):
        return [mask_secret(v) for v in value]
    return value

class JsonAuditLogger:
    """
    Structured JSON Console Audit Logger (audit_logger.py).
    Streams operational telemetry and audit logs directly to sys.stdout.
    Enforces strict API Key redaction policy across all telemetry events.
    """
    @staticmethod
    def log_event(event_name: str, payload: Optional[Dict[str, Any]] = None, level: str = "INFO"):
        safe_payload = mask_secret(payload or {})
        log_entry = {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "level": level.upper(),
            "service": "swarmlens-engine",
            "event": event_name,
            "telemetry": safe_payload
        }
        json_output = json.dumps(log_entry)
        print(json_output, file=sys.stdout, flush=True)

audit_logger = JsonAuditLogger()

