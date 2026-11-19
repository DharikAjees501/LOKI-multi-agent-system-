from pydantic import BaseModel, Field
from typing import List, Optional

class DocumentChunkModel(BaseModel):
    chunk_index: int
    text: str
    char_length: int

class DocumentModel(BaseModel):
    id: str
    filename: str
    file_type: str
    size_bytes: int
    chunk_count: int
    status: str = "READY"
    created_at: str

class DocumentUploadResponse(BaseModel):
    document_id: str
    filename: str
    file_type: str
    size: int
    chunks: int
    status: str
    chunk_samples: Optional[List[DocumentChunkModel]] = None
