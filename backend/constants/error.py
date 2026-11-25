"""
Error constants and helper functions for SWARMLENS / LOKI platform.
Contains all error detail strings, exception messages, and dynamic error formatters.
"""

from typing import List, Optional

# --- Authentication & Authorization Errors (Google OAuth & Session Security) ---
INVALID_GOOGLE_ISSUER = "Invalid Google token issuer."
INVALID_GOOGLE_CREDENTIAL = "Invalid Google authentication credential or email."
WORKSPACE_INIT_FAILED = "Failed to initialize user workspace."
AUTH_REQUIRED = "Authentication required"
SESSION_EXPIRED = "Invalid or expired session. Please sign in again."
USER_ACCOUNT_NOT_FOUND = "User account not found"
CSRF_VERIFICATION_FAILED = "CSRF origin verification failed."

# --- Document Errors ---
FILENAME_EMPTY = "Filename cannot be empty"
FILE_CONTENT_EMPTY = "File content is empty"
DOCUMENT_NOT_FOUND = "Document not found"

def unsupported_file_format(ext: str, allowed: List[str]) -> str:
    """Format error for unsupported document upload format."""
    return f"Unsupported file format '{ext}'. Allowed formats: {', '.join(allowed)}"

def file_size_exceeded(size_bytes: int, max_bytes: int) -> str:
    """Format error for file upload exceeding maximum permitted size."""
    mb = max_bytes // (1024 * 1024)
    return f"File size ({size_bytes} bytes) exceeds maximum limit of {max_bytes} bytes ({mb} MB)."

# --- API Keys & Quota Errors ---
NO_KEYS_PROVIDED = "No API keys provided in verification payload."
FREE_RUNS_EXHAUSTED = "Free runs used. Add your free Gemini or Groq API key in the top bar for unlimited simulations."
API_KEY_REQUIRED_INTERROGATION = "API key required for live interrogation."

# --- Scenarios & Reports Errors ---
TEXT_CANNOT_BE_EMPTY = "Text cannot be empty."
MESSAGE_CANNOT_BE_EMPTY = "Message cannot be empty."
INVALID_SCENARIO_ID = "Invalid scenario ID."
SCENARIO_NOT_FOUND = "Scenario not found"

def scenario_not_found(scenario_id: str) -> str:
    """Format error for missing scenario record."""
    return f"Scenario '{scenario_id}' not found."

def tts_speech_error(err: object) -> str:
    """Format error for Edge TTS voice synthesis failure."""
    return f"Edge TTS speech generation error: {err}"

def database_retrieval_failed(err: object) -> str:
    """Format error for database retrieval errors."""
    return f"Database retrieval failed: {err}"

def cascade_delete_failed(err: object) -> str:
    """Format error for cascade deletion failure."""
    return f"Database cascade delete failed: {err}"

# --- System & Network Errors ---
RATE_LIMIT_EXCEEDED = "Rate limit exceeded. Too many requests. Please wait before retrying."
INTERNAL_SERVER_ERROR = "Internal server error"
