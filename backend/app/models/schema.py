import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    BigInteger,
    Float,
    Text,
    ForeignKey
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(String(255), primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    document_id = Column(String(255), nullable=True)
    created_date = Column(String(255), nullable=True)
    last_simulation = Column(String(255), nullable=True)
    status = Column(String(100), nullable=True)
    agent_count = Column(Integer, default=50)
    overall_risk_score = Column(Integer, default=50)

    # Relationships
    agents = relationship("Agent", back_populates="scenario", cascade="all, delete-orphan")
    graph_nodes = relationship("GraphNode", back_populates="scenario", cascade="all, delete-orphan")
    graph_edges = relationship("GraphEdge", back_populates="scenario", cascade="all, delete-orphan")
    rounds = relationship("SimulationRound", back_populates="scenario", cascade="all, delete-orphan")
    actions = relationship("AgentAction", back_populates="scenario", cascade="all, delete-orphan")
    feed_events = relationship("FeedEvent", back_populates="scenario", cascade="all, delete-orphan")
    risks = relationship("Risk", back_populates="scenario", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="scenario", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(255), primary_key=True)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(100), nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    chunk_count = Column(Integer, default=0)
    status = Column(String(100), default="READY")
    created_at = Column(String(255), nullable=True)

    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(String(255), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    char_length = Column(Integer, nullable=False)

    document = relationship("Document", back_populates="chunks")


class Agent(Base):
    __tablename__ = "agents"

    id = Column(String(255), primary_key=True)
    scenario_id = Column(String(255), ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=False)
    number_id = Column(Integer, nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(String(255), nullable=False)
    tier = Column(Integer, nullable=False)
    tier_name = Column(String(255), nullable=False)
    risk_threshold = Column(Integer, nullable=False)
    bias = Column(Text, nullable=False)
    current_state = Column(String(100), default="IDLE")
    current_channel = Column(String(100), default="BOARDROOM")
    current_position = Column(Text, nullable=False)
    sentiment = Column(String(100), default="NEUTRAL")
    confidence = Column(Integer, default=85)
    system_prompt = Column(Text, nullable=False)
    routing_attributes = Column(Text, nullable=True)
    metrics = Column(Text, nullable=True)
    initial_stance = Column(Float, default=0.0)
    final_stance = Column(Float, default=0.0)

    scenario = relationship("Scenario", back_populates="agents")


class GraphNode(Base):
    __tablename__ = "graph_nodes"

    id = Column(String(255), primary_key=True)
    scenario_id = Column(String(255), ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=False)
    label = Column(String(255), nullable=False)
    node_type = Column(String(255), nullable=False)
    entity_category = Column(String(255), nullable=True)
    agent_tier = Column(Integer, nullable=True)
    state = Column(String(100), nullable=True)
    x = Column(Float, nullable=True)
    y = Column(Float, nullable=True)
    val = Column(Integer, nullable=True)
    connections = Column(Text, nullable=True)
    source_document_id = Column(String(255), nullable=True)
    source_chunk = Column(Integer, nullable=True)

    scenario = relationship("Scenario", back_populates="graph_nodes")


class GraphEdge(Base):
    __tablename__ = "graph_edges"

    id = Column(String(255), primary_key=True)
    scenario_id = Column(String(255), ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=False)
    source = Column(String(255), nullable=False)
    target = Column(String(255), nullable=False)
    relationship_name = Column("relationship", String(255), nullable=False)
    strength = Column(Integer, default=3)
    confidence = Column(Float, default=0.9)
    source_chunk = Column(Integer, nullable=True)

    scenario = relationship("Scenario", back_populates="graph_edges")


class SimulationRound(Base):
    __tablename__ = "simulation_rounds"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scenario_id = Column(String(255), ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=False)
    round_number = Column(Integer, nullable=False)
    status = Column(String(100), nullable=False)
    active_agents = Column(Integer, default=50)
    summary = Column(Text, nullable=True)
    created_at = Column(String(255), nullable=True)

    scenario = relationship("Scenario", back_populates="rounds")


class AgentAction(Base):
    __tablename__ = "agent_actions"

    id = Column(String(255), primary_key=True)
    scenario_id = Column(String(255), ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=False)
    agent_id = Column(String(255), nullable=False)
    round = Column(Integer, nullable=False)
    action_type = Column(String(255), nullable=False)
    payload = Column(Text, nullable=True)
    timestamp = Column(String(255), nullable=True)

    scenario = relationship("Scenario", back_populates="actions")


class FeedEvent(Base):
    __tablename__ = "feed_events"

    id = Column(String(255), primary_key=True)
    scenario_id = Column(String(255), ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(String(255), nullable=False)
    agent_id = Column(String(255), nullable=False)
    agent_number_id = Column(Integer, nullable=False)
    role = Column(String(255), nullable=False)
    agent_name = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    sentiment = Column(String(100), nullable=False)
    channel = Column(String(100), nullable=False)
    round = Column(Integer, nullable=False)

    scenario = relationship("Scenario", back_populates="feed_events")


class Risk(Base):
    __tablename__ = "risks"

    id = Column(String(255), primary_key=True)
    scenario_id = Column(String(255), ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    score = Column(Integer, nullable=False)
    severity = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    impacted_agents_count = Column(Integer, default=0)

    scenario = relationship("Scenario", back_populates="risks")


class Report(Base):
    __tablename__ = "reports"

    id = Column(String(255), primary_key=True)
    scenario_id = Column(String(255), ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    generated_at = Column(String(255), nullable=False)
    executive_summary = Column(Text, nullable=False)
    payload = Column(Text, nullable=False)

    scenario = relationship("Scenario", back_populates="reports")


class ScenarioReport(Base):
    __tablename__ = "scenario_reports"

    scenario_id = Column(String(255), primary_key=True)
    risk_score = Column(Integer, nullable=False)
    pos_pct = Column(Float, nullable=False)
    neu_pct = Column(Float, nullable=False)
    neg_pct = Column(Float, nullable=False)
    crit_pct = Column(Float, nullable=False)
    total_agents = Column(Integer, nullable=False)
    primary_concern = Column(Text, nullable=True)
    executive_summary = Column(Text, nullable=True)
    audio_script = Column(Text, nullable=True)
    slides = Column(Text, nullable=True)
    key_risks = Column(Text, nullable=True)
    updated_at = Column(String(255), nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(255), primary_key=True)
    timestamp = Column(String(255), nullable=False)
    event_type = Column(String(255), nullable=False)
    actor = Column(String(255), nullable=False)
    details = Column(Text, nullable=False)
    scenario_id = Column(String(255), nullable=True)


class User(Base):
    __tablename__ = "users"

    id = Column(String(255), primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(Text, nullable=True)
    full_name = Column(String(255), nullable=True)
    picture = Column(Text, nullable=True)
    auth_provider = Column(String(100), default="LOCAL")
    is_verified = Column(Integer, default=0)
    created_at = Column(String(255), nullable=False)


class VerificationCode(Base):
    __tablename__ = "verification_codes"

    email = Column(String(255), primary_key=True)
    code = Column(String(100), nullable=False)
    expires_at = Column(String(255), nullable=False)
    created_at = Column(String(255), nullable=False)


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(String(255), primary_key=True)
    key_name = Column(String(255), nullable=False)
    provider = Column(String(100), nullable=False)
    api_key = Column(Text, nullable=False)
    status = Column(String(100), default="UNVERIFIED")
    is_primary = Column(Integer, default=0)
    created_at = Column(String(255), nullable=False)
    updated_at = Column(String(255), nullable=False)


class OasisSimulationStep(Base):
    __tablename__ = "oasis_simulation_steps"

    id = Column(String(255), primary_key=True)
    scenario_id = Column(String(255), nullable=True)
    agent_id = Column(String(255), nullable=False)
    agent_number_id = Column(Integer, nullable=False)
    archetype = Column(String(255), nullable=False)
    faction = Column(String(255), nullable=False)
    core_incentive = Column(Text, nullable=False)
    round_number = Column(Integer, nullable=False)
    action_type = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    perceived_feed = Column(Text, nullable=True)
    numerical_stance = Column(Float, nullable=False)
    created_at = Column(String(255), nullable=False)


class OasisAgentTrajectory(Base):
    __tablename__ = "oasis_agent_trajectories"

    agent_id = Column(String(255), primary_key=True)
    initial_stance = Column(Float, nullable=False)
    final_stance = Column(Float, nullable=False)
    stance_history = Column(Text, nullable=False)
    recent_posts = Column(Text, nullable=False)
    perceived_shock = Column(Text, nullable=False)
    updated_at = Column(String(255), nullable=False)

