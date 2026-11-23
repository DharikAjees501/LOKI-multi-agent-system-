import logging
import sys
import json
import datetime
import re
from typing import Dict, Any, Optional
from app.core.config import settings

# Sensitive credential patterns to scrub from all server-side logs and console traces
SENSITIVE_PATTERNS = [
    re.compile(r"AIza[0-9A-Za-z\-_]{35}"),               # Google Gemini / GCP keys
    re.compile(r"gsk_[0-9A-Za-z]{40,}"),                # Groq API keys
    re.compile(r"sk-ant-[0-9A-Za-z\-_]{20,}"),          # Anthropic Claude keys
    re.compile(r"sk-or-[0-9A-Za-z\-_]{20,}"),           # OpenRouter keys
    re.compile(r"sk-[0-9A-Za-z\-_]{20,}"),              # OpenAI API keys
    re.compile(r"GOCSPX-[0-9A-Za-z\-_]+"),              # Google OAuth Client Secrets
    re.compile(r"swarmlens_session=[^;\s]+"),           # Session Cookie Tokens
    re.compile(r"Bearer\s+[A-Za-z0-9\-_\.]{20,}"),      # Authorization Bearer JWTs
]

def sanitize_log_text(text: str) -> str:
    if not isinstance(text, str):
        return text
    sanitized = text
    for pattern in SENSITIVE_PATTERNS:
        sanitized = pattern.sub("[REDACTED]", sanitized)
    return sanitized

class SensitiveDataFilter(logging.Filter):
    """
    Custom logging filter that scans and redacts API keys, credentials, and session tokens
    from any log record before it is written to stdout, stderr, or logfiles.
    """
    def filter(self, record: logging.LogRecord) -> bool:
        if record.msg and isinstance(record.msg, str):
            record.msg = sanitize_log_text(record.msg)
        if record.args:
            if isinstance(record.args, tuple):
                record.args = tuple(
                    sanitize_log_text(a) if isinstance(a, str) else a
                    for a in record.args
                )
            elif isinstance(record.args, dict):
                record.args = {
                    k: (sanitize_log_text(v) if isinstance(v, str) else v)
                    for k, v in record.args.items()
                }
        return True

def setup_logging():
    log_filter = SensitiveDataFilter()

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))

    # Add stream handler with filter if not already configured
    if not root_logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
        handler.addFilter(log_filter)
        root_logger.addHandler(handler)
    else:
        for handler in root_logger.handlers:
            handler.addFilter(log_filter)

    # Attach filter to all relevant loggers
    for logger_name in ["swarmlens", "uvicorn", "uvicorn.access", "uvicorn.error", "fastapi"]:
        l = logging.getLogger(logger_name)
        l.addFilter(log_filter)

logger = logging.getLogger("swarmlens")

def mask_secret(value: Any) -> Any:
    """
    Redaction Policy: NEVER log full API keys. Always mask them (e.g., sk-...a8B1).
    """
    if isinstance(value, str):
        val = value.strip()
        if any(val.startswith(p) for p in ["AIzaSy", "AQ.", "sk-", "gsk_", "sk-ant-", "sk-or-"]):
            prefix = val[:6] if len(val) >= 6 else val[:3]
            return f"{prefix}...{val[-4:]}" if len(val) >= 8 else "[REDACTED]"
        return sanitize_log_text(val)
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
        print(sanitize_log_text(json_output), file=sys.stdout, flush=True)

audit_logger = JsonAuditLogger()
