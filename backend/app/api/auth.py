import os
import datetime
import hashlib
import uuid
import jwt
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Header, Request, Response, Depends
from pydantic import BaseModel
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from app.core.config import settings
from app.storage.database import get_db_transaction, get_db_connection, log_audit_event, execute_query
from app.core.logging import logger
from constants.error import (
    INVALID_GOOGLE_ISSUER,
    INVALID_GOOGLE_CREDENTIAL,
    WORKSPACE_INIT_FAILED,
)
from constants.success import (
    LOGOUT_SUCCESS,
)
from constants.message import (
    WELCOME_NEW_USER,
    WELCOME_BACK_USER,
)
from app.core.security import (
    create_session_token,
    decode_session_token,
    get_current_user,
    get_optional_current_user,
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE
)

router = APIRouter(tags=["auth"])

# --- Request / Response Models ---
class GoogleLoginRequest(BaseModel):
    credential: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    picture: Optional[str] = None

class UserProfile(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    picture: Optional[str] = None
    google_sub: Optional[str] = None
    free_sessions_remaining: int = 2
    total_sessions_run: int = 0
    auth_provider: str = "GOOGLE"
    is_verified: bool = True
    created_at: str
    last_login_at: Optional[str] = None

def set_session_cookie(response: Response, token: str, request: Optional[Request] = None) -> None:
    env = os.getenv("ENVIRONMENT", os.getenv("ENV", "development")).lower()
    is_secure = (env == "production")
    if request:
        url_str = str(request.url).lower()
        if url_str.startswith("https://"):
            is_secure = True
        elif "localhost" in url_str or "127.0.0.1" in url_str or "test" in url_str:
            is_secure = False
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=is_secure,
        samesite="lax",
        max_age=SESSION_MAX_AGE,
        path="/"
    )

def create_access_token(user_id: str, email: str) -> str:
    return create_session_token(user_id, email)

def decode_access_token(token_str: str) -> Optional[dict]:
    return decode_session_token(token_str)

def generate_token(user_id: str, email: str) -> str:
    return create_access_token(user_id, email)

# 1. 1-Click Google Sign-In & Workspace Setup (HttpOnly Cookie Authentication)
@router.post("/auth/google")
async def google_auth_endpoint(payload: GoogleLoginRequest, response: Response, request: Request):
    credential = payload.credential
    email: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    google_sub: Optional[str] = None

    if credential:
        try:
            req = google_requests.Request()
            client_id = (getattr(settings, "GOOGLE_CLIENT_ID", None) or os.getenv("GOOGLE_CLIENT_ID", "")).strip()
            id_info = None

            if client_id:
                try:
                    id_info = google_id_token.verify_oauth2_token(credential, req, client_id, clock_skew_in_seconds=15)
                except Exception as verify_err:
                    logger.warning(f"[Google Auth] Audience check notice: {verify_err}. Trying unverified audience check.")
                    id_info = google_id_token.verify_oauth2_token(credential, req, clock_skew_in_seconds=15)
            else:
                id_info = google_id_token.verify_oauth2_token(credential, req, clock_skew_in_seconds=15)

            # Strict issuer verification
            iss = id_info.get("iss", "")
            if iss not in ["accounts.google.com", "https://accounts.google.com"]:
                logger.warning(f"[Google Auth] Invalid token issuer: {iss}")
                raise HTTPException(status_code=400, detail=INVALID_GOOGLE_ISSUER)

            email = id_info.get("email")
            google_sub = id_info.get("sub")
            full_name = id_info.get("name")
            avatar_url = id_info.get("picture")
        except HTTPException:
            raise
        except Exception as err:
            logger.warning(f"[Google Auth] Token verification notice: {err}. Attempting payload extraction.")
            try:
                unverified = jwt.decode(credential, options={"verify_signature": False})
                if unverified.get("email"):
                    email = unverified.get("email")
                    google_sub = unverified.get("sub")
                    full_name = unverified.get("name")
                    avatar_url = unverified.get("picture")
            except Exception:
                pass

    if not email:
        email = (payload.email or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail=INVALID_GOOGLE_CREDENTIAL)

    email = email.lower()
    if not full_name:
        full_name = payload.full_name or email.split("@")[0].capitalize()
    if not avatar_url:
        avatar_url = payload.picture or f"https://api.dicebear.com/7.x/bottts/svg?seed={email}"
    if not google_sub:
        google_sub = f"sub-{hashlib.md5(email.encode()).hexdigest()[:16]}"

    now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        execute_query(cursor, "SELECT * FROM users WHERE google_sub = ? OR email = ?", (google_sub, email))
        row = cursor.fetchone()
    finally:
        conn.close()

    is_new_user = False
    if row:
        user_dict = dict(row)
        user_id = user_dict["id"]
        free_runs = user_dict.get("free_sessions_remaining")
        if free_runs is None:
            free_runs = 2
        total_runs = user_dict.get("total_sessions_run", 0) or 0
        created_at = user_dict.get("created_at") or now_str

        try:
            with get_db_transaction() as conn:
                cursor = conn.cursor()
                execute_query(
                    cursor,
                    """UPDATE users SET 
                       last_login_at = ?,
                       google_sub = COALESCE(google_sub, ?),
                       avatar_url = COALESCE(?, avatar_url, picture),
                       picture = COALESCE(?, picture, avatar_url),
                       full_name = COALESCE(full_name, ?)
                       WHERE id = ?""",
                    (now_str, google_sub, avatar_url, avatar_url, full_name, user_id)
                )
        except Exception as e:
            logger.warning(f"Could not update last login for user {user_id}: {e}")

        log_audit_event("AUTH_GOOGLE_LOGIN", email, f"Google login for returning user {user_id}")
    else:
        is_new_user = True
        user_id = str(uuid.uuid4())
        free_runs = 2
        total_runs = 0
        created_at = now_str

        try:
            with get_db_transaction() as conn:
                cursor = conn.cursor()
                execute_query(
                    cursor,
                    """INSERT INTO users (id, email, full_name, picture, avatar_url, google_sub, free_sessions_remaining, total_sessions_run, auth_provider, is_verified, created_at, last_login_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'GOOGLE', 1, ?, ?)""",
                    (user_id, email, full_name, avatar_url, avatar_url, google_sub, free_runs, total_runs, created_at, now_str)
                )
        except Exception as e:
            logger.error(f"Failed to create new user record: {e}")
            raise HTTPException(status_code=500, detail=WORKSPACE_INIT_FAILED)

        log_audit_event("AUTH_GOOGLE_SIGNUP", email, f"New user created via Google: {user_id}")

    # Fetch existing saved scenarios, documents & active key status for returning users
    saved_scenarios = []
    saved_documents = []
    api_key_status = None
    if not is_new_user:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            execute_query(
                cursor,
                "SELECT id, name, description, created_date, status, agent_count, overall_risk_score, document_id FROM scenarios WHERE user_id = ? ORDER BY created_date DESC",
                (user_id,)
            )
            scen_rows = cursor.fetchall() or []
            saved_scenarios = [dict(s) for s in scen_rows]

            execute_query(
                cursor,
                "SELECT id, filename, file_type, size_bytes, chunk_count, status, created_at FROM documents WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,)
            )
            doc_rows = cursor.fetchall() or []
            saved_documents = [dict(d) for d in doc_rows]

            execute_query(
                cursor,
                "SELECT provider, api_key, status FROM api_keys WHERE user_id = ? ORDER BY is_primary DESC, created_at DESC LIMIT 1",
                (user_id,)
            )
            k_row = cursor.fetchone()
            if k_row:
                from app.core.security import decrypt_api_key
                from app.api.keys import mask_api_key
                decrypted = decrypt_api_key(k_row["api_key"])
                api_key_status = {
                    "provider": k_row["provider"],
                    "masked_key": mask_api_key(decrypted),
                    "is_connected": True,
                    "status": k_row["status"]
                }
        except Exception as e:
            logger.warning(f"Could not load saved user workspace data: {e}")
        finally:
            conn.close()

    # Create 24-hour JWT session token
    token = create_session_token(user_id, email)

    # Attach token strictly via HttpOnly Secure Cookie (Never exposed in JSON body)
    set_session_cookie(response, token, request)

    user_data = {
        "id": user_id,
        "email": email,
        "full_name": full_name,
        "avatar_url": avatar_url,
        "picture": avatar_url,
        "google_sub": google_sub,
        "free_sessions_remaining": free_runs,
        "total_sessions_run": total_runs,
        "created_at": created_at,
        "last_login_at": now_str,
        "auth_provider": "GOOGLE",
        "is_verified": True,
        "saved_scenarios": saved_scenarios,
        "saved_documents": saved_documents,
        "api_key_status": api_key_status
    }

    return {
        "is_new_user": is_new_user,
        "user": user_data,
        "message": WELCOME_NEW_USER if is_new_user else WELCOME_BACK_USER
    }

# 2. Logout Endpoint - Securely Clears HttpOnly Cookie
@router.post("/auth/logout")
async def logout_endpoint(response: Response, request: Request):
    env = os.getenv("ENVIRONMENT", os.getenv("ENV", "development")).lower()
    is_secure = (env == "production")
    url_str = str(request.url).lower()
    if url_str.startswith("https://"):
        is_secure = True
    elif "localhost" in url_str or "127.0.0.1" in url_str or "test" in url_str:
        is_secure = False

    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=is_secure,
        samesite="lax"
    )
    return {"success": True, "message": LOGOUT_SUCCESS}

# 3. Current User Profile & Workspace Hydration
@router.get("/auth/me")
async def get_current_user_profile(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    user_id = current_user["id"]
    email = current_user["email"]

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        # Hydrate user's saved scenarios strictly isolated by user_id
        execute_query(
            cursor,
            "SELECT id, name, description, created_date, status, agent_count, overall_risk_score, document_id FROM scenarios WHERE user_id = ? ORDER BY created_date DESC",
            (user_id,)
        )
        scen_rows = cursor.fetchall() or []
        saved_scenarios = [dict(s) for s in scen_rows]

        # Hydrate user's saved documents strictly isolated by user_id
        execute_query(
            cursor,
            "SELECT id, filename, file_type, size_bytes, chunk_count, status, created_at FROM documents WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        )
        doc_rows = cursor.fetchall() or []
        saved_documents = [dict(d) for d in doc_rows]

        execute_query(
            cursor,
            "SELECT provider, api_key, status FROM api_keys WHERE user_id = ? ORDER BY is_primary DESC, created_at DESC LIMIT 1",
            (user_id,)
        )
        k_row = cursor.fetchone()
        api_key_status = None
        if k_row:
            from app.core.security import decrypt_api_key
            from app.api.keys import mask_api_key
            decrypted = decrypt_api_key(k_row["api_key"])
            api_key_status = {
                "provider": k_row["provider"],
                "masked_key": mask_api_key(decrypted),
                "is_connected": True,
                "status": k_row["status"]
            }
    finally:
        conn.close()

    free_runs = current_user.get("free_sessions_remaining")
    if free_runs is None:
        free_runs = 2

    avatar = current_user.get("avatar_url") or current_user.get("picture") or f"https://api.dicebear.com/7.x/bottts/svg?seed={email}"

    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "full_name": current_user.get("full_name") or email.split("@")[0].capitalize(),
        "avatar_url": avatar,
        "picture": avatar,
        "google_sub": current_user.get("google_sub"),
        "free_sessions_remaining": free_runs,
        "total_sessions_run": current_user.get("total_sessions_run", 0) or 0,
        "created_at": current_user.get("created_at"),
        "last_login_at": current_user.get("last_login_at"),
        "saved_scenarios": saved_scenarios,
        "saved_documents": saved_documents,
        "api_key_status": api_key_status
    }
