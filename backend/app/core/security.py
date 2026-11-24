import os
import base64
import hashlib
import datetime
from typing import Optional, Dict, Any, List
from fastapi import Request, HTTPException, Depends
import jwt
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings
from app.storage.database import get_db_connection, execute_query
from app.core.logging import logger

SESSION_COOKIE_NAME = "swarmlens_session"
SESSION_MAX_AGE = 86400  # 24 hours

def get_jwt_secret() -> str:
    secret = getattr(settings, "JWT_SECRET_KEY", "") or os.getenv("JWT_SECRET_KEY", "")
    if not secret:
        logger.warning("JWT_SECRET_KEY not set in environment. Generating dynamic runtime secret.")
        secret = os.environ.setdefault("JWT_SECRET_KEY", os.urandom(32).hex())
    return secret

def get_fernet_cipher() -> Fernet:
    secret = get_jwt_secret().encode("utf-8")
    derived_key = base64.urlsafe_b64encode(hashlib.sha256(secret).digest())
    return Fernet(derived_key)

def encrypt_api_key(raw_key: str) -> str:
    """
    Encrypts a user's BYOK API key at rest using Fernet derived from JWT_SECRET_KEY.
    """
    if not raw_key or not raw_key.strip():
        return ""
    cipher = get_fernet_cipher()
    return cipher.encrypt(raw_key.strip().encode("utf-8")).decode("utf-8")

def decrypt_api_key(stored_key: str) -> str:
    """
    Decrypts a stored API key in memory strictly when required by backend LLM calls.
    Returns plain text if already plain (legacy fallback).
    """
    if not stored_key or not stored_key.strip():
        return ""
    cleaned = stored_key.strip()
    if cleaned.startswith("AIzaSy") or cleaned.startswith("gsk_") or cleaned.startswith("sk-") or cleaned.startswith("AQ."):
        return cleaned
    cipher = get_fernet_cipher()
    try:
        return cipher.decrypt(cleaned.encode("utf-8")).decode("utf-8")
    except (InvalidToken, Exception) as err:
        logger.warning(f"[Security Vault] Decryption notice: {err}")
        return cleaned

def create_session_token(user_id: str, email: str) -> str:
    secret = get_jwt_secret()
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": str(email),
        "iat": now_utc,
        "exp": now_utc + datetime.timedelta(seconds=SESSION_MAX_AGE),
    }
    return jwt.encode(payload, secret, algorithm="HS256")

def decode_session_token(token: str) -> Optional[Dict[str, Any]]:
    secret = get_jwt_secret()
    try:
        clean = token.replace("Bearer ", "").strip()
        return jwt.decode(clean, secret, algorithms=["HS256"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as e:
        logger.debug(f"[Security] Token validation error: {e}")
        return None
    except Exception as e:
        logger.debug(f"[Security] Unexpected decode error: {e}")
        return None

def extract_token_from_request(request: Request) -> Optional[str]:
    # 1. Primary: HttpOnly Session Cookie
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    if cookie_token and cookie_token.strip():
        return cookie_token.strip()

    # 2. Fallback: Authorization header (Bearer token)
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if auth_header and "Bearer " in auth_header:
        return auth_header.replace("Bearer ", "").strip()

    return None

async def get_current_user(request: Request) -> Dict[str, Any]:
    token = extract_token_from_request(request)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")

    payload = decode_session_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid or expired session. Please sign in again.")

    user_id = payload["sub"]
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        execute_query(cursor, "SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="User account not found")
        return dict(row)
    finally:
        conn.close()

async def get_optional_current_user(request: Request) -> Optional[Dict[str, Any]]:
    token = extract_token_from_request(request)
    if not token:
        return None

    payload = decode_session_token(token)
    if not payload or not payload.get("sub"):
        return None

    user_id = payload["sub"]
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        execute_query(cursor, "SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return dict(row)
    except Exception:
        return None
    finally:
        conn.close()

def verify_csrf_origin(request: Request) -> None:
    if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
        origin = request.headers.get("origin") or request.headers.get("Origin")
        if origin:
            allowed_origins = set(settings.cors_origins_list + [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:8000",
                "http://127.0.0.1:8000",
            ])
            # Normalize origin
            norm_origin = origin.rstrip("/")
            if norm_origin not in allowed_origins and not any(norm_origin.startswith(ao.rstrip("/")) for ao in allowed_origins):
                logger.warning(f"[CSRF Guard] Untrusted origin blocked: {origin}")
                raise HTTPException(status_code=403, detail="CSRF origin verification failed.")

def verify_document_access(document_id: str, user_id: Optional[str]) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        execute_query(cursor, "SELECT * FROM documents WHERE id = ?", (document_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Document not found")
        doc = dict(row)
        doc_user_id = doc.get("user_id")
        # If document has a user_id and does not match current user, 404 (prevent ID enumeration)
        if doc_user_id and user_id and doc_user_id != user_id:
            logger.warning(f"[Ownership Guard] User {user_id} attempted access to document {document_id} owned by {doc_user_id}")
            raise HTTPException(status_code=404, detail="Document not found")
        return doc
    finally:
        conn.close()

def verify_scenario_access(scenario_id: str, user_id: Optional[str]) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        execute_query(cursor, "SELECT * FROM scenarios WHERE id = ?", (scenario_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Scenario not found")
        scen = dict(row)
        scen_user_id = scen.get("user_id")
        # If scenario has a user_id and does not match current user, 404 (prevent ID enumeration)
        if scen_user_id and user_id and scen_user_id != user_id:
            logger.warning(f"[Ownership Guard] User {user_id} attempted access to scenario {scenario_id} owned by {scen_user_id}")
            raise HTTPException(status_code=404, detail="Scenario not found")
        return scen
    finally:
        conn.close()

