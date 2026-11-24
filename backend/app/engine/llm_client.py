import time
import json
import os
import httpx
from typing import List, Optional, Dict, Any
from app.core.config import settings
from app.core.logging import logger
from app.core.telemetry import telemetry
from app.storage.database import get_db_connection

_langfuse_client = None

def get_langfuse_client():
    global _langfuse_client
    if _langfuse_client is not None:
        return _langfuse_client
    try:
        pk = (getattr(settings, "LANGFUSE_PUBLIC_KEY", "") or os.environ.get("LANGFUSE_PUBLIC_KEY", "")).strip()
        sk = (getattr(settings, "LANGFUSE_SECRET_KEY", "") or os.environ.get("LANGFUSE_SECRET_KEY", "")).strip()
        host = (getattr(settings, "LANGFUSE_BASE_URL", "") or getattr(settings, "LANGFUSE_HOST", "") or os.environ.get("LANGFUSE_BASE_URL", "") or os.environ.get("LANGFUSE_HOST", "https://us.cloud.langfuse.com")).strip()
        if pk and sk:
            from langfuse import Langfuse
            _langfuse_client = Langfuse(public_key=pk, secret_key=sk, host=host)
            logger.info("[LLMClient] Langfuse client initialized successfully.")
            return _langfuse_client
    except Exception as e:
        logger.debug(f"[LLMClient] Langfuse initialization skipped: {e}")
    return None

def log_langfuse_trace(call_type: str, provider: str, model: str, prompt: str, output_text: str, p_tok: int, c_tok: int, latency: float, key_hint: str = ""):
    lf = get_langfuse_client()
    if not lf:
        return
    try:
        obs = lf.start_observation(
            name=f"{call_type}_{provider}_{model}",
            as_type="generation",
            input=prompt,
            output=output_text,
            model=model,
            usage_details={"input": p_tok, "output": c_tok, "total": p_tok + c_tok},
            metadata={
                "call_type": call_type,
                "provider": provider,
                "latency_seconds": latency,
                "key_hint": key_hint
            }
        )
        obs.end()
    except Exception as e:
        logger.debug(f"[LLMClient] Langfuse log failed: {e}")

def detect_provider_from_key(key: str, default_provider: str = "gemini") -> str:
    k = (key or "").strip()
    if not k:
        return default_provider.lower()
    if k.startswith("gsk_"):
        return "groq"
    elif k.startswith("sk-ant-"):
        return "anthropic"
    elif k.startswith("AIzaSy") or k.startswith("AQ."):
        return "gemini"
    elif k.startswith("sk-or-"):
        return "openrouter"
    elif k.startswith("sk-") and not k.startswith("sk-ant-"):
        return "openai"
    return default_provider.lower()

_cached_api_keys: Optional[List[Dict[str, str]]] = None
_cached_api_keys_time: float = 0.0

def get_active_api_keys(user_id: Optional[str] = None) -> List[Dict[str, str]]:
    """
    Retrieves all active API keys from the database (decrypting strictly in memory using Fernet)
    and environment configuration.
    Cached for 10 seconds to eliminate redundant DB roundtrips during concurrent agent deliberations.
    Returns list of dicts: [{'provider': 'groq', 'key': 'gsk_...'}, ...]
    """
    global _cached_api_keys, _cached_api_keys_time
    now = time.time()
    if user_id is None and _cached_api_keys is not None and (now - _cached_api_keys_time < 10.0):
        return _cached_api_keys

    from app.core.security import decrypt_api_key
    from app.storage.database import execute_query
    keys_list: List[Dict[str, str]] = []
    
    # 1. Fetch DB stored keys first (primary keys first, user-scoped if user_id given)
    try:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            if user_id:
                execute_query(
                    cursor,
                    "SELECT provider, api_key FROM api_keys WHERE (user_id = ? OR user_id IS NULL) AND (status IN ('VERIFIED', 'UNCHECKED', 'UNVERIFIED') OR is_primary = 1) ORDER BY is_primary DESC, created_at DESC",
                    (user_id,)
                )
            else:
                execute_query(
                    cursor,
                    "SELECT provider, api_key FROM api_keys WHERE status IN ('VERIFIED', 'UNCHECKED', 'UNVERIFIED') OR is_primary = 1 ORDER BY is_primary DESC, created_at DESC"
                )
            db_rows = cursor.fetchall() or []
        finally:
            conn.close()

        for r in db_rows:
            d = dict(r)
            stored_val = (d.get("api_key") or "").strip()
            if stored_val and stored_val != "mock_key_for_dev":
                # Decrypt strictly in memory right before LLM dispatch
                decrypted_k = decrypt_api_key(stored_val)
                p_str = detect_provider_from_key(decrypted_k, d.get("provider", "gemini"))
                if not any(item["key"] == decrypted_k for item in keys_list):
                    keys_list.append({"provider": p_str, "key": decrypted_k})
    except Exception as e:
        logger.warning(f"[LLMClient] Failed loading stored API keys from DB: {e}")

    # 2. Check environment configuration keys
    env_sources = [
        (settings.GEMINI_API_KEY, "gemini"),
        (getattr(settings, "GROQ_API_KEY", None), "groq"),
        (getattr(settings, "OPENAI_API_KEY", None), "openai"),
        (getattr(settings, "ANTHROPIC_API_KEY", None), "anthropic"),
        (getattr(settings, "OPENROUTER_API_KEY", None), "openrouter"),
    ]
    for env_k, default_p in env_sources:
        if env_k and env_k.strip() and env_k.strip() != "mock_key_for_dev":
            clean_k = env_k.strip()
            detected_p = detect_provider_from_key(clean_k, default_p)
            if not any(item["key"] == clean_k for item in keys_list):
                keys_list.append({"provider": detected_p, "key": clean_k})

    _cached_api_keys = keys_list
    _cached_api_keys_time = now
    return keys_list

async def execute_multi_provider_llm_call(
    prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 500,
    candidate_keys: Optional[List[Dict[str, str]]] = None,
    call_type: str = "SIMULATION_STEP"
) -> Optional[Dict[str, Any]]:
    """
    Executes an LLM inference request across all supported providers (Groq, OpenAI, Anthropic, Gemini, OpenRouter).
    Automatically fails over across keys and providers on HTTP 429 / 503 errors.
    Returns: {'text': str, 'usage': dict, 'provider': str, 'model': str} or None.
    """
    keys = candidate_keys or get_active_api_keys()
    if not keys:
        logger.debug(f"[LLMClient] No API keys available for call_type={call_type}")
        return None

    t0 = time.time()
    for k_info in keys:
        raw_key = (k_info.get("key") or "").strip()
        if not raw_key or raw_key == "mock_key_for_dev":
            continue

        provider = detect_provider_from_key(raw_key, k_info.get("provider", "gemini"))
        masked_key = f"...{raw_key[-4:]}" if len(raw_key) >= 4 else "...."

        client_timeout = 30.0 if call_type in ["OBSERVER_SYNTHESIS", "GRAPH_EXTRACTION", "SCENARIO_SETUP"] else 15.0
        try:
            async with httpx.AsyncClient(timeout=client_timeout) as client:
                # --- 1. GROQ PROVIDER ---
                if provider == "groq" or raw_key.startswith("gsk_"):
                    # Strictly use OpenAI GPT-OSS models only (120B and 20B)
                    groq_models = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]
                    for m in groq_models:
                        try:
                            res = await client.post(
                                "https://api.groq.com/openai/v1/chat/completions",
                                headers={"Authorization": f"Bearer {raw_key}", "Content-Type": "application/json"},
                                json={
                                    "model": m,
                                    "messages": [{"role": "user", "content": prompt}],
                                    "temperature": temperature,
                                    "max_tokens": max_tokens
                                }
                            )
                            latency = round(time.time() - t0, 3)
                            if res.status_code == 200:
                                data = res.json()
                                if "choices" in data and len(data["choices"]) > 0:
                                    text = data["choices"][0]["message"]["content"].strip()
                                    usage = data.get("usage", {})
                                    p_tok = usage.get("prompt_tokens") or max(len(prompt) // 4, 80)
                                    c_tok = usage.get("completion_tokens") or max(len(text) // 4, 20)
                                    tot_tok = p_tok + c_tok
                                    logger.info(f"[API TOKEN LOGGER] Call Type: {call_type} | Provider: GROQ | Model: {m} | Tokens: {tot_tok} | Latency: {latency:.2f}s | Key: {masked_key}")
                                    telemetry.record_token_usage(call_type, "groq", m, p_tok, c_tok, latency, key_hint=masked_key)
                                    log_langfuse_trace(call_type, "groq", m, prompt, text, p_tok, c_tok, latency, key_hint=masked_key)
                                    return {"text": text, "usage": {"prompt_tokens": p_tok, "completion_tokens": c_tok, "total_tokens": tot_tok}, "provider": "groq", "model": m}
                            elif res.status_code in [429, 503]:
                                telemetry.record_rate_limit(call_type, "groq", m, res.status_code, res.text[:200], key_hint=masked_key)
                            else:
                                logger.warning(f"[LLMClient] Groq model {m} returned status {res.status_code}: {res.text[:120]}")
                        except Exception as ge:
                            logger.warning(f"[LLMClient] Groq error ({m}): {ge}")
                    continue

                # --- 2. GOOGLE GEMINI PROVIDER ---
                elif provider in ["gemini", "google"] or raw_key.startswith("AIzaSy") or raw_key.startswith("AQ."):
                    # Strictly Gemini 3.5 Flash-Lite and 3.8 Flash (All 1.5 models removed)
                    gemini_models = [
                        "gemini-3.5-flash-lite",
                        "gemini-3.8-flash",
                        "gemini-3.1-flash-lite"
                    ]

                    for m in gemini_models:
                        try:
                            url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={raw_key}"
                            res = await client.post(
                                url,
                                headers={"Content-Type": "application/json"},
                                json={
                                    "contents": [{"parts": [{"text": prompt}]}],
                                    "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens}
                                }
                            )
                            latency = round(time.time() - t0, 3)
                            if res.status_code == 200:
                                data = res.json()
                                candidates = data.get("candidates", [])
                                if candidates and "content" in candidates[0]:
                                    parts = candidates[0]["content"].get("parts", [])
                                    if parts and "text" in parts[0]:
                                        text = parts[0]["text"].strip()
                                        um = data.get("usageMetadata", {})
                                        p_tok = um.get("promptTokenCount") or max(len(prompt) // 4, 80)
                                        c_tok = um.get("candidatesTokenCount") or max(len(text) // 4, 20)
                                        tot_tok = p_tok + c_tok
                                        logger.info(f"[API TOKEN LOGGER] Call Type: {call_type} | Provider: GEMINI | Model: {m} | Tokens: {tot_tok} | Latency: {latency:.2f}s | Key: {masked_key}")
                                        telemetry.record_token_usage(call_type, "gemini", m, p_tok, c_tok, latency, key_hint=masked_key)
                                        log_langfuse_trace(call_type, "gemini", m, prompt, text, p_tok, c_tok, latency, key_hint=masked_key)
                                        return {"text": text, "usage": {"prompt_tokens": p_tok, "completion_tokens": c_tok, "total_tokens": tot_tok}, "provider": "gemini", "model": m}
                            elif res.status_code in [429, 503]:
                                telemetry.record_rate_limit(call_type, "gemini", m, res.status_code, res.text[:200], key_hint=masked_key)
                        except Exception as gme:
                            logger.warning(f"[LLMClient] Gemini error ({m}): {gme}")
                    continue

                # --- 3. OPENAI PROVIDER ---
                elif provider in ["openai", "gpt"] or (raw_key.startswith("sk-") and not raw_key.startswith("sk-ant-")):
                    for m in ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"]:
                        try:
                            res = await client.post(
                                "https://api.openai.com/v1/chat/completions",
                                headers={"Authorization": f"Bearer {raw_key}", "Content-Type": "application/json"},
                                json={
                                    "model": m,
                                    "messages": [{"role": "user", "content": prompt}],
                                    "temperature": temperature,
                                    "max_tokens": max_tokens
                                }
                            )
                            latency = round(time.time() - t0, 3)
                            if res.status_code == 200:
                                data = res.json()
                                if "choices" in data and len(data["choices"]) > 0:
                                    text = data["choices"][0]["message"]["content"].strip()
                                    usage = data.get("usage", {})
                                    p_tok = usage.get("prompt_tokens") or max(len(prompt) // 4, 80)
                                    c_tok = usage.get("completion_tokens") or max(len(text) // 4, 20)
                                    tot_tok = p_tok + c_tok
                                    logger.info(f"[API TOKEN LOGGER] Call Type: {call_type} | Provider: OPENAI | Model: {m} | Tokens: {tot_tok} | Latency: {latency:.2f}s | Key: {masked_key}")
                                    telemetry.record_token_usage(call_type, "openai", m, p_tok, c_tok, latency, key_hint=masked_key)
                                    log_langfuse_trace(call_type, "openai", m, prompt, text, p_tok, c_tok, latency, key_hint=masked_key)
                                    return {"text": text, "usage": {"prompt_tokens": p_tok, "completion_tokens": c_tok, "total_tokens": tot_tok}, "provider": "openai", "model": m}
                            elif res.status_code in [429, 503]:
                                telemetry.record_rate_limit(call_type, "openai", m, res.status_code, res.text[:200], key_hint=masked_key)
                        except Exception as oai_err:
                            logger.warning(f"[LLMClient] OpenAI error ({m}): {oai_err}")
                    continue

                # --- 4. ANTHROPIC CLAUDE PROVIDER ---
                elif provider in ["anthropic", "claude"] or raw_key.startswith("sk-ant-"):
                    for m in ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"]:
                        try:
                            res = await client.post(
                                "https://api.anthropic.com/v1/messages",
                                headers={
                                    "x-api-key": raw_key,
                                    "anthropic-version": "2023-06-01",
                                    "content-type": "application/json"
                                },
                                json={
                                    "model": m,
                                    "max_tokens": max_tokens,
                                    "messages": [{"role": "user", "content": prompt}]
                                }
                            )
                            latency = round(time.time() - t0, 3)
                            if res.status_code == 200:
                                data = res.json()
                                content = data.get("content", [])
                                if content and "text" in content[0]:
                                    text = content[0]["text"].strip()
                                    p_tok = data.get("usage", {}).get("input_tokens") or max(len(prompt) // 4, 80)
                                    c_tok = data.get("usage", {}).get("output_tokens") or max(len(text) // 4, 20)
                                    tot_tok = p_tok + c_tok
                                    logger.info(f"[API TOKEN LOGGER] Call Type: {call_type} | Provider: ANTHROPIC | Model: {m} | Tokens: {tot_tok} | Latency: {latency:.2f}s | Key: {masked_key}")
                                    telemetry.record_token_usage(call_type, "anthropic", m, p_tok, c_tok, latency, key_hint=masked_key)
                                    log_langfuse_trace(call_type, "anthropic", m, prompt, text, p_tok, c_tok, latency, key_hint=masked_key)
                                    return {"text": text, "usage": {"prompt_tokens": p_tok, "completion_tokens": c_tok, "total_tokens": tot_tok}, "provider": "anthropic", "model": m}
                            elif res.status_code in [429, 503]:
                                telemetry.record_rate_limit(call_type, "anthropic", m, res.status_code, res.text[:200], key_hint=masked_key)
                        except Exception as ant_err:
                            logger.warning(f"[LLMClient] Anthropic error ({m}): {ant_err}")
                    continue

                # --- 5. OPENROUTER / CUSTOM PROVIDER ---
                elif provider in ["openrouter", "custom"] or raw_key.startswith("sk-or-"):
                    for m in ["meta-llama/llama-3.3-70b-instruct"]:
                        try:
                            res = await client.post(
                                "https://openrouter.ai/api/v1/chat/completions",
                                headers={"Authorization": f"Bearer {raw_key}", "Content-Type": "application/json"},
                                json={
                                    "model": m,
                                    "messages": [{"role": "user", "content": prompt}],
                                    "temperature": temperature,
                                    "max_tokens": max_tokens
                                }
                            )
                            latency = round(time.time() - t0, 3)
                            if res.status_code == 200:
                                data = res.json()
                                if "choices" in data and len(data["choices"]) > 0:
                                    text = data["choices"][0]["message"]["content"].strip()
                                    tot_tok = data.get("usage", {}).get("total_tokens") or (len(prompt) + len(text)) // 4
                                    logger.info(f"[API TOKEN LOGGER] Call Type: {call_type} | Provider: OPENROUTER | Model: {m} | Tokens: {tot_tok} | Latency: {latency:.2f}s | Key: {masked_key}")
                                    telemetry.record_token_usage(call_type, "openrouter", m, tot_tok // 2, tot_tok // 2, latency, key_hint=masked_key)
                                    log_langfuse_trace(call_type, "openrouter", m, prompt, text, tot_tok // 2, tot_tok // 2, latency, key_hint=masked_key)
                                    return {"text": text, "usage": {"prompt_tokens": tot_tok // 2, "completion_tokens": tot_tok // 2, "total_tokens": tot_tok}, "provider": "openrouter", "model": m}
                        except Exception as or_err:
                            logger.warning(f"[LLMClient] OpenRouter error ({m}): {or_err}")
                    continue

        except Exception as outer_err:
            logger.warning(f"[LLMClient] Provider execution error for {provider}: {outer_err}")

    return None

class ProviderEntry:
    def __init__(self, provider: str, api_key: str, model: Optional[str] = None, priority: int = 1):
        self.provider = provider.lower().strip()
        self.api_key = api_key.strip()
        self.model = model or self._default_model(self.provider)
        self.priority = priority
        self.is_active = True
        self.cooldown_until = 0

    def _default_model(self, provider: str) -> str:
        defaults = {
            "groq": "openai/gpt-oss-120b",
            "gemini": "gemini-3.5-flash-lite",
            "openai": "gpt-4o-mini",
            "openrouter": "meta-llama/llama-3.3-70b-instruct",
            "anthropic": "claude-3-5-haiku-20241022"
        }
        return defaults.get(provider, "gpt-4o-mini")

class UniversalLLMPool:
    """
    Universal Multi-Provider API Failover Routing System.
    Wraps execute_multi_provider_llm_call for seamless compatibility across Groq, Gemini, OpenAI, OpenRouter, Anthropic.
    """
    def __init__(self, key_pool: Optional[List[ProviderEntry]] = None):
        self.entries = key_pool or []

    async def execute_turn(
        self, 
        messages: List[Dict[str, str]], 
        temperature: float = 0.7, 
        max_tokens: int = 500,
        response_json: bool = True
    ) -> Dict[str, Any]:
        prompt = "\n".join([f"{m['role'].upper()}: {m['content']}" for m in messages])
        candidate_keys = [{"provider": e.provider, "key": e.api_key} for e in self.entries if e.api_key]
        res = await execute_multi_provider_llm_call(
            prompt=prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            candidate_keys=candidate_keys if candidate_keys else None,
            call_type="UNIVERSAL_POOL_TURN"
        )
        if res and res.get("text"):
            return {
                "content": res["text"],
                "provider": res.get("provider", "gemini"),
                "model": res.get("model", "gemini-3.5-flash-lite"),
                "input_tokens": res.get("usage", {}).get("prompt_tokens", 0),
                "output_tokens": res.get("usage", {}).get("completion_tokens", 0)
            }
        return {
            "content": "No response returned from failover pool.",
            "provider": "fallback",
            "model": "rule-based-engine",
            "input_tokens": 0,
            "output_tokens": 0
        }

