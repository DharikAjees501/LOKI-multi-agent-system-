"""
Structured Console Audit Logger Module (audit_logger.py)
Streams operational telemetry to sys.stdout in JSON format.
Strict API Key redaction policy enforced.
"""

from app.core.logging import JsonAuditLogger, audit_logger, mask_secret

__all__ = ["JsonAuditLogger", "audit_logger", "mask_secret"]
