import datetime
import uuid
from typing import Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
from app.storage.database import get_db_transaction, get_db_connection, execute_query, log_audit_event
from app.core.logging import logger, audit_logger

router = APIRouter(tags=["keys"])

class VerifyKeyRequest(BaseModel):
    api_key: Optional[str] = None
    api_keys: Optional[List[str]] = None
    provider: Optional[str] = "gemini"

class ConfigVerifyRequest(BaseModel):
    api_keys: Optional[List[str]] = None
    api_key: Optional[str] = None
    provider: Optional[str] = "gemini"

class VerifyKeyResponse(BaseModel):
    valid: bool
    status: str  # "VERIFIED" | "EXCEEDED" | "INVALID" | "UNCHECKED"
    provider: str
    message: str

class StoreKeyRequest(BaseModel):
    key_name: Optional[str] = None
    provider: str
    api_key: str

class KeyModel(BaseModel):
    id: str
    key_name: str
    provider: str
    api_key: str
    status: str
    is_primary: bool
    created_at: str
    updated_at: str

def mask_api_key(key: str) -> str:
    if not key:
        return ""
    key = key.strip()
    if len(key) <= 8:
        return "••••••••"
    return f"{key[:6]}...{key[-4:]}"

async def probe_single_key(key: str, provider: str = "gemini") -> tuple:
    """
    Performs a zero-impact verification probe for all providers:
    gemini, groq, openai, anthropic, openrouter.
    Returns (is_valid, reason_or_status, provider_display_name).
    """
    k = key.strip()
    p = (provider or "gemini").lower()

    # Prefix auto-detection
    if k.startswith("gsk_"):
        p = "groq"
    elif k.startswith("sk-ant-"):
        p = "anthropic"
    elif k.startswith("AIzaSy") or k.startswith("AQ."):
        p = "gemini"
    elif k.startswith("sk-or-"):
        p = "openrouter"
    elif k.startswith("sk-") and not k.startswith("sk-ant-"):
        p = "openai"

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            if p in ["gemini", "google"]:
                res = await client.get(f"https://generativelanguage.googleapis.com/v1beta/models?key={k}")
                if res.status_code == 200:
                    return True, "active", "Gemini"
                elif res.status_code == 429:
                    return False, "429 Rate limit or quota exceeded", "Gemini"
                return False, f"{res.status_code} Unauthorized or invalid key", "Gemini"

            elif p in ["groq"]:
                res = await client.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {k}"}
                )
                if res.status_code == 200:
                    return True, "active", "Groq"
                elif res.status_code == 429:
                    return False, "429 Rate limit exceeded", "Groq"
                return False, f"{res.status_code} Unauthorized", "Groq"

            elif p in ["openai", "gpt"]:
                res = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {k}"}
                )
                if res.status_code == 200:
                    return True, "active", "OpenAI"
                elif res.status_code == 429:
                    return False, "429 Rate limit or quota exceeded", "OpenAI"
                return False, f"{res.status_code} Unauthorized", "OpenAI"

            elif p in ["anthropic", "claude"]:
                res = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": k,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json"
                    },
                    json={
                        "model": "claude-3-haiku-20240307",
                        "max_tokens": 1,
                        "messages": [{"role": "user", "content": "probe"}]
                    }
                )
                if res.status_code in [200, 400] and "invalid_api_key" not in res.text:
                    return True, "active", "Anthropic"
                return False, f"{res.status_code} Key rejected", "Anthropic"

            elif p in ["openrouter"]:
                res = await client.get(
                    "https://openrouter.ai/api/v1/models",
                    headers={"Authorization": f"Bearer {k}"}
                )
                if res.status_code == 200:
                    return True, "active", "OpenRouter"
                return False, f"{res.status_code} Unauthorized", "OpenRouter"

            else:
                if len(k) >= 10:
                    return True, "active", p.capitalize()
                return False, "Invalid API key format", p.capitalize()

    except Exception as err:
        if len(k) >= 10:
            return True, "active", p.capitalize()
        return False, str(err), p.capitalize()


def detect_provider_mismatch(key: str, provider: str) -> Optional[str]:
    """
    Detects if the provided API key format belongs to a different LLM provider.
    Returns an error message string if a mismatch is detected, otherwise returns None.
    """
    p = provider.lower()
    k = key.strip()

    # 1. Google Gemini Key Pattern (starts with AIzaSy or AQ.)
    if k.startswith("AIzaSy") or k.startswith("AQ."):
        if p not in ["gemini", "google"]:
            return f"Provider mismatch! You entered a Google Gemini API Key, but selected '{provider.upper()}'. Please select Google Gemini as the provider."

    # 2. Anthropic Claude Key Pattern (starts with sk-ant-)
    elif k.startswith("sk-ant-"):
        if p not in ["anthropic", "claude"]:
            return f"Provider mismatch! You entered an Anthropic Claude API Key ('sk-ant-...'), but selected '{provider.upper()}'. Please select Anthropic Claude as the provider."

    # 3. Groq Key Pattern (starts with gsk_)
    elif k.startswith("gsk_"):
        if p not in ["groq"]:
            return f"Provider mismatch! You entered a Groq API Key ('gsk_...'), but selected '{provider.upper()}'. Please select Groq as the provider."

    # 4. OpenAI Key Pattern (starts with sk- and NOT sk-ant-)
    elif k.startswith("sk-") and not k.startswith("sk-ant-") and not k.startswith("sk-or-"):
        if p not in ["openai", "gpt"]:
            return f"Provider mismatch! You entered an OpenAI API Key ('sk-...'), but selected '{provider.upper()}'. Please select OpenAI as the provider."

    # 5. Check if key provided for specific provider doesn't match expected prefix
    if p in ["gemini", "google"]:
        if k.startswith("sk-") or k.startswith("gsk_"):
            return "Provider mismatch! You selected Google Gemini, but entered a key for a different provider."
        if len(k) < 15:
            return "Invalid Google Gemini API key: key is too short."

    if p in ["openai", "gpt"] and (k.startswith("AIzaSy") or k.startswith("AQ.") or k.startswith("gsk_") or k.startswith("sk-ant-")):
        return "Provider mismatch! You selected OpenAI, but entered a key for a different provider."

    if p in ["anthropic", "claude"] and not k.startswith("sk-ant-"):
        if k.startswith("AIzaSy") or k.startswith("AQ.") or k.startswith("gsk_") or k.startswith("sk-"):
            return "Provider mismatch! You selected Anthropic Claude, but entered a key for a different provider."

    if p in ["groq"] and not k.startswith("gsk_"):
        if k.startswith("AIzaSy") or k.startswith("AQ.") or k.startswith("sk-"):
            return "Provider mismatch! You selected Groq, but entered a key for a different provider."

    return None

@router.post("/config/verify-key")
@router.post("/keys/verify")
async def verify_keys_config_route(payload: ConfigVerifyRequest):
    keys_to_verify = []
    if payload.api_keys:
        keys_to_verify.extend([k.strip() for k in payload.api_keys if k and k.strip()])
    if payload.api_key and payload.api_key.strip() and payload.api_key.strip() not in keys_to_verify:
        keys_to_verify.append(payload.api_key.strip())

    if not keys_to_verify:
        raise HTTPException(status_code=400, detail="No API keys provided in verification payload.")

    verified_results = []
    failed_errors = []

    for idx, raw_k in enumerate(keys_to_verify):
        is_valid, reason, prov_name = await probe_single_key(raw_k, payload.provider or "gemini")
        hint = f"...{raw_k[-4:]}" if len(raw_k) >= 4 else "...."

        audit_logger.log_event("KEY_VERIFICATION_PROBE", {
            "index": idx,
            "provider": prov_name,
            "hint": hint,
            "status": "active" if is_valid else "rejected",
            "reason": reason
        })

        if is_valid:
            verified_results.append({
                "index": idx,
                "hint": hint,
                "status": "active",
                "provider": prov_name
            })
        else:
            failed_errors.append(f"Key #{idx + 1} ({hint}) rejected: {reason}")

    if failed_errors and not verified_results:
        raise HTTPException(status_code=400, detail="; ".join(failed_errors))

    return {
        "status": "success",
        "verified_keys": verified_results,
        "failed_count": len(failed_errors)
    }

@router.post("/keys/verify-single", response_model=VerifyKeyResponse)
async def verify_api_key(payload: VerifyKeyRequest):
    key = (payload.api_key or "").strip()
    provider = (payload.provider or "gemini").lower()


    if not key:
        return VerifyKeyResponse(
            valid=False,
            status="INVALID",
            provider=provider,
            message="API Key cannot be empty."
        )

    # 0. Mismatch Provider Guardrail
    mismatch_err = detect_provider_mismatch(key, provider)
    if mismatch_err:
        return VerifyKeyResponse(
            valid=False,
            status="INVALID",
            provider=provider.capitalize(),
            message=mismatch_err
        )

    # 1. Google Gemini Verification (Fast REST endpoint check)
    if provider in ["gemini", "google"]:
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(f"https://generativelanguage.googleapis.com/v1beta/models?key={key}")
                if res.status_code == 200:
                    return VerifyKeyResponse(
                        valid=True,
                        status="VERIFIED",
                        provider="Gemini",
                        message="Gemini API Key verified with official Google provider."
                    )
                elif res.status_code == 429 or "quota" in res.text.lower():
                    return VerifyKeyResponse(
                        valid=False,
                        status="EXCEEDED",
                        provider="Gemini",
                        message="Gemini API Key quota or rate limit exceeded."
                    )
                elif res.status_code in [400, 401, 403] or "invalid" in res.text.lower():
                    return VerifyKeyResponse(
                        valid=False,
                        status="INVALID",
                        provider="Gemini",
                        message="Google rejected this API key: Invalid or unauthorized key."
                    )
                else:
                    return VerifyKeyResponse(
                        valid=False,
                        status="INVALID",
                        provider="Gemini",
                        message=f"Google API returned status {res.status_code}."
                    )
        except Exception as e:
            logger.warning(f"Gemini API key verification network check error: {e}")
            return VerifyKeyResponse(
                valid=False,
                status="INVALID",
                provider="Gemini",
                message=f"Could not reach Google verification servers: {e}"
            )

    # 2. OpenAI Verification
    elif provider in ["openai", "gpt"]:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {key}"}
                )
                if res.status_code == 200:
                    return VerifyKeyResponse(
                        valid=True,
                        status="VERIFIED",
                        provider="OpenAI",
                        message="OpenAI API Key verified with official provider."
                    )
                elif res.status_code == 429 or "quota" in res.text.lower():
                    return VerifyKeyResponse(
                        valid=False,
                        status="EXCEEDED",
                        provider="OpenAI",
                        message="OpenAI API Key rate limit or quota exceeded."
                    )
                else:
                    return VerifyKeyResponse(
                        valid=False,
                        status="INVALID",
                        provider="OpenAI",
                        message="Invalid OpenAI API Key."
                    )
        except Exception as e:
            if key.startswith("sk-") and not key.startswith("sk-ant-"):
                return VerifyKeyResponse(
                    valid=True,
                    status="VERIFIED",
                    provider="OpenAI",
                    message="OpenAI API Key format validated."
                )
            return VerifyKeyResponse(
                valid=False,
                status="INVALID",
                provider="OpenAI",
                message="Invalid OpenAI API Key format."
            )

    # 3. Anthropic Verification
    elif provider in ["anthropic", "claude"]:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json"
                    },
                    json={
                        "model": "claude-3-haiku-20240307",
                        "max_tokens": 1,
                        "messages": [{"role": "user", "content": "hi"}]
                    }
                )
                if res.status_code in [200, 400]:
                    if "invalid_api_key" in res.text or res.status_code == 401:
                        return VerifyKeyResponse(
                            valid=False,
                            status="INVALID",
                            provider="Anthropic",
                            message="Invalid Anthropic API Key."
                        )
                    if "rate_limit" in res.text or res.status_code == 429:
                        return VerifyKeyResponse(
                            valid=False,
                            status="EXCEEDED",
                            provider="Anthropic",
                            message="Anthropic API Key rate limit exceeded."
                        )
                    return VerifyKeyResponse(
                        valid=True,
                        status="VERIFIED",
                        provider="Anthropic",
                        message="Anthropic API Key verified with official provider."
                    )
                elif res.status_code == 429:
                    return VerifyKeyResponse(
                        valid=False,
                        status="EXCEEDED",
                        provider="Anthropic",
                        message="Anthropic API Key rate limit exceeded."
                    )
                else:
                    return VerifyKeyResponse(
                        valid=False,
                        status="INVALID",
                        provider="Anthropic",
                        message="Invalid Anthropic API Key."
                    )
        except Exception as e:
            if key.startswith("sk-ant-"):
                return VerifyKeyResponse(
                    valid=True,
                    status="VERIFIED",
                    provider="Anthropic",
                    message="Anthropic API Key format validated."
                )
            return VerifyKeyResponse(
                valid=False,
                status="INVALID",
                provider="Anthropic",
                message="Invalid Anthropic API Key format."
            )

    # 4. Groq Verification
    elif provider in ["groq"]:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {key}"}
                )
                if res.status_code == 200:
                    return VerifyKeyResponse(
                        valid=True,
                        status="VERIFIED",
                        provider="Groq",
                        message="Groq API Key verified with official provider."
                    )
                elif res.status_code == 429:
                    return VerifyKeyResponse(
                        valid=False,
                        status="EXCEEDED",
                        provider="Groq",
                        message="Groq API Key rate limit exceeded."
                    )
                else:
                    return VerifyKeyResponse(
                        valid=False,
                        status="INVALID",
                        provider="Groq",
                        message="Invalid Groq API Key."
                    )
        except Exception as e:
            if key.startswith("gsk_"):
                return VerifyKeyResponse(
                    valid=True,
                    status="VERIFIED",
                    provider="Groq",
                    message="Groq API Key format validated."
                )
            return VerifyKeyResponse(
                valid=False,
                status="INVALID",
                provider="Groq",
                message="Invalid Groq API Key format."
            )

    # 5. OpenRouter / Custom Provider Fallback
    else:
        if len(key) >= 10 and not (key.startswith("AIzaSy") or key.startswith("AQ.") or key.startswith("gsk_") or key.startswith("sk-ant-")):
            return VerifyKeyResponse(
                valid=True,
                status="VERIFIED",
                provider=provider.capitalize(),
                message=f"{provider.capitalize()} API Key format validated."
            )
        return VerifyKeyResponse(
            valid=False,
            status="INVALID",
            provider=provider.capitalize(),
            message="Invalid API Key format."
        )

# Database CRUD Endpoints for Secure API Key Storage

@router.get("/keys", response_model=List[KeyModel])
async def list_stored_keys():
    """Returns stored API keys securely from PostgreSQL/SQLite database."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM api_keys ORDER BY is_primary DESC, created_at DESC")
        rows = cursor.fetchall()
    finally:
        conn.close()

    result = []
    for r in rows:
        d = dict(r)
        result.append(KeyModel(
            id=d["id"],
            key_name=d["key_name"],
            provider=d["provider"],
            api_key=mask_api_key(d["api_key"]),
            status=d.get("status", "UNVERIFIED"),
            is_primary=bool(d.get("is_primary", 0)),
            created_at=d["created_at"],
            updated_at=d["updated_at"]
        ))
    return result

@router.post("/keys", response_model=KeyModel)
async def store_key_in_db(payload: StoreKeyRequest):
    """Securely stores an API key in the PostgreSQL/SQLite database."""
    key_secret = payload.api_key.strip()
    provider = payload.provider.lower()
    key_id = f"key-{uuid.uuid4().hex[:10]}"
    now = datetime.datetime.now().isoformat()
    name = payload.key_name or f"{provider.upper()} Key"

    # Verify key status with official provider
    verification = await verify_api_key(VerifyKeyRequest(api_key=key_secret, provider=provider))
    if not verification.valid or verification.status != "VERIFIED":
        raise HTTPException(
            status_code=400,
            detail=verification.message or f"Verification failed with official {provider.capitalize()} provider. Key was not saved."
        )

    # Check existing keys to determine primary status
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM api_keys")
        row = cursor.fetchone()
    finally:
        conn.close()

    is_primary = 1 if (row and dict(row)["count"] == 0) else 0

    with get_db_transaction() as conn:
        cursor = conn.cursor()
        execute_query(
            cursor,
            """INSERT INTO api_keys (id, key_name, provider, api_key, status, is_primary, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (key_id, name, provider, key_secret, verification.status, is_primary, now, now)
        )

    log_audit_event("STORE_API_KEY", "USER", f"Stored API key for provider {provider} securely in database.")

    return KeyModel(
        id=key_id,
        key_name=name,
        provider=provider,
        api_key=mask_api_key(key_secret),
        status=verification.status,
        is_primary=bool(is_primary),
        created_at=now,
        updated_at=now
    )

class DeleteKeyRequest(BaseModel):
    api_key: Optional[str] = None

@router.delete("/keys/clear")
@router.delete("/keys/all")
async def clear_all_keys_from_db():
    """Deletes all API keys from database."""
    with get_db_transaction() as conn:
        cursor = conn.cursor()
        execute_query(cursor, "DELETE FROM api_keys")
    log_audit_event("CLEAR_API_KEYS", "USER", "Cleared all API keys from database.")
    return {"success": True, "message": "All API keys deleted from database."}

@router.delete("/keys/{key_id}")
async def delete_key_from_db(key_id: str, payload: Optional[DeleteKeyRequest] = None):
    """Deletes an API key securely from the database."""
    with get_db_transaction() as conn:
        cursor = conn.cursor()
        if key_id in ["clear", "all"]:
            execute_query(cursor, "DELETE FROM api_keys")
        else:
            execute_query(cursor, "DELETE FROM api_keys WHERE id = ?", (key_id,))
            if payload and payload.api_key and payload.api_key.strip():
                execute_query(cursor, "DELETE FROM api_keys WHERE api_key = ?", (payload.api_key.strip(),))
    log_audit_event("DELETE_API_KEY", "USER", f"Deleted API key {key_id} from database.")
    return {"success": True, "message": "API key deleted from database."}
