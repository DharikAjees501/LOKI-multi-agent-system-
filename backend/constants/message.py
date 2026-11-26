"""
System, log, and communication message templates for SWARMLENS / LOKI platform.
Contains dynamic formatters for system messages, user greetings, and telemetry logs.
"""

from typing import Optional

# --- User Greetings & UI Messages ---
WELCOME_NEW_USER = "Welcome to LOKI!"
WELCOME_BACK_USER = "Welcome back!"
SIMULATION_IN_PROGRESS = "Simulation in progress: 200 agents are actively deliberating across 5 rounds. Live synthesis streaming."

# --- Documents Log & Audit Helpers ---
def log_document_upload_processing(filename: str, size_bytes: int, user_id: str) -> str:
    return f"[Documents API] Processing upload request for file: {filename} (Size: {size_bytes} bytes, User: {user_id})"

def log_document_upload_success(filename: str, doc_id: str) -> str:
    return f"[Documents API] Document upload completed successfully for {filename} (Doc ID: {doc_id})"

def log_document_fetching(doc_id: str) -> str:
    return f"[Documents API] Fetching document metadata & chunks for ID: {doc_id}"

def log_document_delete(doc_id: str) -> str:
    return f"[Documents API] Deleting document and cascading scenarios: {doc_id}"

def log_document_delete_failed(doc_id: str, err: object) -> str:
    return f"[Documents API] Failed to delete document {doc_id}: {err}"

# --- Scenario Pipeline Log Helpers ---
def log_scenario_creating(name: str) -> str:
    return f"[Scenarios API] Creating new scenario: '{name}'"

def log_scenario_creating_and_running(name: str) -> str:
    return f"[Scenarios API] Creating and running isolated scenario: '{name}'"

def log_isolated_step(step_num: int, description: str, scen_id: str) -> str:
    return f"[Isolated Pipeline] Step {step_num}: {description} for {scen_id}"

def log_isolated_completed(scen_id: str) -> str:
    return f"[Isolated Pipeline] Step 4: Full simulation successfully concluded for {scen_id}."

def log_isolated_error(scen_id: str, err: object) -> str:
    return f"[Isolated Pipeline Error for {scen_id}]: {err}"

# --- Quota & Security Log Helpers ---
LOG_QUOTA_VALID_BYOK = "[Quota Guard] Valid BYOK key verified in memory/vault. Unlimited simulation permitted."
LOG_QUOTA_ANONYMOUS_ATTEMPT = "[Quota Guard] Anonymous simulation attempt without BYOK keys."

def log_quota_exhausted(user_id: str) -> str:
    return f"[Quota Guard] User {user_id} has exhausted free courtesy runs."

def log_quota_deducted(user_id: str, remaining: int) -> str:
    return f"[Quota Guard] Deducted courtesy run for user {user_id}. Remaining: {remaining}"

def log_csrf_blocked(origin: Optional[str], path: Optional[str] = None) -> str:
    if path:
        return f"[CSRF Protection] Untrusted origin blocked: {origin} on {path}"
    return f"[CSRF Guard] Untrusted origin blocked: {origin}"

def log_rate_limit_exceeded(ip: str, path: str) -> str:
    return f"Rate limit exceeded for IP {ip} on path {path}"

def log_ownership_blocked(user_id: Optional[str], resource_type: str, resource_id: str, owner_id: str) -> str:
    return f"[Ownership Guard] User {user_id or 'ANONYMOUS'} attempted access to {resource_type} {resource_id} owned by {owner_id}"
