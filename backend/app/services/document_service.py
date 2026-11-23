import os
import io
import uuid
import datetime
from typing import List, Tuple, Optional
from app.models.document import DocumentChunkModel, DocumentUploadResponse
from app.storage.database import get_db_connection
from app.core.logging import logger

try:
    import pypdf
except ImportError:
    pypdf = None

try:
    import docx
except ImportError:
    docx = None

class DocumentService:
    def chunk_text(self, text: str, chunk_size: int = 1000, overlap: int = 150) -> List[str]:
        cleaned_text = " ".join(text.split())
        if not cleaned_text:
            return []

        chunks: List[str] = []
        start = 0
        text_length = len(cleaned_text)

        while start < text_length:
            end = start + chunk_size
            chunk = cleaned_text[start:end]
            chunks.append(chunk)
            if end >= text_length:
                break
            start += (chunk_size - overlap)

        return chunks

    def extract_text_from_bytes(self, content: bytes, filename: str) -> str:
        ext = filename.lower().split(".")[-1]
        text = ""

        if ext == "pdf":
            if pypdf:
                reader = pypdf.PdfReader(io.BytesIO(content))
                text_list = []
                for page in reader.pages:
                    t = page.extract_text()
                    if t:
                        text_list.append(t)
                text = "\n".join(text_list)
            else:
                text = content.decode("utf-8", errors="ignore")

        elif ext in ["docx", "doc"]:
            if docx:
                doc = docx.Document(io.BytesIO(content))
                text = "\n".join([p.text for p in doc.paragraphs if p.text])
            else:
                text = content.decode("utf-8", errors="ignore")

        else:  # txt or default
            text = content.decode("utf-8", errors="ignore")

        return text

    def process_and_store_document(self, content: bytes, filename: str, user_id: Optional[str] = None) -> DocumentUploadResponse:
        doc_id = f"doc-{uuid.uuid4().hex[:8]}"
        created_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ext = filename.split(".")[-1].upper() if "." in filename else "TXT"

        text = self.extract_text_from_bytes(content, filename)
        raw_chunks = self.chunk_text(text)

        conn = get_db_connection()
        try:
            cursor = conn.cursor()

            # Insert Document record with user_id for workspace isolation
            cursor.execute(
                "INSERT INTO documents (id, filename, file_type, size_bytes, chunk_count, status, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (doc_id, filename, ext, len(content), len(raw_chunks), "READY", created_at, user_id)
            )

            chunk_models: List[DocumentChunkModel] = []
            for idx, chunk_str in enumerate(raw_chunks):
                cursor.execute(
                    "INSERT INTO document_chunks (document_id, chunk_index, text, char_length) VALUES (?, ?, ?, ?)",
                    (doc_id, idx, chunk_str, len(chunk_str))
                )
                chunk_models.append(
                    DocumentChunkModel(
                        chunk_index=idx,
                        text=chunk_str[:120] + "...",
                        char_length=len(chunk_str)
                    )
                )

            conn.commit()
        finally:
            conn.close()
        logger.info(f"Ingested document {filename} ({doc_id}) into {len(raw_chunks)} chunks.")

        return DocumentUploadResponse(
            document_id=doc_id,
            filename=filename,
            file_type=ext,
            size=len(content),
            chunks=len(raw_chunks),
            status="READY",
            chunk_samples=chunk_models[:3]
        )

document_service = DocumentService()
