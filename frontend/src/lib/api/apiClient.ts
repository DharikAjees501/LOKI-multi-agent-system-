import { API_BASE_URL } from "./baseUrl";
import { keyService } from "./keyService";

/**
 * Production-hardened fetch wrapper for SwarmLens / LOKI.
 * - Enforces `credentials: "include"` on every request so the browser automatically sends
 *   the HttpOnly `swarmlens_session` cookie.
 * - Automatically injects in-memory BYOK keys (X-Gemini-Key, X-Groq-Key, X-OpenAI-Key, X-Anthropic-Key, X-OpenRouter-Key).
 * - Dispatches `loki_auth_unauthorized` on 401 status to prompt re-authentication and clear stale user state.
 */
export async function apiFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const byokHeaders = keyService.getBYOKHeaders();

  const mergedHeaders: HeadersInit = {
    ...byokHeaders,
    ...(options.headers || {}),
  };

  const mergedOptions: RequestInit = {
    ...options,
    credentials: "include",
    headers: mergedHeaders,
  };

  const response = await fetch(url, mergedOptions);

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("loki_auth_unauthorized"));
      window.dispatchEvent(new Event("swarmlens_auth_unauthorized"));
    }
  }

  return response;
}

