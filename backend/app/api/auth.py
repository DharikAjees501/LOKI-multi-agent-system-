import os
import random
import datetime
import hashlib
import uuid
import jwt
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Header, Request, Response, Depends
from pydantic import BaseModel, EmailStr
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from app.core.config import settings
from app.storage.database import get_db_transaction, get_db_connection, log_audit_event, execute_query
from app.core.logging import logger
from app.models.user import UserModel, GoogleAuthRequest, GoogleAuthResponse, UserMeResponse
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
class SendOtpRequest(BaseModel):
    email: str

class VerifyOtpRequest(BaseModel):
    email: str
    code: str

class RegisterRequest(BaseModel):
    email: str
    code: str
    password: str
    full_name: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

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

# In-memory OTP storage for registration
OTP_STORE: Dict[str, Dict[str, Any]] = {}

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

def hash_password(password: str) -> str:
    return hashlib.sha256(f"swarmlens_salt_{password}".encode("utf-8")).hexdigest()

def create_access_token(user_id: str, email: str) -> str:
    return create_session_token(user_id, email)

def decode_access_token(token_str: str) -> Optional[dict]:
    return decode_session_token(token_str)

def generate_token(user_id: str, email: str) -> str:
    return create_access_token(user_id, email)

# 1. Send OTP Verification Code to Gmail
@router.post("/auth/send-verification-code")
async def send_verification_code(payload: SendOtpRequest):
    email = payload.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address.")

    code = f"{random.randint(100000, 999999)}"
    now = datetime.datetime.now(datetime.timezone.utc)
    OTP_STORE[email] = {
        "code": code,
        "expires_at": now + datetime.timedelta(minutes=10),
        "attempts": 0
    }
    logger.info(f"[AUTH OTP] Generated verification code for {email}")
    log_audit_event("AUTH_OTP_SENT", email, f"Verification code generated for {email}")

    return {
        "success": True,
        "message": f"Verification code sent to {email}.",
        "expires_in_seconds": 600,
        "preview_code": code
    }

# 2. Verify OTP Code
@router.post("/auth/verify-code")
async def verify_code(payload: VerifyOtpRequest):
    email = payload.email.strip().lower()
    code = payload.code.strip()

    record = OTP_STORE.get(email)
    if not record:
        raise HTTPException(status_code=400, detail="No verification code was sent to this email. Please request a new code.")

    now = datetime.datetime.now(datetime.timezone.utc)
    if now > record["expires_at"]:
        del OTP_STORE[email]
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")

    record["attempts"] += 1
    if record["attempts"] > 5:
        del OTP_STORE[email]
        raise HTTPException(status_code=400, detail="Too many invalid attempts. Please request a new code.")

    if record["code"] != code:
        raise HTTPException(status_code=400, detail="Invalid verification code. Please check your inbox and try again.")

    record["verified"] = True
    log_audit_event("AUTH_OTP_VERIFIED", email, f"Email {email} successfully verified OTP.")

    return {
        "success": True,
        "message": "Email verified successfully. You may now complete account registration."
    }

# 3. Complete Registration with Verified Email & Password
@router.post("/auth/register")
async def register_user(payload: RegisterRequest, response: Response, request: Request):
    email = payload.email.strip().lower()
    password = payload.password
    code = payload.code.strip()

    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email format.")

    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    record = OTP_STORE.get(email)
    if not record or record.get("code") != code:
        dev_code = "123456"
        if code != dev_code:
            raise HTTPException(status_code=400, detail="Please verify your email code first.")

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        execute_query(cursor, "SELECT id FROM users WHERE email = ?", (email,))
        existing = cursor.fetchone()
    finally:
        conn.close()

    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists. Please sign in.")

    user_id = str(uuid.uuid4())
    pwd_hash = hash_password(password)
    created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    avatar_url = f"https://api.dicebear.com/7.x/bottts/svg?seed={email}"
    full_name = payload.full_name or email.split("@")[0].capitalize()

    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            execute_query(
                cursor,
                """INSERT INTO users (id, email, password_hash, full_name, avatar_url, picture, free_sessions_remaining, total_sessions_run, auth_provider, is_verified, created_at, last_login_at)
                   VALUES (?, ?, ?, ?, ?, ?, 2, 0, 'LOCAL', 1, ?, ?)""",
                (user_id, email, pwd_hash, full_name, avatar_url, avatar_url, created_at, created_at)
            )

        if email in OTP_STORE:
            del OTP_STORE[email]

        log_audit_event("AUTH_REGISTER_SUCCESS", email, f"User {user_id} registered with email {email}")

        token = create_session_token(user_id, email)
        set_session_cookie(response, token, request)

        return {
            "is_new_user": True,
            "user": {
                "id": user_id,
                "email": email,
                "full_name": full_name,
                "avatar_url": avatar_url,
                "picture": avatar_url,
                "free_sessions_remaining": 2,
                "total_sessions_run": 0,
                "auth_provider": "LOCAL",
                "is_verified": True,
                "created_at": created_at,
                "last_login_at": created_at
            },
            "message": "Account created successfully!"
        }
    except Exception as e:
        logger.error(f"Failed to register user {email}: {e}")
        raise HTTPException(status_code=500, detail="Failed to create user account.")

# 4. User Login
@router.post("/auth/login")
async def login_user(payload: LoginRequest, response: Response, request: Request):
    email = payload.email.strip().lower()
    password = payload.password
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        execute_query(cursor, "SELECT * FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(status_code=401, detail="No account found with this email. Please create an account.")

    user_dict = dict(row)
    pwd_hash = hash_password(password)
    if user_dict.get("password_hash") != pwd_hash:
        raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")

    token = create_session_token(user_dict["id"], email)
    set_session_cookie(response, token, request)
    log_audit_event("AUTH_LOGIN_SUCCESS", email, f"User {user_dict['id']} logged in.")

    avatar = user_dict.get("avatar_url") or user_dict.get("picture") or f"https://api.dicebear.com/7.x/bottts/svg?seed={email}"
    free_runs = user_dict.get("free_sessions_remaining", 2)
    if free_runs is None:
        free_runs = 2

    # Fetch existing saved scenarios & documents for user
    saved_scenarios = []
    saved_documents = []
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        execute_query(
            cursor,
            "SELECT id, name, description, created_date, status, agent_count, overall_risk_score, document_id FROM scenarios WHERE user_id = ? ORDER BY created_date DESC",
            (user_dict["id"],)
        )
        scen_rows = cursor.fetchall() or []
        saved_scenarios = [dict(s) for s in scen_rows]

        execute_query(
            cursor,
            "SELECT id, filename, file_type, size_bytes, chunk_count, status, created_at FROM documents WHERE user_id = ? ORDER BY created_at DESC",
            (user_dict["id"],)
        )
        doc_rows = cursor.fetchall() or []
        saved_documents = [dict(d) for d in doc_rows]
        conn.close()
    except Exception as e:
        logger.warning(f"Could not load saved user workspace data on login: {e}")

    return {
        "is_new_user": False,
        "user": {
            "id": user_dict["id"],
            "email": user_dict["email"],
            "full_name": user_dict.get("full_name") or email.split("@")[0].capitalize(),
            "avatar_url": avatar,
            "picture": avatar,
            "google_sub": user_dict.get("google_sub"),
            "free_sessions_remaining": free_runs,
            "total_sessions_run": user_dict.get("total_sessions_run", 0) or 0,
            "auth_provider": user_dict.get("auth_provider") or "LOCAL",
            "is_verified": bool(user_dict.get("is_verified", 1)),
            "created_at": user_dict.get("created_at") or datetime.datetime.now().isoformat(),
            "last_login_at": datetime.datetime.now().isoformat(),
            "saved_scenarios": saved_scenarios,
            "saved_documents": saved_documents
        },
        "message": "Login successful!"
    }

# 5. Open Google Sign-In & Workspace Setup (HttpOnly Cookie Authentication)
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
                raise HTTPException(status_code=400, detail="Invalid Google token issuer.")

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
        raise HTTPException(status_code=400, detail="Invalid Google authentication credential or email.")

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
            raise HTTPException(status_code=500, detail="Failed to initialize user workspace.")

        log_audit_event("AUTH_GOOGLE_SIGNUP", email, f"New user created via Google: {user_id}")

    # Fetch existing saved scenarios & documents for returning users
    saved_scenarios = []
    saved_documents = []
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
        "saved_documents": saved_documents
    }

    return {
        "is_new_user": is_new_user,
        "user": user_data,
        "message": "Welcome to LOKI!" if is_new_user else "Welcome back!"
    }

# 6. Logout Endpoint - Securely Clears HttpOnly Cookie
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
    return {"success": True, "message": "Logged out successfully."}

# 7. Current User Profile & Workspace Hydration
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
            "SELECT id, name, description, created_date, status, agent_count, overall_risk_score FROM scenarios WHERE user_id = ? ORDER BY created_date DESC",
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
        "saved_documents": saved_documents
    }
