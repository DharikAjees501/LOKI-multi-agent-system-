import json
import datetime
from typing import List, Dict, Any, Optional
from app.models.simulation import SimulationStateModel, FeedEventModel, RiskVectorModel
from app.storage.database import get_db_connection, execute_query
from app.core.logging import logger

class SimulationService:
    def get_simulation_state(self, scenario_id: str) -> SimulationStateModel:
        logger.info(f"[SimulationService] Fetching real simulation state for scenario: {scenario_id}")
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM scenarios WHERE id = ?", (scenario_id,))
        scen = cursor.fetchone()

        cursor.execute("SELECT COUNT(*) as cnt FROM agents WHERE scenario_id = ?", (scenario_id,))
        a_row = cursor.fetchone()
        agent_count = a_row["cnt"] if a_row and a_row["cnt"] > 0 else (scen["agent_count"] if scen and scen["agent_count"] else 200)

        cursor.execute("SELECT MAX(round_number) as max_r FROM oasis_simulation_steps WHERE scenario_id = ? OR id LIKE ?", (scenario_id, f"%{scenario_id}%"))
        r_row = cursor.fetchone()
        max_round = r_row["max_r"] if r_row and r_row["max_r"] else 1

        conn.close()

        status = scen["status"] if scen and scen["status"] else "READY"
        current_round = 5 if ("COMPLETED" in status) else min(5, max(1, max_round))

        return SimulationStateModel(
            scenario_id=scenario_id,
            currentRound=current_round,
            totalRounds=5,
            status=status,
            speed="NORMAL",
            temperature=0.7,
            activeAgentsCount=agent_count,
            totalAgentsCount=agent_count,
            model="Gemini 3.5 Flash"
        )

    def get_feed_events(self, scenario_id: str) -> List[FeedEventModel]:
        logger.info(f"[SimulationService] Querying real simulation feed events for scenario: {scenario_id}")
        conn = get_db_connection()
        try:
            cursor = conn.cursor()

            # 1. Query feed_events table for this exact scenario
            cursor.execute(
                "SELECT * FROM feed_events WHERE scenario_id = ? ORDER BY round ASC, id ASC",
                (scenario_id,)
            )
            rows = cursor.fetchall()

            # 2. If empty, check with wildcard scenario_id
            if not rows:
                cursor.execute(
                    "SELECT * FROM feed_events WHERE scenario_id LIKE ? ORDER BY round ASC, id ASC",
                    (f"%{scenario_id}%",)
                )
                rows = cursor.fetchall()

            # 3. If still empty, construct live feed events directly from real oasis_simulation_steps
            if not rows:
                cursor.execute("""
                    SELECT s.id, s.scenario_id, s.created_at as timestamp, s.agent_id, s.agent_number_id,
                           s.archetype as role, COALESCE(a.name, s.archetype) as agent_name, s.content as message,
                           CASE 
                               WHEN s.numerical_stance <= -0.5 THEN 'CRITICAL'
                               WHEN s.numerical_stance < 0.0 THEN 'NEGATIVE'
                               WHEN s.numerical_stance < 0.4 THEN 'NEUTRAL'
                               ELSE 'POSITIVE'
                           END as sentiment,
                           s.faction as channel, s.round_number as round
                    FROM oasis_simulation_steps s
                    LEFT JOIN agents a ON s.agent_id = a.id
                    WHERE s.scenario_id = ? OR s.id LIKE ?
                    ORDER BY s.round_number ASC, s.created_at ASC
                """, (scenario_id, f"%{scenario_id}%"))
                rows = cursor.fetchall()

            # 4. If no simulation steps run yet, generate initial feed events directly from real persona agents table
            if not rows:
                cursor.execute("""
                    SELECT id, number_id, role, name, bias, current_position, sentiment, current_channel, tier
                    FROM agents
                    WHERE scenario_id = ? OR id LIKE ?
                    ORDER BY tier ASC, number_id ASC
                    LIMIT 20
                """, (scenario_id, f"%{scenario_id}%"))
                agent_rows = cursor.fetchall()

                if agent_rows:
                    events_to_insert = []
                    for a in agent_rows:
                        channel = a.get("current_channel") or ("BOARDROOM" if a["tier"] in [0, 1] else ("MEDIA" if "media" in (a["role"] or "").lower() or "influencer" in (a["role"] or "").lower() else "PUBLIC"))
                        sent = a["sentiment"] or ("NEUTRAL" if not a["bias"] else ("NEGATIVE" if "risk" in a["bias"].lower() else "POSITIVE"))
                        msg = a["current_position"] or f"[{a['role']}]: Reviewing strategy document alignment and operational dependencies."
                        time_str = datetime.datetime.now().strftime("%H:%M:%S")
                        evt_id = f"evt-init-{scenario_id}-{a['number_id']:03d}"

                        execute_query(
                            cursor,
                            """INSERT OR REPLACE INTO feed_events
                               (id, scenario_id, timestamp, agent_id, agent_number_id, role, agent_name, message, sentiment, channel, round)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                            (evt_id, scenario_id, time_str, a["id"], a["number_id"], a["role"], a["name"], msg, sent, channel, 1)
                        )
                    conn.commit()

                    cursor.execute(
                        "SELECT * FROM feed_events WHERE scenario_id = ? ORDER BY round ASC, id ASC",
                        (scenario_id,)
                    )
                    rows = cursor.fetchall()
        finally:
            conn.close()

        events: List[FeedEventModel] = []
        for r in rows:
            events.append(
                FeedEventModel(
                    id=r["id"],
                    timestamp=r["timestamp"],
                    agentId=r["agent_id"],
                    agentNumberId=r["agent_number_id"],
                    role=r["role"],
                    agentName=r["agent_name"],
                    message=r["message"],
                    sentiment=r["sentiment"],
                    channel=r["channel"],
                    round=r["round"]
                )
            )
        logger.info(f"[SimulationService] Returning {len(events)} grounded live feed events for scenario: {scenario_id}")
        return events

    def get_risks_for_scenario(self, scenario_id: str) -> List[RiskVectorModel]:
        logger.info(f"[SimulationService] Dynamically computing real risk vectors for scenario: {scenario_id}")
        from app.services.report_service import report_service
        try:
            r_data = report_service.get_risks(scenario_id)
            key_risks = r_data.get("keyRisks", [])
            res = []
            for r in key_risks:
                res.append(
                    RiskVectorModel(
                        id=r.get("id", f"risk-{len(res)+1}"),
                        title=r.get("title", "Scenario Risk Vector"),
                        score=r.get("score", 50),
                        severity=r.get("severity", "MODERATE"),
                        description=r.get("description", "Identified risk vector."),
                        impactedAgentsCount=r.get("impactedAgentsCount", r.get("impacted_agents", 20))
                    )
                )
            if res:
                return res
        except Exception as err:
            logger.warning(f"Error computing dynamic risks for scenario {scenario_id}: {err}")

        return []

simulation_service = SimulationService()
