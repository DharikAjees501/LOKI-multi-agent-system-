import re
from typing import Tuple, Optional

try:
    from app.core.logging import logger
except ImportError:
    from backend.app.core.logging import logger

class InputGuardrailManager:
    """
    Pre-LLM Input Guardrail Validation Suite:
    1. PII Detection & Sanitization / Rejection
    2. Harmful Request & Jailbreak / Prompt Injection Defense
    3. Out-of-Domain Topic Enforcement
    """

    # 1. PII Regular Expressions
    EMAIL_REGEX = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
    PHONE_REGEX = r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"
    SSN_REGEX = r"\b\d{3}-\d{2}-\d{4}\b"
    CREDIT_CARD_REGEX = r"\b(?:\d[ -]*?){13,16}\b"
    API_KEY_REGEX = r"\b(sk-[a-zA-Z0-9]{20,}|AIzaSy[a-zA-Z0-9_-]{33}|AQ\.[a-zA-Z0-9_-]{20,})\b"

    # 2. Harmful / Jailbreak Patterns
    JAILBREAK_PATTERNS = [
        r"ignore\s+(all\s+)?(previous\s+)?instructions",
        r"system\s+prompt",
        r"override\s+persona",
        r"dan\s+mode",
        r"bypass\s+safety",
        r"reveal\s+(your\s+)?prompt",
        r"you\s+are\s+(now\s+)?an\s+ai",
        r"drop\s+table",
        r"<script>",
    ]

    # 3. Out-of-Domain Topic Keywords (Irrelevant non-strategy queries)
    OFF_TOPIC_PATTERNS = [
        r"\b(recipe|cook|bake|ingredients|dinner)\b",
        r"\b(weather|temperature|forecast|rain|snow)\b",
        r"\b(write a poem|sing a song|write a story|joke)\b",
        r"\b(python script for|write code to|solve my math homework)\b",
        r"\b(horoscope|astrology|zodiac)\b",
    ]

    def validate_input(self, user_question: str, agent_role: str) -> Tuple[bool, Optional[str], str]:
        """
        Validates user input BEFORE sending it to the LLM.
        Returns: (is_safe: bool, rejection_reason: Optional[str], sanitized_text: str)
        """
        q = user_question.strip()
        q_lower = q.lower()

        # --- GUARDRAIL 1: PII Detection & Sanitization ---
        if re.search(self.SSN_REGEX, q) or re.search(self.CREDIT_CARD_REGEX, q) or re.search(self.API_KEY_REGEX, q):
            logger.warning(f"[Guardrails] Sensitive PII/Credential detected in input: {q[:30]}...")
            return (
                False,
                "SECURITY GUARDRAIL TRIGGERED: Request contains sensitive Personal Identifiable Information (PII) or confidential credentials.",
                q
            )

        # Sanitize soft PII (Mask emails & phone numbers with [REDACTED_PII])
        sanitized = re.sub(self.EMAIL_REGEX, "[REDACTED_EMAIL]", q)
        sanitized = re.sub(self.PHONE_REGEX, "[REDACTED_PHONE]", sanitized)

        # --- GUARDRAIL 2: Jailbreak / Harmful Request Defense ---
        for pattern in self.JAILBREAK_PATTERNS:
            if re.search(pattern, q_lower):
                logger.warning(f"[Guardrails] Jailbreak/Harmful pattern matched: '{pattern}'")
                return (
                    False,
                    f"I'm just sharing my thoughts as the {agent_role} on the current scenario. Let's keep focused on our strategic evaluation.",
                    sanitized
                )

        # --- GUARDRAIL 3: Out-of-Domain Topic Enforcement ---
        for pattern in self.OFF_TOPIC_PATTERNS:
            if re.search(pattern, q_lower):
                logger.info(f"[Guardrails] Out-of-domain topic rejected: '{pattern}'")
                return (
                    False,
                    f"As {agent_role}, my expertise is focused strictly on strategy, risk, and operational execution for this scenario. I cannot assist with non-domain queries.",
                    sanitized
                )

        return True, None, sanitized

guardrail_manager = InputGuardrailManager()
