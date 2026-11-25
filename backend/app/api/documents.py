import os
from typing import Optional, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Header, Request, Depends
from app.core.config import settings
from app.services.document_service import document_service
from app.engine.orchestrator import orchestrator
from app.models.document import DocumentUploadResponse
from app.core.logging import logger
from app.storage.database import get_db_connection, log_audit_event
from app.core.security import get_optional_current_user, get_current_user, verify_document_access
from constants.error import (
    FILENAME_EMPTY,
    FILE_CONTENT_EMPTY,
    unsupported_file_format,
    file_size_exceeded,
)
from constants.success import (
    STATUS_DELETED,
)
from constants.message import (
    log_document_upload_processing,
    log_document_upload_success,
    log_document_fetching,
    log_document_delete,
    log_document_delete_failed,
)

router = APIRouter(prefix="/documents", tags=["documents"])

@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    scenario_title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail=FILENAME_EMPTY)

    user_id = current_user["id"]

    safe_filename = os.path.basename(file.filename)
    ext = os.path.splitext(safe_filename)[1].lower()

    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=unsupported_file_format(ext, settings.ALLOWED_EXTENSIONS)
        )
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail=FILE_CONTENT_EMPTY)
    if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=file_size_exceeded(len(content), settings.MAX_UPLOAD_SIZE_BYTES)
        )
    logger.info(log_document_upload_processing(safe_filename, len(content), user_id))
    response = document_service.process_and_store_document(content, safe_filename, user_id=user_id)

    log_audit_event("DOCUMENT_UPLOAD", "USER", f"Uploaded file {safe_filename} (Doc ID: {response.document_id}).")
    logger.info(log_document_upload_success(safe_filename, response.document_id))
    return response

@router.get("/{document_id}")
async def get_document(
    document_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    logger.info(log_document_fetching(document_id))
    user_id = current_user.get("id") if current_user else None
    doc = verify_document_access(document_id, user_id)

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
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
async def delete_document(
    document_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    logger.info(log_document_delete(document_id))
    user_id = current_user.get("id") if current_user else None
    verify_document_access(document_id, user_id)

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
        logger.error(log_document_delete_failed(document_id, err))
        raise HTTPException(status_code=500, detail=str(err))
    finally:
        conn.close()
    return {"status": STATUS_DELETED, "document_id": document_id, "success": True}
