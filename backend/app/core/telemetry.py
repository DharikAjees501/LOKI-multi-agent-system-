import time
from typing import Dict, Any, List
from datetime import datetime

class TelemetryTracker:
    def __init__(self):
        self.start_time = time.time()
        self.total_llm_calls = 0
        self.total_prompt_tokens = 0
        self.total_completion_tokens = 0
        self.total_tokens_estimated = 0
        self.total_errors = 0
        self.rate_limit_429_count = 0
        self.capacity_503_count = 0
        self.total_latency_seconds = 0.0
        self.simulations_started = 0
        self.rounds_executed = 0

        # Breakdowns
        self.calls_by_type: Dict[str, int] = {"AGENT_CHAT": 0, "SIMULATION_STEP": 0, "GRAPH_RAG": 0, "REPORT_GEN": 0}
        self.tokens_by_type: Dict[str, int] = {"AGENT_CHAT": 0, "SIMULATION_STEP": 0, "GRAPH_RAG": 0, "REPORT_GEN": 0}
        self.provider_stats: Dict[str, Dict[str, int]] = {}
        self.rate_limit_events_log: List[Dict[str, Any]] = []

    def record_token_usage(
        self,
        call_type: str = "AGENT_CHAT",
        provider: str = "gemini",
        model: str = "gemini-2.5-flash",
        prompt_tokens: int = 300,
        completion_tokens: int = 50,
        latency_seconds: float = 0.6,
        status_code: int = 200,
        key_hint: str = "sk-..."
    ):
        tot = prompt_tokens + completion_tokens
        self.total_llm_calls += 1
        self.total_prompt_tokens += prompt_tokens
        self.total_completion_tokens += completion_tokens
        self.total_tokens_estimated += tot
        self.total_latency_seconds += latency_seconds

        ct = call_type.upper()
        self.calls_by_type[ct] = self.calls_by_type.get(ct, 0) + 1
        self.tokens_by_type[ct] = self.tokens_by_type.get(ct, 0) + tot

        prov = provider.lower()
        if prov not in self.provider_stats:
            self.provider_stats[prov] = {"calls": 0, "prompt_tokens": 0, "completion_tokens": 0, "errors": 0, "rate_limits": 0}

        self.provider_stats[prov]["calls"] += 1
        self.provider_stats[prov]["prompt_tokens"] += prompt_tokens
        self.provider_stats[prov]["completion_tokens"] += completion_tokens

    def record_rate_limit(
        self,
        call_type: str = "AGENT_CHAT",
        provider: str = "gemini",
        model: str = "gemini-3.6-flash-high",
        status_code: int = 429,
        error_msg: str = "Rate limit or capacity exceeded",
        key_hint: str = "sk-..."
    ):
        self.total_errors += 1
        prov = provider.lower()

        if status_code == 429:
            self.rate_limit_429_count += 1
        elif status_code == 503:
            self.capacity_503_count += 1

        if prov not in self.provider_stats:
            self.provider_stats[prov] = {"calls": 0, "prompt_tokens": 0, "completion_tokens": 0, "errors": 0, "rate_limits": 0}

        self.provider_stats[prov]["errors"] += 1
        self.provider_stats[prov]["rate_limits"] += 1

        event = {
            "timestamp": datetime.now().isoformat(),
            "call_type": call_type,
            "provider": provider,
            "model": model,
            "status_code": status_code,
            "key_hint": key_hint,
            "error": error_msg[:200]
        }
        self.rate_limit_events_log.insert(0, event)
        if len(self.rate_limit_events_log) > 50:
            self.rate_limit_events_log.pop()

    def record_llm_call(self, tokens: int = 450, latency_seconds: float = 0.8, is_error: bool = False):
        self.record_token_usage("SIMULATION_STEP", "gemini", "gemini-2.5-flash", int(tokens * 0.8), int(tokens * 0.2), latency_seconds)
        if is_error:
            self.record_rate_limit("SIMULATION_STEP", "gemini", "gemini-2.5-flash", 500, "Generic LLM Error")

    def record_simulation_start(self):
        self.simulations_started += 1

    def record_round_executed(self):
        self.rounds_executed += 1

    def get_metrics(self) -> Dict[str, Any]:
        uptime_seconds = round(time.time() - self.start_time, 1)
        avg_latency = round(self.total_latency_seconds / max(self.total_llm_calls, 1), 3)

        return {
            "status": "OPERATIONAL",
            "uptime_seconds": uptime_seconds,
            "system_timestamp": datetime.now().isoformat(),
            "llm_metrics": {
                "total_calls": self.total_llm_calls,
                "total_prompt_tokens": self.total_prompt_tokens,
                "total_completion_tokens": self.total_completion_tokens,
                "total_tokens_accumulated": self.total_tokens_estimated,
                "total_errors": self.total_errors,
                "rate_limit_429_events": self.rate_limit_429_count,
                "capacity_503_events": self.capacity_503_count,
                "average_latency_seconds": avg_latency,
                "calls_by_type": self.calls_by_type,
                "tokens_by_type": self.tokens_by_type,
                "provider_breakdown": self.provider_stats,
            },
            "rate_limit_alerts": self.rate_limit_events_log[:10],
            "simulation_metrics": {
                "simulations_started": self.simulations_started,
                "rounds_executed": self.rounds_executed,
            }
        }

telemetry = TelemetryTracker()
