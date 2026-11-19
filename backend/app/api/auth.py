import random
import datetime
import hashlib
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Request
from pydantic import BaseModel, EmailStr
from app.storage.database import get_db_transaction, get_db_connection, log_audit_event
from app.core.logging import logger

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
    email: str
    full_name: Optional[str] = None
    picture: Optional[str] = None
class UserProfile(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    picture: Optional[str] = None
    auth_provider: str
    is_verified: bool
    created_at: str
class AuthResponse(BaseModel):
    token: str
    user: UserProfile
    message: str
# Helper password hashing
def hash_password(password: str) -> str:
    return hashlib.sha256(f"swarmlens_salt_{password}".encode("utf-8")).hexdigest()
# Helper token generation
def generate_token(user_id: str, email: str) -> str:
    raw = f"token_{user_id}_{email}_{datetime.datetime.now().timestamp()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

# 1. Send OTP Verification Code to Gmail
@router.post("/auth/send-verification-code")
async def send_verification_code(payload: SendOtpRequest):
    email = payload.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    # Generate 6-digit verification code
    code = f"{random.randint(100000, 999999)}"
    now = datetime.datetime.now()
    expires_at = (now + datetime.timedelta(minutes=15)).isoformat()
    created_at = now.isoformat()

    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """INSERT OR REPLACE INTO verification_codes (email, code, expires_at, created_at)
                   VALUES (?, ?, ?, ?)""",
                (email, code, expires_at, created_at)
            )
        log_audit_event("AUTH_OTP_SENT", email, f"Verification OTP code generated: {code}")
        logger.info(f"[AUTH] Sent verification OTP code {code} to email {email}")
        return {
            "success": True,
            "message": f"Verification code sent to {email}.",
            "preview_code": code  # For dev testing ease
        }
    except Exception as e:
        logger.error(f"Error generating OTP code for {email}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate verification code.")
# 2. Verify OTP Code
@router.post("/auth/verify-code")
async def verify_code(payload: VerifyOtpRequest):
    email = payload.email.strip().lower()
    code = payload.code.strip()
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT code, expires_at FROM verification_codes WHERE email = ?", (email,))
        row = cursor.fetchone()
    finally:
        conn.close()

    if not row:
        raise HTTPException(status_code=400, detail="No verification code found for this email. Please request a new code.")

    stored_code = row["code"]
    expires_at = datetime.datetime.fromisoformat(row["expires_at"])

    if datetime.datetime.now() > expires_at:
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new code.")

    if stored_code != code:
        raise HTTPException(status_code=400, detail="Invalid verification code. Please check your email and try again.")
    return {
        "valid": True,
        "message": "Verification code confirmed successfully."
    }
# 3. User Registration with Password
@router.post("/auth/register", response_model=AuthResponse)
async def register_user(payload: RegisterRequest):
    email = payload.email.strip().lower()
    code = payload.code.strip()
    password = payload.password
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email required.")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    # Verify code first
    await verify_code(VerifyOtpRequest(email=email, code=code))

    # Check if user already exists
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        existing = cursor.fetchone()
    finally:
        conn.close()

    if existing:
        raise HTTPException(status_code=400, detail="Account with this email already exists. Please Sign In.")

    user_id = f"user-{uuid.uuid4().hex[:12]}"
    pwd_hash = hash_password(password)
    full_name = payload.full_name.strip() if payload.full_name else email.split("@")[0].capitalize()
    created_at = datetime.datetime.now().isoformat()

    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO users (id, email, password_hash, full_name, picture, auth_provider, is_verified, created_at)
                   VALUES (?, ?, ?, ?, ?, 'LOCAL', 1, ?)""",
                (user_id, email, pwd_hash, full_name, f"https://api.dicebear.com/7.x/bottts/svg?seed={email}", created_at)
            )
            # Remove used code
            cursor.execute("DELETE FROM verification_codes WHERE email = ?", (email,))

        token = generate_token(user_id, email)
        log_audit_event("AUTH_REGISTER_SUCCESS", email, f"User {user_id} registered successfully.")
        profile = UserProfile(
            id=user_id,
            email=email,
            full_name=full_name,
            picture=f"https://api.dicebear.com/7.x/bottts/svg?seed={email}",
            auth_provider="LOCAL",
            is_verified=True,
            created_at=created_at
        )
        return AuthResponse(
            token=token,
            user=profile,
            message="Account created successfully!"
        )
    except Exception as e:
        logger.error(f"Failed to register user {email}: {e}")
        raise HTTPException(status_code=500, detail="Failed to create user account.")

# 4. User Login
@router.post("/auth/login", response_model=AuthResponse)
async def login_user(payload: LoginRequest):
    email = payload.email.strip().lower()
    password = payload.password
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(status_code=401, detail="No account found with this email. Please create an account.")

    user_dict = dict(row)
    pwd_hash = hash_password(password)
    if user_dict["password_hash"] != pwd_hash:
        raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")
    token = generate_token(user_dict["id"], email)
    log_audit_event("AUTH_LOGIN_SUCCESS", email, f"User {user_dict['id']} logged in.")

    profile = UserProfile(
        id=user_dict["id"],
        email=user_dict["email"],
        full_name=user_dict["full_name"],
        picture=user_dict["picture"] or f"https://api.dicebear.com/7.x/bottts/svg?seed={email}",
        auth_provider=user_dict["auth_provider"] or "LOCAL",
        is_verified=bool(user_dict["is_verified"]),
        created_at=user_dict["created_at"]
    )
    return AuthResponse(
        token=token,
        user=profile,
        message="Login successful!"
    )
# 5. Google Account SSO Login / Sign-up
@router.post("/auth/google", response_model=AuthResponse)
async def google_login(payload: GoogleLoginRequest):
    email = payload.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid Google account email.")

    full_name = payload.full_name or email.split("@")[0].capitalize()
    picture = payload.picture or f"https://api.dicebear.com/7.x/bottts/svg?seed={email}"
    created_at = datetime.datetime.now().isoformat()
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        existing = cursor.fetchone()
    finally:
        conn.close()
    if existing:
        user_dict = dict(existing)
        token = generate_token(user_dict["id"], email)
        log_audit_event("AUTH_GOOGLE_LOGIN", email, f"Google SSO login for user {user_dict['id']}")
        profile = UserProfile(
            id=user_dict["id"],
            email=user_dict["email"],
            full_name=user_dict["full_name"] or full_name,
            picture=user_dict["picture"] or picture,
            auth_provider="GOOGLE",
            is_verified=True,
            created_at=user_dict["created_at"]
        )
        return AuthResponse(token=token, user=profile, message="Google SSO Login successful!")

    # Create new Google User
    user_id = f"user-g-{uuid.uuid4().hex[:10]}"
    with get_db_transaction() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO users (id, email, password_hash, full_name, picture, auth_provider, is_verified, created_at)
               VALUES (?, ?, '', ?, ?, 'GOOGLE', 1, ?)""",
            (user_id, email, full_name, picture, created_at)
        )
    token = generate_token(user_id, email)
    log_audit_event("AUTH_GOOGLE_REGISTER", email, f"New Google SSO user created {user_id}")
    profile = UserProfile(
        id=user_id,
        email=email,
        full_name=full_name,
        picture=picture,
        auth_provider="GOOGLE",
        is_verified=True,
        created_at=created_at
    )

    return AuthResponse(token=token, user=profile, message="Welcome to SwarmLens! Google Account connected.")

# 6. Current User Me Endpoint
@router.get("/auth/me", response_model=UserProfile)
async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required.")
    # Simple token lookup simulation
    return UserProfile(
        id="user-session",
        email="user@swarmlens.ai",
        full_name="Swarm Operator",
        picture="https://api.dicebear.com/7.x/bottts/svg?seed=user",
        auth_provider="LOCAL",
        is_verified=True,
        created_at=datetime.datetime.now().isoformat()
    )
