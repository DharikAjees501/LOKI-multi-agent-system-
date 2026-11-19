"""initial schema with all 18 tables

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-11-17 17:59:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Scenarios
    op.create_table(
        'scenarios',
        sa.Column('id', sa.String(length=255), primary_key=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('document_id', sa.String(length=255), nullable=True),
        sa.Column('created_date', sa.String(length=255), nullable=True),
        sa.Column('last_simulation', sa.String(length=255), nullable=True),
        sa.Column('status', sa.String(length=100), nullable=True),
        sa.Column('agent_count', sa.Integer(), nullable=True, server_default='50'),
        sa.Column('overall_risk_score', sa.Integer(), nullable=True, server_default='50')
    )

    # 2. Documents
    op.create_table(
        'documents',
        sa.Column('id', sa.String(length=255), primary_key=True, nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('file_type', sa.String(length=100), nullable=False),
        sa.Column('size_bytes', sa.BigInteger(), nullable=False),
        sa.Column('chunk_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('status', sa.String(length=100), nullable=True, server_default='READY'),
        sa.Column('created_at', sa.String(length=255), nullable=True)
    )

    # 3. Document Chunks
    op.create_table(
        'document_chunks',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('document_id', sa.String(length=255), sa.ForeignKey('documents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('char_length', sa.Integer(), nullable=False)
    )

    # 4. Agents
    op.create_table(
        'agents',
        sa.Column('id', sa.String(length=255), primary_key=True, nullable=False),
        sa.Column('scenario_id', sa.String(length=255), sa.ForeignKey('scenarios.id', ondelete='CASCADE'), nullable=False),
        sa.Column('number_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=255), nullable=False),
        sa.Column('tier', sa.Integer(), nullable=False),
        sa.Column('tier_name', sa.String(length=255), nullable=False),
        sa.Column('risk_threshold', sa.Integer(), nullable=False),
        sa.Column('bias', sa.Text(), nullable=False),
        sa.Column('current_state', sa.String(length=100), nullable=True, server_default='IDLE'),
        sa.Column('current_channel', sa.String(length=100), nullable=True, server_default='BOARDROOM'),
        sa.Column('current_position', sa.Text(), nullable=False),
        sa.Column('sentiment', sa.String(length=100), nullable=True, server_default='NEUTRAL'),
        sa.Column('confidence', sa.Integer(), nullable=True, server_default='85'),
        sa.Column('system_prompt', sa.Text(), nullable=False),
        sa.Column('routing_attributes', sa.Text(), nullable=True),
        sa.Column('metrics', sa.Text(), nullable=True),
        sa.Column('initial_stance', sa.Float(), nullable=True, server_default='0.0'),
        sa.Column('final_stance', sa.Float(), nullable=True, server_default='0.0')
    )

    # 5. Graph Nodes
    op.create_table(
        'graph_nodes',
        sa.Column('id', sa.String(length=255), primary_key=True, nullable=False),
        sa.Column('scenario_id', sa.String(length=255), sa.ForeignKey('scenarios.id', ondelete='CASCADE'), nullable=False),
        sa.Column('label', sa.String(length=255), nullable=False),
        sa.Column('node_type', sa.String(length=255), nullable=False),
        sa.Column('entity_category', sa.String(length=255), nullable=True),
        sa.Column('agent_tier', sa.Integer(), nullable=True),
        sa.Column('state', sa.String(length=100), nullable=True),
        sa.Column('x', sa.Float(), nullable=True),
        sa.Column('y', sa.Float(), nullable=True),
        sa.Column('val', sa.Integer(), nullable=True),
        sa.Column('connections', sa.Text(), nullable=True),
        sa.Column('source_document_id', sa.String(length=255), nullable=True),
        sa.Column('source_chunk', sa.Integer(), nullable=True)
    )

    # 6. Graph Edges
    op.create_table(
        'graph_edges',
        sa.Column('id', sa.String(length=255), primary_key=True, nullable=False),
        sa.Column('scenario_id', sa.String(length=255), sa.ForeignKey('scenarios.id', ondelete='CASCADE'), nullable=False),
        sa.Column('source', sa.String(length=255), nullable=False),
        sa.Column('target', sa.String(length=255), nullable=False),
        sa.Column('relationship', sa.String(length=255), nullable=False),
        sa.Column('strength', sa.Integer(), nullable=True, server_default='3'),
        sa.Column('confidence', sa.Float(), nullable=True, server_default='0.9'),
        sa.Column('source_chunk', sa.Integer(), nullable=True)
    )

    # 7. Simulation Rounds
    op.create_table(
        'simulation_rounds',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('scenario_id', sa.String(length=255), sa.ForeignKey('scenarios.id', ondelete='CASCADE'), nullable=False),
        sa.Column('round_number', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=100), nullable=False),
        sa.Column('active_agents', sa.Integer(), nullable=True, server_default='50'),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('created_at', sa.String(length=255), nullable=True)
    )

    # 8. Agent Actions
    op.create_table(
        'agent_actions',
        sa.Column('id', sa.String(length=255), primary_key=True, nullable=False),
        sa.Column('scenario_id', sa.String(length=255), sa.ForeignKey('scenarios.id', ondelete='CASCADE'), nullable=False),
        sa.Column('agent_id', sa.String(length=255), nullable=False),
        sa.Column('round', sa.Integer(), nullable=False),
        sa.Column('action_type', sa.String(length=255), nullable=False),
        sa.Column('payload', sa.Text(), nullable=True),
        sa.Column('timestamp', sa.String(length=255), nullable=True)
    )

    # 9. Feed Events
    op.create_table(
        'feed_events',
        sa.Column('id', sa.String(length=255), primary_key=True, nullable=False),
        sa.Column('scenario_id', sa.String(length=255), sa.ForeignKey('scenarios.id', ondelete='CASCADE'), nullable=False),
        sa.Column('timestamp', sa.String(length=255), nullable=False),
        sa.Column('agent_id', sa.String(length=255), nullable=False),
        sa.Column('agent_number_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=255), nullable=False),
        sa.Column('agent_name', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('sentiment', sa.String(length=100), nullable=False),
        sa.Column('channel', sa.String(length=100), nullable=False),
        sa.Column('round', sa.Integer(), nullable=False)
    )

    # 10. Risks
    op.create_table(
        'risks',
        sa.Column('id', sa.String(length=255), primary_key=True, nullable=False),
        sa.Column('scenario_id', sa.String(length=255), sa.ForeignKey('scenarios.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('score', sa.Integer(), nullable=False),
        sa.Column('severity', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('impacted_agents_count', sa.Integer(), nullable=True, server_default='0')
    )

    # 11. Reports
    op.create_table(
        'reports',
        sa.Column('id', sa.String(length=255), primary_key=True, nullable=False),
        sa.Column('scenario_id', sa.String(length=255), sa.ForeignKey('scenarios.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('generated_at', sa.String(length=255), nullable=False),
        sa.Column('executive_summary', sa.Text(), nullable=False),
        sa.Column('payload', sa.Text(), nullable=False)
    )

    # 12. Scenario Reports
    op.create_table(
        'scenario_reports',
        sa.Column('scenario_id', sa.String(length=255), primary_key=True, nullable=False),
        sa.Column('risk_score', sa.Integer(), nullable=False),
        sa.Column('pos_pct', sa.Float(), nullable=False),
        sa.Column('neu_pct', sa.Float(), nullable=False),
        sa.Column('neg_pct', sa.Float(), nullable=False),
        sa.Column('crit_pct', sa.Float(), nullable=False),
        sa.Column('total_agents', sa.Integer(), nullable=False),
        sa.Column('primary_concern', sa.Text(), nullable=True),
        sa.Column('executive_summary', sa.Text(), nullable=True),
        sa.Column('audio_script', sa.Text(), nullable=True),
        sa.Column('slides', sa.Text(), nullable=True),
        sa.Column('key_risks', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.String(length=255), nullable=True)
    )

    # 13. Audit Logs
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.String(length=255), primary_key=True, nullable=False),
        sa.Column('timestamp', sa.String(length=255), nullable=False),
        sa.Column('event_type', sa.String(length=255), nullable=False),
        sa.Column('actor', sa.String(length=255), nullable=False),
        sa.Column('details', sa.Text(), nullable=False),
        sa.Column('scenario_id', sa.String(length=255), nullable=True)
    )

    # 14. Users
    op.create_table(
        'users',
        sa.Column('id', sa.String(length=255), primary_key=True, nullable=False),
        sa.Column('email', sa.String(length=255), unique=True, nullable=False),
        sa.Column('password_hash', sa.Text(), nullable=True),
        sa.Column('full_name', sa.String(length=255), nullable=True),
        sa.Column('picture', sa.Text(), nullable=True),
        sa.Column('auth_provider', sa.String(length=100), nullable=True, server_default='LOCAL'),
        sa.Column('is_verified', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('created_at', sa.String(length=255), nullable=False)
    )

    # 15. Verification Codes
    op.create_table(
        'verification_codes',
        sa.Column('email', sa.String(length=255), primary_key=True, nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('expires_at', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.String(length=255), nullable=False)
    )

    # 16. API Keys
    op.create_table(
        'api_keys',
        sa.Column('id', sa.String(length=255), primary_key=True, nullable=False),
        sa.Column('key_name', sa.String(length=255), nullable=False),
        sa.Column('provider', sa.String(length=100), nullable=False),
        sa.Column('api_key', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=100), nullable=True, server_default='UNVERIFIED'),
        sa.Column('is_primary', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('created_at', sa.String(length=255), nullable=False),
        sa.Column('updated_at', sa.String(length=255), nullable=False)
    )

    # 17. Oasis Simulation Steps
    op.create_table(
        'oasis_simulation_steps',
        sa.Column('id', sa.String(length=255), primary_key=True, nullable=False),
        sa.Column('scenario_id', sa.String(length=255), nullable=True),
        sa.Column('agent_id', sa.String(length=255), nullable=False),
        sa.Column('agent_number_id', sa.Integer(), nullable=False),
        sa.Column('archetype', sa.String(length=255), nullable=False),
        sa.Column('faction', sa.String(length=255), nullable=False),
        sa.Column('core_incentive', sa.Text(), nullable=False),
        sa.Column('round_number', sa.Integer(), nullable=False),
        sa.Column('action_type', sa.String(length=100), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('perceived_feed', sa.Text(), nullable=True),
        sa.Column('numerical_stance', sa.Float(), nullable=False),
        sa.Column('created_at', sa.String(length=255), nullable=False)
    )

    # 18. Oasis Agent Trajectories
    op.create_table(
        'oasis_agent_trajectories',
        sa.Column('agent_id', sa.String(length=255), primary_key=True, nullable=False),
        sa.Column('initial_stance', sa.Float(), nullable=False),
        sa.Column('final_stance', sa.Float(), nullable=False),
        sa.Column('stance_history', sa.Text(), nullable=False),
        sa.Column('recent_posts', sa.Text(), nullable=False),
        sa.Column('perceived_shock', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.String(length=255), nullable=False)
    )


def downgrade() -> None:
    # Drop tables in reverse dependency order
    op.drop_table('oasis_agent_trajectories')
    op.drop_table('oasis_simulation_steps')
    op.drop_table('api_keys')
    op.drop_table('verification_codes')
    op.drop_table('users')
    op.drop_table('audit_logs')
    op.drop_table('scenario_reports')
    op.drop_table('reports')
    op.drop_table('risks')
    op.drop_table('feed_events')
    op.drop_table('agent_actions')
    op.drop_table('simulation_rounds')
    op.drop_table('graph_edges')
    op.drop_table('graph_nodes')
    op.drop_table('agents')
    op.drop_table('document_chunks')
    op.drop_table('documents')
    op.drop_table('scenarios')

