import asyncio
from typing import Dict, Any, List, Optional

from app.services.document_service import document_service
from app.services.extraction_service import extraction_service
from app.services.graph_service import graph_service
from app.services.persona_service import persona_service
from app.storage.database import get_db_connection
from app.core.logging import logger

class OrchestratorEngine:
    async def run_scenario_pipeline(
        self, scenario_id: str, document_id: str, scenario_title: str = "", description: str = ""
    ) -> Dict[str, Any]:
        logger.info(f"[Orchestrator] Starting end-to-end pipeline for scenario {scenario_id} with document {document_id}")

        # 1. Fetch authentic document chunks dynamically from DB
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            # Direct query by document_id
            cursor.execute("SELECT chunk_index, text FROM document_chunks WHERE document_id = ? ORDER BY chunk_index ASC", (document_id,))
            chunks = cursor.fetchall()

            if not chunks:
                # Resolve by exact ID or filename (case-insensitive) in documents table
                cursor.execute(
                    "SELECT id FROM documents WHERE id = ? OR filename = ? OR LOWER(filename) = LOWER(?) ORDER BY created_at DESC LIMIT 1",
                    (document_id, document_id, document_id)
                )
                doc_row = cursor.fetchone()
                if doc_row and doc_row["id"]:
                    real_doc_id = doc_row["id"]
                    cursor.execute("SELECT chunk_index, text FROM document_chunks WHERE document_id = ? ORDER BY chunk_index ASC", (real_doc_id,))
                    chunks = cursor.fetchall()
                    if chunks:
                        document_id = real_doc_id

            if not chunks:
                # If document_id is default or unlinked, dynamically link to the latest uploaded document
                cursor.execute("SELECT id FROM documents ORDER BY created_at DESC LIMIT 1")
                recent_doc = cursor.fetchone()
                if recent_doc and recent_doc["id"]:
                    real_doc_id = recent_doc["id"]
                    cursor.execute("SELECT chunk_index, text FROM document_chunks WHERE document_id = ? ORDER BY chunk_index ASC", (real_doc_id,))
                    chunks = cursor.fetchall()
                    if chunks:
                        document_id = real_doc_id
        finally:
            conn.close()

        if not chunks:
            raise RuntimeError(f"No document chunks found for document '{document_id}'. Live GraphRAG extraction requires an uploaded strategy document.")

        chunk_items = [{"index": c["chunk_index"], "text": c["text"]} for c in chunks]
        total_chunks = len(chunk_items)
        logger.info(f"[Orchestrator] Processing ALL {total_chunks} chunks from Page 1 to final page with GraphRAG batching.")

        # 2. Execute GraphRAG extraction across ALL chunks in batches of 3-4 with Semaphore(3) concurrency
        batch_size = 4
        batches = [chunk_items[i:i + batch_size] for i in range(0, total_chunks, batch_size)]
        semaphore = asyncio.Semaphore(3)

        async def _process_batch(b: List[Dict[str, Any]]) -> Any:
            async with semaphore:
                return await extraction_service.extract_graph_from_batch_async(
                    chunks=b, description=description, scenario_title=scenario_title
                )

        batch_tasks = [_process_batch(b) for b in batches]
        rag_outputs = await asyncio.gather(*batch_tasks)

        # 3. Populate NetworkX & SQLite Knowledge Graph
        graph_response = graph_service.populate_scenario_graph_from_rag(scenario_id, document_id, rag_outputs)

        # 4. Generate 200-Persona Population Structure
        personas = persona_service.generate_personas_for_scenario(scenario_id, total_agents=200)

        # 5. Link Document ID & Description to Scenario in DB
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE scenarios SET document_id = ?, name = COALESCE(NULLIF(?, ''), name), description = COALESCE(NULLIF(?, ''), description) WHERE id = ?",
                (document_id, scenario_title, description, scenario_id)
            )
            conn.commit()
        finally:
            conn.close()

        logger.info(f"[Orchestrator] Pipeline completed successfully for scenario {scenario_id}.")

        return {
            "status": "COMPLETED",
            "scenario_id": scenario_id,
            "document_id": document_id,
            "extracted_nodes_count": len(graph_response.nodes),
            "extracted_edges_count": len(graph_response.edges),
            "generated_personas_count": len(personas),
        }

orchestrator = OrchestratorEngine()
