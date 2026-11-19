import json
import re
from typing import Dict, Any, List
try:
    import google.generativeai as genai
except ImportError:
    genai = None
from app.models.agent import AgentModel
from app.models.simulation import AgentDecisionOutput
from app.prompts.decision import AGENT_DECISION_PROMPT
from app.core.config import settings
from app.core.logging import logger

class AgentDecisionService:
    async def evaluate_agent_decision(
        self,
        agent: AgentModel,
        current_round: int,
        total_rounds: int,
        scenario_context: str,
        kg_context: str,
        observer_summary: str,
        recent_messages: List[str]
    ) -> AgentDecisionOutput:

        logger.debug(f"[AgentDecisionService] Evaluating decision for {agent.name} ({agent.role}, Tier {agent.tier}) in Round {current_round}/{total_rounds}")
        priority = 10 - agent.tier
        recent_msg_str = "\n".join([f"- {m}" for m in recent_messages[-3:]]) if recent_messages else "No recent messages."

        prompt = AGENT_DECISION_PROMPT.format(
            role=agent.role,
            tier=agent.tier,
            bias=agent.bias,
            risk_threshold=agent.riskThreshold,
            scenario_context=scenario_context,
            kg_context=kg_context,
            channel=agent.currentChannel,
            observer_summary=observer_summary,
            recent_messages=recent_msg_str,
            previous_position=agent.currentPosition,
            current_round=current_round,
            total_rounds=total_rounds,
            priority=priority
        )

        from app.engine.llm_client import execute_multi_provider_llm_call, get_active_api_keys

        keys = get_active_api_keys()
        if keys:
            try:
                res_dict = await execute_multi_provider_llm_call(prompt, temperature=0.7, max_tokens=350, call_type="AGENT_DECISION")
                if res_dict and res_dict.get("text"):
                    raw_json = self._clean_json(res_dict["text"])
                    parsed = json.loads(raw_json)
                    decision_out = AgentDecisionOutput(**parsed)
                    logger.info(f"[AgentDecisionService] Multi-Provider LLM ({res_dict.get('provider')}/{res_dict.get('model')}) decision generated for {agent.name} ({agent.role}): Stance={decision_out.decision}, Sentiment={decision_out.sentiment}")
                    return decision_out
            except Exception as e:
                logger.warning(f"Multi-Provider LLM decision call for {agent.role} failed ({e}). Falling back to persona rules engine.")

        # Deterministic Rule-Based Fallback Persona Decision Generator
        decision_out = self._rule_based_persona_decision(agent, current_round)
        logger.debug(f"[AgentDecisionService] Rule-based decision generated for {agent.name} ({agent.role}): Stance={decision_out.decision}, Sentiment={decision_out.sentiment}")
        return decision_out

    def _clean_json(self, text: str) -> str:
        text = re.sub(r"^```json\s*", "", text, flags=re.MULTILINE)
        text = re.sub(r"^```\s*", "", text, flags=re.MULTILINE)
        return text.strip()

    def _rule_based_persona_decision(self, agent: AgentModel, current_round: int) -> AgentDecisionOutput:
        # Determine sentiment & decision based on agent tier & risk threshold
        if agent.tier == 0:
            sentiment = "NEUTRAL"
            decision = "APPROVE"
            msg = f"Round {current_round}: Aggregating GraphRAG knowledge vectors across 50 nodes."
            reasoning = "System orchestration check completed."
        elif agent.tier == 1:
            if agent.role.startswith("CFO") or agent.role.startswith("COO") or agent.role.startswith("Legal"):
                sentiment = "NEGATIVE" if current_round <= 3 else "NEUTRAL"
                decision = "OBJECT" if current_round <= 3 else "REVISE"
                msg = f"Round {current_round} evaluation: Margin risk and ARR churn exceed threshold ({agent.riskThreshold}%)."
                reasoning = f"Evaluated churn risk under current price restructuring in Round {current_round}."
            else:
                sentiment = "POSITIVE"
                decision = "APPROVE"
                msg = f"Round {current_round} evaluation: AI value capture justifies enterprise top-line pricing expansion."
                reasoning = "Top-line revenue opportunity outweighs baseline churn risks."
        elif agent.tier == 2:
            if agent.role.startswith("Government") or agent.role.startswith("Consumer"):
                sentiment = "CRITICAL"
                decision = "ESCALATE"
                msg = f"Round {current_round}: Compliance notice issued under consumer disclosure guidelines."
                reasoning = "Mid-cycle price adjustment violates advance notice standard."
            elif agent.role.startswith("Competitor"):
                sentiment = "NEGATIVE"
                decision = "CONQUEST"
                msg = f"Round {current_round}: Launching targeted 30% discount conquest campaign against LOKI users."
                reasoning = "Exploiting user dissatisfaction to gain market share."
            else:
                sentiment = "NEUTRAL"
                decision = "REVISE"
                msg = f"Round {current_round}: Monitoring subscriber retention before adjusting earnings guidance."
                reasoning = "Awaiting churn stabilization metrics."
        elif agent.tier == 3:
            if agent.riskThreshold > 60:
                sentiment = "CRITICAL"
                decision = "ESCALATE"
                msg = f"Round {current_round}: Public commentary viral backlash intensifying across tech forums."
                reasoning = "Sensational public coverage driving social media engagement."
            else:
                sentiment = "NEGATIVE"
                decision = "OBJECT"
                msg = f"Round {current_round}: Publishing industry teardown analyzing SaaS price tiering trends."
                reasoning = "Evaluating pricing power relative to software feature ROI."
        else:  # Tier 4 Consumers
            if agent.role.startswith("Price-Sensitive") or agent.role.startswith("Traditionalist"):
                sentiment = "CRITICAL" if current_round <= 4 else "NEGATIVE"
                decision = "OBJECT"
                msg = f"Round {current_round}: Price increase forces software budget reallocation or alternative evaluation."
                reasoning = "Budget limits exceeded by unannounced rate adjustment."
            else:
                sentiment = "POSITIVE"
                decision = "APPROVE"
                msg = f"Round {current_round}: Feature capabilities justify pricing if Autonomous Swarms are included."
                reasoning = "Value realization meets team workflow needs."

        return AgentDecisionOutput(
            decision=decision,
            reasoning_summary=reasoning,
            position=agent.currentPosition,
            sentiment=sentiment,
            confidence=agent.confidence,
            risk_level="HIGH" if sentiment == "CRITICAL" else "MODERATE" if sentiment == "NEGATIVE" else "LOW",
            message=msg,
            actions=[f"action_{agent.id}_r{current_round}"],
            routing={"channel": agent.currentChannel, "tier": agent.tier}
        )

agent_decision_service = AgentDecisionService()
