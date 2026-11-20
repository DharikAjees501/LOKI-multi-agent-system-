import os
import json
import sqlite3
import datetime
import re
from contextlib import contextmanager
from typing import List, Dict, Any, Optional

try:
    import psycopg2
    import psycopg2.extras
    import psycopg2.pool
except ImportError:
    psycopg2 = None

from app.core.config import settings
from app.core.logging import logger

IS_POSTGRES = settings.DATABASE_URL.startswith("postgresql://") or settings.DATABASE_URL.startswith("postgres://")

def get_clean_database_url() -> str:
    url = (settings.DATABASE_URL or "").strip()
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    # Automatically add sslmode=require for Render, Neon, or remote postgres
    if ("render.com" in url or "neon.tech" in url or "aws" in url or "dpg-" in url) and "sslmode=" not in url:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}sslmode=require"
    # Enforce connect_timeout so queries never block or hang for 300s
    if "connect_timeout=" not in url:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}connect_timeout=8"
    return url

if IS_POSTGRES and psycopg2:
    class AutoParamRealDictCursor(psycopg2.extras.RealDictCursor):
        def _adapt_query(self, query: str) -> str:
            if not isinstance(query, str):
                return query
            if "%" in query:
                # Escape literal % that are not parameter placeholders like %s or %(var)s
                query = re.sub(r'%(?![s(])', '%%', query)
            if "?" in query:
                query = query.replace("?", "%s")
            if "INSERT OR REPLACE INTO" in query:
                query = query.replace("INSERT OR REPLACE INTO", "INSERT INTO")
                if "ON CONFLICT" not in query:
                    if "oasis_agent_trajectories" in query:
                        query += " ON CONFLICT (agent_id) DO UPDATE SET initial_stance = EXCLUDED.initial_stance, final_stance = EXCLUDED.final_stance, stance_history = EXCLUDED.stance_history, recent_posts = EXCLUDED.recent_posts, perceived_shock = EXCLUDED.perceived_shock, updated_at = EXCLUDED.updated_at"
                    elif "verification_codes" in query:
                        query += " ON CONFLICT (email) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, created_at = EXCLUDED.created_at"
                    elif "scenario_reports" in query:
                        query += " ON CONFLICT (scenario_id) DO UPDATE SET risk_score = EXCLUDED.risk_score, pos_pct = EXCLUDED.pos_pct, neu_pct = EXCLUDED.neu_pct, neg_pct = EXCLUDED.neg_pct, crit_pct = EXCLUDED.crit_pct, total_agents = EXCLUDED.total_agents, primary_concern = EXCLUDED.primary_concern, executive_summary = EXCLUDED.executive_summary, audio_script = EXCLUDED.audio_script, slides = EXCLUDED.slides, key_risks = EXCLUDED.key_risks, updated_at = EXCLUDED.updated_at"
                    else:
                        query += " ON CONFLICT DO NOTHING"
            return query

        def execute(self, query, vars=None):
            query = self._adapt_query(query)
            if vars is not None:
                return super().execute(query, vars)
            return super().execute(query)

        def executemany(self, query, vars_list):
            query = self._adapt_query(query)
            return super().executemany(query, vars_list)

    class PGConnectionWrapper:
        def __init__(self, raw_conn, pool=None):
            self._raw_conn = raw_conn
            self._pool = pool
            self._closed = False
            if hasattr(self._raw_conn, "autocommit"):
                try:
                    if hasattr(self._raw_conn, "rollback") and not self._raw_conn.autocommit:
                        self._raw_conn.rollback()
                    self._raw_conn.autocommit = True
                except Exception:
                    pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_val, exc_tb):
            self.close()

        def cursor(self, *args, **kwargs):
            if self._closed or not self._raw_conn:
                raise psycopg2.InterfaceError("Connection is closed")
            return self._raw_conn.cursor(*args, **kwargs)

        def commit(self):
            if self._raw_conn and not self._closed:
                try:
                    if not self._raw_conn.autocommit:
                        self._raw_conn.commit()
                except Exception:
                    pass

        def rollback(self):
            if self._raw_conn and not self._closed:
                try:
                    self._raw_conn.rollback()
                except Exception:
                    pass

        def close(self):
            if self._closed:
                return
            self._closed = True
            if self._raw_conn and hasattr(self._raw_conn, "rollback"):
                try:
                    if not getattr(self._raw_conn, "autocommit", True):
                        self._raw_conn.rollback()
                except Exception:
                    pass
            if self._pool and self._raw_conn:
                try:
                    self._pool.putconn(self._raw_conn)
                except Exception:
                    pass
                finally:
                    self._raw_conn = None
            elif self._raw_conn:
                try:
                    self._raw_conn.close()
                except Exception:
                    pass
                finally:
                    self._raw_conn = None

        def __getattr__(self, name):
            if self._closed or not self._raw_conn:
                raise psycopg2.InterfaceError("Connection is closed")
            return getattr(self._raw_conn, name)

_pg_pool = None
_conn_created_at = {}

def get_pg_pool():
    global _pg_pool
    if _pg_pool is None and IS_POSTGRES and psycopg2:
        try:
            clean_url = get_clean_database_url()
            # Scaled connection pool: minconn=1, maxconn=10 for serverless & cloud reliability
            _pg_pool = psycopg2.pool.ThreadedConnectionPool(
                minconn=1,
                maxconn=10,
                dsn=clean_url,
                cursor_factory=AutoParamRealDictCursor
            )
            logger.info("[PostgreSQL Pool] Connection pool initialized (minconn=1, maxconn=10).")
        except Exception as pool_err:
            logger.warning(f"[PostgreSQL Pool Init Warning]: {pool_err}")
            _pg_pool = None
    return _pg_pool

def get_db_connection():
    if IS_POSTGRES and psycopg2:
        try:
            pool = get_pg_pool()
            if pool:
                import time
                start_wait = time.time()
                timeout = 6.0  # pool_timeout = 6s before fallback
                raw_conn = None

                while time.time() - start_wait < timeout:
                    try:
                        raw_conn = pool.getconn()
                        break
                    except psycopg2.pool.PoolError:
                        time.sleep(0.05)
                    except Exception as ge:
                        logger.debug(f"[PostgreSQL Pool Checkout Notice]: {ge}")
                        time.sleep(0.05)

                if raw_conn:
                    # Connection pre-ping & recycle validation
                    conn_id = id(raw_conn)
                    conn_age = time.time() - _conn_created_at.get(conn_id, time.time())
                    is_healthy = True

                    # 1. pool_recycle: recycle connection if older than 1800s (30m)
                    if conn_age > 1800.0:
                        try:
                            pool.putconn(raw_conn, close=True)
                            raw_conn = pool.getconn()
                            _conn_created_at[id(raw_conn)] = time.time()
                        except Exception:
                            is_healthy = False

                    # 2. pool_pre_ping: test liveness before delivering to caller
                    if is_healthy:
                        try:
                            if raw_conn.closed != 0:
                                is_healthy = False
                            else:
                                if hasattr(raw_conn, "rollback") and not getattr(raw_conn, "autocommit", False):
                                     raw_conn.rollback()
                                raw_conn.autocommit = True
                                with raw_conn.cursor() as cur:
                                    cur.execute("SELECT 1;")
                        except Exception:
                            is_healthy = False

                    if not is_healthy:
                        try:
                            pool.putconn(raw_conn, close=True)
                        except Exception:
                            pass
                        raw_conn = pool.getconn()
                        _conn_created_at[id(raw_conn)] = time.time()
                    else:
                        if conn_id not in _conn_created_at:
                            _conn_created_at[conn_id] = time.time()

                    return PGConnectionWrapper(raw_conn, pool=pool)
                else:
                    logger.warning("[PostgreSQL Pool]: Pool checkout saturated. Creating fallback direct connection.")
                    clean_url = get_clean_database_url()
                    fallback_conn = psycopg2.connect(clean_url, cursor_factory=AutoParamRealDictCursor, connect_timeout=8)
                    return PGConnectionWrapper(fallback_conn, pool=None)
            else:
                clean_url = get_clean_database_url()
                raw_conn = psycopg2.connect(clean_url, cursor_factory=AutoParamRealDictCursor, connect_timeout=8)
                return PGConnectionWrapper(raw_conn)
        except Exception as err:
            logger.error(f"[PostgreSQL Connection Error]: {err}")
            raise RuntimeError(f"PostgreSQL connection failed: {err}")

    # Connect to SQLite only if DATABASE_URL is explicitly configured for SQLite
    if not IS_POSTGRES:
        db_path = settings.DATABASE_URL.replace("sqlite:///", "")
        conn = sqlite3.connect(db_path, timeout=60.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA busy_timeout=60000;")
        return conn

    raise RuntimeError("PostgreSQL connection could not be established.")

@contextmanager
def get_db_transaction():
    """
    Context manager for database transactions with automatic commit and rollback safety.
    """
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Database transaction error: {e}. Rolled back transaction.")
        raise e
    finally:
        conn.close()

def execute_query(cursor, query: str, params: tuple = ()):
    """
    Executes a query, automatically adapting placeholder parameters ('?' vs '%s') for Postgres/SQLite.
    """
    is_pg_connection = hasattr(cursor.connection, "pgconn") or hasattr(cursor.connection, "_raw_conn") or type(cursor.connection).__module__.startswith("psycopg2")
    if is_pg_connection:
        if params and "%" in query:
            query = re.sub(r'%(?!s|\()', '%%', query)
        if "?" in query:
            query = query.replace("?", "%s")
    cursor.execute(query, params)
    return cursor

def log_audit_event(event_type: str, actor: str, details: str, scenario_id: Optional[str] = None):
    """
    Records an audit log entry for security and operations tracking.
    """
    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            execute_query(
                cursor,
                """INSERT INTO audit_logs (id, timestamp, event_type, actor, details, scenario_id)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    f"audit-{datetime.datetime.now().timestamp()}",
                    datetime.datetime.now().isoformat(),
                    event_type,
                    actor,
                    details,
                    scenario_id or "SYSTEM"
                )
            )
    except Exception as err:
        logger.warning(f"Failed to record audit event: {err}")

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    is_pg = hasattr(conn, "pgconn") or hasattr(conn, "_raw_conn") or type(conn).__module__.startswith("psycopg2")

    pk_auto = "SERIAL PRIMARY KEY" if is_pg else "INTEGER PRIMARY KEY AUTOINCREMENT"
    real_type = "DOUBLE PRECISION" if is_pg else "REAL"

    # 1. Scenarios Table
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS scenarios (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        document_id VARCHAR(255),
        created_date VARCHAR(255),
        last_simulation VARCHAR(255),
        status VARCHAR(100),
        agent_count INTEGER DEFAULT 50,
        overall_risk_score INTEGER DEFAULT 50
    );
    """)

    # 2. Documents Table
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        size_bytes BIGINT NOT NULL,
        chunk_count INTEGER DEFAULT 0,
        status VARCHAR(100) DEFAULT 'READY',
        created_at VARCHAR(255)
    );
    """)

    # 3. Document Chunks Table
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS document_chunks (
        id {pk_auto},
        document_id VARCHAR(255) NOT NULL,
        chunk_index INTEGER NOT NULL,
        text TEXT NOT NULL,
        char_length INTEGER NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
    );
    """)

    # 4. Agents Table
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS agents (
        id VARCHAR(255) PRIMARY KEY,
        scenario_id VARCHAR(255) NOT NULL,
        number_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(255) NOT NULL,
        tier INTEGER NOT NULL,
        tier_name VARCHAR(255) NOT NULL,
        risk_threshold INTEGER NOT NULL,
        bias TEXT NOT NULL,
        current_state VARCHAR(100) DEFAULT 'IDLE',
        current_channel VARCHAR(100) DEFAULT 'BOARDROOM',
        current_position TEXT NOT NULL,
        sentiment VARCHAR(100) DEFAULT 'NEUTRAL',
        confidence INTEGER DEFAULT 85,
        system_prompt TEXT NOT NULL,
        routing_attributes TEXT,
        metrics TEXT,
        initial_stance {real_type} DEFAULT 0.0,
        final_stance {real_type} DEFAULT 0.0,
        FOREIGN KEY (scenario_id) REFERENCES scenarios (id) ON DELETE CASCADE
    );
    """)

    # Safe column migrations for agents table
    try:
        cursor.execute(f"ALTER TABLE agents ADD COLUMN initial_stance {real_type} DEFAULT 0.0;")
    except Exception:
        pass
    try:
        cursor.execute(f"ALTER TABLE agents ADD COLUMN final_stance {real_type} DEFAULT 0.0;")
    except Exception:
        pass

    # 5. Graph Nodes Table
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS graph_nodes (
        id VARCHAR(255) PRIMARY KEY,
        scenario_id VARCHAR(255) NOT NULL,
        label VARCHAR(255) NOT NULL,
        node_type VARCHAR(255) NOT NULL,
        entity_category VARCHAR(255),
        agent_tier INTEGER,
        state VARCHAR(100),
        x {real_type},
        y {real_type},
        val INTEGER,
        connections TEXT,
        source_document_id VARCHAR(255),
        source_chunk INTEGER,
        FOREIGN KEY (scenario_id) REFERENCES scenarios (id) ON DELETE CASCADE
    );
    """)

    # 6. Graph Edges Table
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS graph_edges (
        id VARCHAR(255) PRIMARY KEY,
        scenario_id VARCHAR(255) NOT NULL,
        source VARCHAR(255) NOT NULL,
        target VARCHAR(255) NOT NULL,
        relationship VARCHAR(255) NOT NULL,
        strength INTEGER DEFAULT 3,
        confidence {real_type} DEFAULT 0.9,
        source_chunk INTEGER,
        FOREIGN KEY (scenario_id) REFERENCES scenarios (id) ON DELETE CASCADE
    );
    """)

    # 7. Simulation Rounds Table
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS simulation_rounds (
        id {pk_auto},
        scenario_id VARCHAR(255) NOT NULL,
        round_number INTEGER NOT NULL,
        status VARCHAR(100) NOT NULL,
        active_agents INTEGER DEFAULT 50,
        summary TEXT,
        created_at VARCHAR(255),
        FOREIGN KEY (scenario_id) REFERENCES scenarios (id) ON DELETE CASCADE
    );
    """)

    # 8. Agent Actions Table
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS agent_actions (
        id VARCHAR(255) PRIMARY KEY,
        scenario_id VARCHAR(255) NOT NULL,
        agent_id VARCHAR(255) NOT NULL,
        round INTEGER NOT NULL,
        action_type VARCHAR(255) NOT NULL,
        payload TEXT,
        timestamp VARCHAR(255),
        FOREIGN KEY (scenario_id) REFERENCES scenarios (id) ON DELETE CASCADE
    );
    """)

    # 9. Feed Events Table
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS feed_events (
        id VARCHAR(255) PRIMARY KEY,
        scenario_id VARCHAR(255) NOT NULL,
        timestamp VARCHAR(255) NOT NULL,
        agent_id VARCHAR(255) NOT NULL,
        agent_number_id INTEGER NOT NULL,
        role VARCHAR(255) NOT NULL,
        agent_name VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        sentiment VARCHAR(100) NOT NULL,
        channel VARCHAR(100) NOT NULL,
        round INTEGER NOT NULL,
        FOREIGN KEY (scenario_id) REFERENCES scenarios (id) ON DELETE CASCADE
    );
    """)

    # 10. Risks Table
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS risks (
        id VARCHAR(255) PRIMARY KEY,
        scenario_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        score INTEGER NOT NULL,
        severity VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        impacted_agents_count INTEGER DEFAULT 0,
        FOREIGN KEY (scenario_id) REFERENCES scenarios (id) ON DELETE CASCADE
    );
    """)

    # 11. Reports Table
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS reports (
        id VARCHAR(255) PRIMARY KEY,
        scenario_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        generated_at VARCHAR(255) NOT NULL,
        executive_summary TEXT NOT NULL,
        payload TEXT NOT NULL,
        FOREIGN KEY (scenario_id) REFERENCES scenarios (id) ON DELETE CASCADE
    );
    """)

    # 11b. Scenario Reports Table (Stage 4 Observer Agent Reports)
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS scenario_reports (
        scenario_id VARCHAR(255) PRIMARY KEY,
        risk_score INTEGER NOT NULL,
        pos_pct {real_type} NOT NULL,
        neu_pct {real_type} NOT NULL,
        neg_pct {real_type} NOT NULL,
        crit_pct {real_type} NOT NULL,
        total_agents INTEGER NOT NULL,
        primary_concern TEXT,
        executive_summary TEXT,
        audio_script TEXT,
        slides TEXT,
        key_risks TEXT,
        updated_at VARCHAR(255)
    );
    """)

    # 12. Audit Logs Table (Production Hardening)
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(255) PRIMARY KEY,
        timestamp VARCHAR(255) NOT NULL,
        event_type VARCHAR(255) NOT NULL,
        actor VARCHAR(255) NOT NULL,
        details TEXT NOT NULL,
        scenario_id VARCHAR(255)
    );
    """)

    # 13. Users Table
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT,
        full_name VARCHAR(255),
        picture TEXT,
        auth_provider VARCHAR(100) DEFAULT 'LOCAL',
        is_verified INTEGER DEFAULT 0,
        created_at VARCHAR(255) NOT NULL
    );
    """)

    # 14. Verification Codes Table
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS verification_codes (
        email VARCHAR(255) PRIMARY KEY,
        code VARCHAR(100) NOT NULL,
        expires_at VARCHAR(255) NOT NULL,
        created_at VARCHAR(255) NOT NULL
    );
    """)

    # 15. Secure API Keys Pool Table
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS api_keys (
        id VARCHAR(255) PRIMARY KEY,
        key_name VARCHAR(255) NOT NULL,
        provider VARCHAR(100) NOT NULL,
        api_key TEXT NOT NULL,
        status VARCHAR(100) DEFAULT 'UNVERIFIED',
        is_primary INTEGER DEFAULT 0,
        created_at VARCHAR(255) NOT NULL,
        updated_at VARCHAR(255) NOT NULL
    );
    """)

    # 16. OASIS Simulation Steps Table (PostgreSQL & SQLite)
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS oasis_simulation_steps (
        id VARCHAR(255) PRIMARY KEY,
        scenario_id VARCHAR(255),
        agent_id VARCHAR(255) NOT NULL,
        agent_number_id INTEGER NOT NULL,
        archetype VARCHAR(255) NOT NULL,
        faction VARCHAR(255) NOT NULL,
        core_incentive TEXT NOT NULL,
        round_number INTEGER NOT NULL,
        action_type VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        perceived_feed TEXT,
        numerical_stance {real_type} NOT NULL,
        created_at VARCHAR(255) NOT NULL
    );
    """)

    # Safe column migration for oasis_simulation_steps table
    try:
        cursor.execute("ALTER TABLE oasis_simulation_steps ADD COLUMN scenario_id VARCHAR(255);")
    except Exception:
        pass

    # 17. OASIS Agent Trajectories Table (PostgreSQL & SQLite)
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS oasis_agent_trajectories (
        agent_id VARCHAR(255) PRIMARY KEY,
        initial_stance {real_type} NOT NULL,
        final_stance {real_type} NOT NULL,
        stance_history TEXT NOT NULL,
        recent_posts TEXT NOT NULL,
        perceived_shock TEXT NOT NULL,
        updated_at VARCHAR(255) NOT NULL
    );
    """)

    conn.commit()

    conn.close()
    logger.info(f"Database schema initialized successfully (Engine: {'PostgreSQL' if is_pg else 'SQLite'}).")

_db_initialized = False

def ensure_db_initialized():
    global _db_initialized
    if _db_initialized:
        return
    try:
        init_db()
        _db_initialized = True
    except Exception as e:
        logger.warning(f"[Database Init Notice]: Deferred schema initialization: {e}")
