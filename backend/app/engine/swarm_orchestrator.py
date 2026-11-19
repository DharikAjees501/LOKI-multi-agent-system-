import asyncio
import json
import datetime
from typing import Dict, List, Any, Optional, Callable
from app.models.agent import AgentModel
from app.models.simulation import SimulationStateModel, FeedEventModel, AgentDecisionOutput
from app.services.persona_service import persona_service
from app.services.agent_decision_service import agent_decision_service
from app.services.graph_service import graph_service
from app.engine.observer import observer_engine
from app.storage.database import get_db_connection
from app.core.logging import logger

import inspect

class SwarmOrchestrator:
    def __init__(self, max_concurrency: int = 10):
        self.semaphore = asyncio.Semaphore(max_concurrency)

        self.status: str = "IDLE"  # IDLE, RUNNING, PAUSED, STEPPING, COMPLETED
        self.current_round: int = 0
        self.total_rounds: int = 10
        self.scenario_id: str = ""
        self.agents: List[AgentModel] = []
        self.websocket_broadcaster: Optional[Callable[[dict], Any]] = None
        self.channel_events: Dict[str, List[Dict[str, Any]]] = {
            "BOARDROOM": [],
            "MEDIA": [],
            "PUBLIC": []
        }
        self.channel_summaries: Dict[str, str] = {}

    def set_websocket_broadcaster(self, broadcaster_fn: Callable[[dict], Any]):
        self.websocket_broadcaster = broadcaster_fn

    async def emit_ws(self, event_type: str, data: dict):
        if self.websocket_broadcaster:
            try:
                msg = {
                    "event": event_type,
                    "scenario_id": self.scenario_id,
                    "round": self.current_round,
                    "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
                    "data": data
                }
                if inspect.iscoroutinefunction(self.websocket_broadcaster):
                    await self.websocket_broadcaster(msg)
                else:
                    self.websocket_broadcaster(msg)
            except Exception as e:
                logger.warning(f"Error emitting WebSocket event {event_type}: {e}")

    async def initialize_simulation(self, scenario_id: str, total_rounds: int = 10):
        self.scenario_id = scenario_id
        self.total_rounds = total_rounds
        self.current_round = 0
        self.status = "IDLE"

        # Load 200 personas
        self.agents = persona_service.get_agents_for_scenario(scenario_id)
        self.channel_events = {"BOARDROOM": [], "MEDIA": [], "PUBLIC": []}
        self.channel_summaries = {}

        logger.info(f"[SwarmOrchestrator] Initialized scenario {scenario_id} with {len(self.agents)} agents and {total_rounds} rounds.")
        await self.emit_ws("simulation_started", {"status": "INITIALIZED", "total_agents": len(self.agents)})

    async def play(self):
        if self.status == "RUNNING":
            return
        self.status = "RUNNING"
        logger.info(f"[SwarmOrchestrator] Simulation STARTED for scenario {self.scenario_id}")
        await self.emit_ws("simulation_started", {"status": "RUNNING", "current_round": self.current_round})

        while self.status == "RUNNING" and self.current_round < self.total_rounds:
            await self.execute_next_round()
            await asyncio.sleep(1.0)  # Brief tick pause between rounds

        if self.current_round >= self.total_rounds:
            self.status = "COMPLETED"
            logger.info(f"[SwarmOrchestrator] Simulation COMPLETED for scenario {self.scenario_id}")
            await self.emit_ws("simulation_completed", {"status": "COMPLETED", "total_rounds": self.total_rounds})

    async def pause(self):
        self.status = "PAUSED"
        logger.info(f"[SwarmOrchestrator] Simulation PAUSED at round {self.current_round}")
        await self.emit_ws("simulation_state_changed", {"status": "PAUSED", "current_round": self.current_round})

    async def step(self):
        if self.current_round >= self.total_rounds:
            return
        old_status = self.status
        self.status = "STEPPING"
        logger.info(f"[SwarmOrchestrator] Executing STEP for round {self.current_round + 1}")
        await self.execute_next_round()
        self.status = "PAUSED"
        await self.emit_ws("simulation_state_changed", {"status": "PAUSED", "current_round": self.current_round})

    async def reset(self):
        self.current_round = 0
        self.status = "IDLE"
        self.channel_events = {"BOARDROOM": [], "MEDIA": [], "PUBLIC": []}
        self.channel_summaries = {}
        logger.info(f"[SwarmOrchestrator] Simulation RESET to round 0")
        await self.emit_ws("simulation_state_changed", {"status": "IDLE", "current_round": 0})

    async def execute_next_round(self):
        self.current_round += 1
        r_num = self.current_round

        logger.info(f"[SwarmOrchestrator] ===== STARTING ROUND {r_num} / {self.total_rounds} =====")
        await self.emit_ws("round_started", {"round": r_num})

        # Fetch Knowledge Graph summary context
        kg_res = graph_service.get_scenario_graph(self.scenario_id)
        kg_summary = f"Entities ({len(kg_res.nodes)}): " + ", ".join([n.label for n in kg_res.nodes[:5]])

        # Execute Agent Decision Loops with Concurrency Control (asyncio.Semaphore(5))
        tasks = []
        for agent in self.agents:
            tasks.append(self._process_single_agent_decision(agent, r_num, kg_summary))

        results = await asyncio.gather(*tasks)

        # Process Top-Down & Bottom-Up Cascade
        self._apply_channel_cascades(r_num, results)

        # Observer Summary Generation for Round Boundary
        self.channel_summaries = observer_engine.generate_channel_summaries(r_num, self.channel_events)

        # Persist Round Record to SQLite
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO simulation_rounds (scenario_id, round_number, status, active_agents, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (self.scenario_id, r_num, "COMPLETED", len(self.agents), json.dumps(self.channel_summaries), datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            )
            conn.commit()
        finally:
            conn.close()

        await self.emit_ws("round_summary", {"round": r_num, "summaries": self.channel_summaries})
        await self.emit_ws("round_completed", {"round": r_num, "total_events": sum(len(v) for v in self.channel_events.values())})

    async def _process_single_agent_decision(self, agent: AgentModel, r_num: int, kg_summary: str) -> AgentDecisionOutput:
        # Enforce concurrency semaphore limit (max 5)
        async with self.semaphore:
            await self.emit_ws("agent_thinking", {"agent_id": agent.id, "role": agent.role, "round": r_num})

            ch_summary = self.channel_summaries.get(agent.currentChannel, "Initial simulation round setup.")
            recent_msgs = [e["message"] for e in self.channel_events.get(agent.currentChannel, [])[-3:]]

            # LLM / Rule decision evaluation
            decision = await agent_decision_service.evaluate_agent_decision(
                agent=agent,
                current_round=r_num,
                total_rounds=self.total_rounds,
                scenario_context="Enterprise Pricing Restructure +25% baseline escalation.",
                kg_context=kg_summary,
                observer_summary=ch_summary,
                recent_messages=recent_msgs
            )

            # Update Agent State
            agent.currentState = "ALERT" if decision.sentiment == "CRITICAL" else "ACTIVE" if decision.sentiment == "POSITIVE" else "RESPONDING"
            agent.sentiment = decision.sentiment
            agent.confidence = decision.confidence
            agent.currentPosition = decision.position

            timestamp = datetime.datetime.now().strftime("%H:%M:%S")

            # OASIS Engine persistence step
            try:
                from app.engine.oasis_engine import oasis_engine
                await oasis_engine._process_oasis_agent(
                    agent, r_num, r_num == 3,
                    "CRITICAL SHOCK: Unannounced +35% Enterprise SaaS License Price Increase & Data Sovereignty Audit Announced!"
                )
            except Exception as o_err:
                logger.warning(f"[OASIS Persistence Warning]: {o_err}")

            # Record Feed Event
            event_obj = {
                "id": f"evt-r{r_num}-{agent.id}",
                "timestamp": timestamp,
                "agentId": agent.id,
                "agentNumberId": agent.numberId,
                "role": agent.role,
                "agentName": agent.name,
                "message": decision.message,
                "sentiment": decision.sentiment,
                "channel": agent.currentChannel,
                "round": r_num
            }

            self.channel_events[agent.currentChannel].append(event_obj)

            # Persist to DB
            conn = get_db_connection()
            try:
                cursor = conn.cursor()
                cursor.execute(
                    """INSERT OR REPLACE INTO feed_events
                       (id, scenario_id, timestamp, agent_id, agent_number_id, role, agent_name, message, sentiment, channel, round)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (event_obj["id"], self.scenario_id, timestamp, agent.id, agent.numberId, agent.role, agent.name, decision.message, decision.sentiment, agent.currentChannel, r_num)
                )
                cursor.execute(
                    """INSERT OR REPLACE INTO agent_actions (id, scenario_id, agent_id, round, action_type, payload, timestamp)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (f"act-{self.scenario_id}-r{r_num}-{agent.id}", self.scenario_id, agent.id, r_num, decision.decision, json.dumps(decision.model_dump()), timestamp)
                )
                conn.commit()
            finally:
                conn.close()

            await self.emit_ws("agent_message", event_obj)
            await self.emit_ws("agent_state_changed", {"agent_id": agent.id, "state": agent.currentState, "sentiment": agent.sentiment})

            return decision


    def _apply_channel_cascades(self, r_num: int, decisions: List[AgentDecisionOutput]):
        # 1. Top-Down Cascade: Channel 1 Executive decision -> Channel 2 Media leak / press reaction
        boardroom_criticals = [d for d in decisions if d.routing.get("channel") == "BOARDROOM" and d.sentiment in ["CRITICAL", "NEGATIVE"]]
        if boardroom_criticals:
            logger.info(f"[Cascade] Top-Down trigger: Executive dissent detected in Round {r_num}. Escalating to Media Room.")
            self.channel_events["MEDIA"].append({
                "id": f"cascade-td-r{r_num}",
                "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
                "agentId": "agent-19",
                "agentNumberId": 19,
                "role": "INVESTIGATIVE JOURNALIST",
                "agentName": "Agent 19",
                "message": f"BREAKING LEAK (Round {r_num}): Executive Boardroom split on pricing risk mitigation.",
                "sentiment": "CRITICAL",
                "channel": "MEDIA",
                "round": r_num
            })

        # 2. Bottom-Up Feedback: Channel 3 Public backlash -> Channel 1 Executive Board notification
        public_criticals = [d for d in decisions if d.routing.get("channel") == "PUBLIC" and d.sentiment == "CRITICAL"]
        if len(public_criticals) >= 3:
            logger.info(f"[Cascade] Bottom-Up trigger: Public backlash spike ({len(public_criticals)} criticals) in Round {r_num}. Notifying Boardroom.")
            self.channel_events["BOARDROOM"].append({
                "id": f"cascade-bu-r{r_num}",
                "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
                "agentId": "agent-10",
                "agentNumberId": 10,
                "role": "CRO",
                "agentName": "Agent 10",
                "message": f"SYSTEM RISK ALERT (Round {r_num}): Public forum critical backlash index exceeds tolerance threshold.",
                "sentiment": "CRITICAL",
                "channel": "BOARDROOM",
                "round": r_num
            })

orchestrator_engine = SwarmOrchestrator()
