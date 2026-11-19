import os
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.core.config import settings
from app.services.document_service import document_service
from app.engine.orchestrator import orchestrator
from app.models.document import DocumentUploadResponse
from app.core.logging import logger
from app.storage.database import get_db_connection, log_audit_event

router = APIRouter(prefix="/documents", tags=["documents"])

@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    scenario_title: Optional[str] = Form(None),
    description: Optional[str] = Form(None)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename cannot be empty")

    safe_filename = os.path.basename(file.filename)
    ext = os.path.splitext(safe_filename)[1].lower()

    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed formats: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File content is empty")
    if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File size ({len(content)} bytes) exceeds maximum limit of {settings.MAX_UPLOAD_SIZE_BYTES} bytes (15 MB)."
        )
    logger.info(f"[Documents API] Processing upload request for file: {safe_filename} (Size: {len(content)} bytes)")
    response = document_service.process_and_store_document(content, safe_filename)

    log_audit_event("DOCUMENT_UPLOAD", "USER", f"Uploaded file {safe_filename} (Doc ID: {response.document_id}).")
    logger.info(f"[Documents API] Document upload completed successfully for {safe_filename} (Doc ID: {response.document_id})")
    return response

@router.get("/{document_id}")
async def get_document(document_id: str):
    logger.info(f"[Documents API] Fetching document metadata & chunks for ID: {document_id}")
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM documents WHERE id = ?", (document_id,))
        doc = cursor.fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        cursor.execute("SELECT chunk_index, text, char_length FROM document_chunks WHERE document_id = ? ORDER BY chunk_index ASC", (document_id,))
        chunks = cursor.fetchall()

        return {
            "id": doc["id"],
            "filename": doc["filename"],
            "file_type": doc["file_type"],
            "size": doc["size_bytes"],
            "chunks_count": doc["chunk_count"],
            "status": doc["status"],
            "chunks": [dict(c) for c in chunks]
        }
    finally:
        conn.close()

@router.delete("/{document_id}")
async def delete_document(document_id: str):
    logger.info(f"[Documents API] Deleting document and cascading scenarios: {document_id}")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Find all scenarios using this document
        cursor.execute(
            """SELECT id FROM scenarios 
               WHERE document_id = ? 
                  OR document_id IN (SELECT filename FROM documents WHERE id = ? OR filename = ?)
                  OR document_id IN (SELECT id FROM documents WHERE id = ? OR filename = ?)""",
            (document_id, document_id, document_id, document_id, document_id)
        )
        scen_rows = cursor.fetchall()
        for s in scen_rows:
            sid = s["id"]
            cursor.execute("DELETE FROM feed_events WHERE scenario_id = ?", (sid,))
            cursor.execute("DELETE FROM oasis_simulation_steps WHERE scenario_id = ? OR id LIKE ? OR agent_id LIKE ?", (sid, f"%{sid}%", f"%{sid}%"))
            cursor.execute("DELETE FROM oasis_agent_trajectories WHERE agent_id LIKE ?", (f"%{sid}%",))
            cursor.execute("DELETE FROM scenario_reports WHERE scenario_id = ?", (sid,))
            cursor.execute("DELETE FROM risks WHERE scenario_id = ?", (sid,))
            cursor.execute("DELETE FROM reports WHERE scenario_id = ?", (sid,))
            cursor.execute("DELETE FROM graph_nodes WHERE scenario_id = ?", (sid,))
            cursor.execute("DELETE FROM graph_edges WHERE scenario_id = ?", (sid,))
            cursor.execute("DELETE FROM agents WHERE scenario_id = ?", (sid,))
            cursor.execute("DELETE FROM agent_actions WHERE scenario_id = ?", (sid,))
            cursor.execute("DELETE FROM simulation_rounds WHERE scenario_id = ?", (sid,))
            cursor.execute("DELETE FROM scenarios WHERE id = ?", (sid,))

        cursor.execute("DELETE FROM document_chunks WHERE document_id = ? OR document_id IN (SELECT id FROM documents WHERE filename = ? OR id = ?)", (document_id, document_id, document_id))
        cursor.execute("DELETE FROM documents WHERE id = ? OR filename = ?", (document_id, document_id))
        conn.commit()

        # Remove from local uploads/ if present
        for upload_dir in ["uploads", "backend/uploads"]:
            if os.path.exists(upload_dir):
                for cand in [document_id, os.path.basename(document_id)]:
                    cand_path = os.path.join(upload_dir, cand)
                    if os.path.exists(cand_path) and os.path.isfile(cand_path):
                        try:
                            os.remove(cand_path)
                        except Exception as fe:
                            logger.warning(f"Could not remove disk file {cand_path}: {fe}")
    except Exception as err:
        conn.rollback()
        logger.error(f"[Documents API] Failed to delete document {document_id}: {err}")
        raise HTTPException(status_code=500, detail=str(err))
    finally:
        conn.close()
    return {"status": "deleted", "document_id": document_id, "success": True}
