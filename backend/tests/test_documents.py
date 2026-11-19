import pytest
from app.services.document_service import document_service

def test_chunk_text():
    sample_text = "Word " * 500  # ~2500 chars
    chunks = document_service.chunk_text(sample_text, chunk_size=1000, overlap=100)
    assert len(chunks) >= 2
    assert all(len(c) <= 1050 for c in chunks)

def test_extract_text_from_bytes():
    raw_bytes = b"SwarmLens test strategy document text."
    extracted = document_service.extract_text_from_bytes(raw_bytes, "test.txt")
    assert "SwarmLens test strategy" in extracted

def test_process_and_store_document():
    content = b"Sample strategy memo for enterprise pricing restructuring."
    res = document_service.process_and_store_document(content, "pricing.txt")
    assert res.document_id.startswith("doc-")
    assert res.filename == "pricing.txt"
    assert res.chunks >= 1
    assert res.status == "READY"
