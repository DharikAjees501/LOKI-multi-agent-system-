"""
Success constants and status strings for SWARMLENS / LOKI platform.
Contains all success messages, operational status flags, and response formatters.
"""

# --- Auth Success Messages (Google OAuth SSO) ---
LOGOUT_SUCCESS = "Logged out successfully."

# --- API Keys Success Messages ---
ALL_KEYS_DELETED = "All API keys deleted from database."
API_KEY_DELETED = "API key deleted from database."

# --- Simulation & Scenario Success Messages ---
BASELINE_SIMULATION_DISPATCHED = "Baseline 5-round simulation task dispatched successfully."
WHAT_IF_SIMULATION_DISPATCHED = "Phase B What-If 5-round re-simulation dispatched successfully."

def scenario_pipeline_dispatched(scen_id: str) -> str:
    """Format success message when scenario pipeline task is dispatched."""
    return f"Scenario {scen_id} created and isolated pipeline task dispatched."

# --- Standard Status Flags ---
STATUS_SUCCESS = "success"
STATUS_ACTIVE = "active"
STATUS_REJECTED = "rejected"
STATUS_DELETED = "deleted"
STATUS_READY = "READY"
STATUS_RUNNING = "RUNNING"
STATUS_RUNNING_BASELINE = "RUNNING_BASELINE"
STATUS_RUNNING_WHAT_IF = "RUNNING_WHAT_IF"
STATUS_GENERATING_GRAPH = "GENERATING_GRAPH"
STATUS_PAUSED = "PAUSED"
STATUS_STEPPED = "STEPPED"
STATUS_IDLE = "IDLE"
STATUS_COMPLETED = "COMPLETED"
STATUS_FAILED = "FAILED"
STATUS_OPERATIONAL = "OPERATIONAL"
STATUS_HEALTHY = "HEALTHY"
DB_CONNECTED = "CONNECTED"
