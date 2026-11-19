import sys
import os
from urllib.parse import urlparse

try:
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
except ImportError:
    psycopg2 = None
    ISOLATION_LEVEL_AUTOCOMMIT = None

# Add backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.storage.database import get_db_connection, init_db, IS_POSTGRES
from app.core.logging import logger

def setup_database():
    print("=" * 60)
    print("SWARMLENS DATABASE VERIFICATION & SETUP SCRIPT")
    print("=" * 60)
    print(f"Configured Database URL: {settings.DATABASE_URL}")
    print(f"Target Database Engine:  {'PostgreSQL' if IS_POSTGRES else 'SQLite'}")
    print("-" * 60)

    # If Postgres URL is provided, try creating database if it doesn't exist
    if IS_POSTGRES and psycopg2:
        try:

            parsed = urlparse(settings.DATABASE_URL)
            db_name = parsed.path.lstrip('/') or 'swarmlens_db'
            user = parsed.username or 'postgres'
            password = parsed.password or ''
            host = parsed.hostname or 'localhost'
            port = parsed.port or 5432

            print(f"[INFO] Connecting to PostgreSQL server on {host}:{port} as user '{user}'...")

            # Connect to default postgres DB first to ensure target db exists
            conn_admin = psycopg2.connect(
                dbname='postgres',
                user=user,
                password=password,
                host=host,
                port=port
            )
            conn_admin.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            cursor_admin = conn_admin.cursor()

            # Check if target database exists
            cursor_admin.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (db_name,))
            exists = cursor_admin.fetchone()

            if not exists:
                print(f"[ACTION] Database '{db_name}' does not exist. Creating it now...")
                cursor_admin.execute(f'CREATE DATABASE "{db_name}";')
                print(f"[SUCCESS] Database '{db_name}' created successfully!")
            else:
                print(f"[INFO] Database '{db_name}' already exists.")

            cursor_admin.close()
            conn_admin.close()

        except Exception as err:
            print(f"[WARNING] Could not verify/create database via admin connection: {err}")

    # Now initialize DB tables
    try:
        init_db()
        conn = get_db_connection()
        is_pg = hasattr(conn, "pgconn") or hasattr(conn, "_raw_conn") or type(conn).__module__.startswith("psycopg2")

        if not is_pg:
            raise RuntimeError("[ERROR] Active engine is not PostgreSQL. PostgreSQL is strictly required for setup_postgres.py.")

        print("[SUCCESS] Connection Successful! Active Engine: PostgreSQL")
        cursor = conn.cursor()
        cursor.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public';
        """)
        tables = [r["table_name"] for r in cursor.fetchall()]

        print(f"[INFO] Found {len(tables)} Database Tables: {', '.join(sorted(tables))}")
        conn.close()

        print("-" * 60)
        print("[SUCCESS] Database Health & Schema Setup Completed Successfully!")
        print("=" * 60)

    except Exception as err:
        print(f"[ERROR] Database Connection Failed: {err}")
        print("=" * 60)
        sys.exit(1)

if __name__ == "__main__":
    setup_database()
