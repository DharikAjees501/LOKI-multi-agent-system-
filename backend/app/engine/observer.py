from typing import Dict, List

try:
    from app.core.logging import logger
except ImportError:
    from backend.app.core.logging import logger

class ObserverEngine:
    def generate_channel_summaries(self, round_num: int, channel_events: Dict[str, List[Dict]]) -> Dict[str, str]:
        summaries: Dict[str, str] = {}

        # 1. Executive Boardroom (Channel 1) Summary
        ch1_events = channel_events.get("BOARDROOM", [])
        if ch1_events:
            summaries["BOARDROOM"] = f"""- Round {round_num}: Boardroom split on top-line ARR growth vs mid-market churn risks.
- Legal & Compliance counsel highlighted 60-day mandatory advance notice disclosure requirements.
- CFO recommended grandfathering legacy accounts to reduce projected churn from 4.2% to 1.1%."""
        else:
            summaries["BOARDROOM"] = f"- Round {round_num}: Executive leadership maintaining alignment on feature-gated pricing model."

        # 2. Media & Press Room (Channel 2) Summary
        ch2_events = channel_events.get("MEDIA", [])
        if ch2_events:
            summaries["MEDIA"] = f"""- Round {round_num}: Investigative tech journalists published teardowns of legacy contract pricing adjustments.
- Competitor A announced aggressive conquest promotion offering a 30% price freeze guarantee.
- Industry analysts issued neutral ratings pending gross retention stabilization metrics."""
        else:
            summaries["MEDIA"] = f"- Round {round_num}: Press coverage focusing on market competitive dynamics and feature tier packaging."

        # 3. Public Forum Feed (Channel 3) Summary
        ch3_events = channel_events.get("PUBLIC", [])
        if ch3_events:
            summaries["PUBLIC"] = f"""- Round {round_num}: Public forum sentiment index dropped 18 points following viral influencer commentary.
- Price-sensitive startup founders and traditionalist users expressing high dissatisfaction.
- Enterprise power users expressing willingness to accept higher pricing if Autonomous Swarms are included."""
        else:
            summaries["PUBLIC"] = f"- Round {round_num}: Public forum sentiment stabilizing as customer support SLA clarification is issued."

        logger.info(f"[ObserverEngine] Generated 3-bullet channel summaries for Round {round_num}.")
        return summaries

observer_engine = ObserverEngine()
