import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.storage.database import get_db_connection

def clean_database():
    print("Clearing default data from PostgreSQL database...")
    conn = get_db_connection()
    cursor = conn.cursor()

    tables_to_clear = [
        "document_chunks",
        "documents",
        "agent_actions",
        "feed_events",
        "graph_edges",
        "graph_nodes",
        "simulation_rounds",
        "risks",
        "reports",
        "agents",
        "scenarios"
    ]

    for table in tables_to_clear:
        try:
            cursor.execute(f"DELETE FROM {table};")
            print(f"[CLEARED] Table '{table}' emptied.")
        except Exception as e:
            print(f"[WARN] Could not clear table '{table}': {e}")

    conn.commit()
    conn.close()
    print("=" * 60)
    print("Database cleaned successfully! Ready for your custom PDF upload.")
    print("=" * 60)

if __name__ == "__main__":
    clean_database()
