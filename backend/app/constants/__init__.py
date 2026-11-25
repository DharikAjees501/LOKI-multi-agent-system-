"""
Re-export backend/constants so that both `from constants import ...` and `from app.constants import ...` work identically.
"""

from constants import error, success, message

__all__ = ["error", "success", "message",]
