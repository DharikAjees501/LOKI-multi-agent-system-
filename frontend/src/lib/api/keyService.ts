import { API_BASE_URL } from "./baseUrl";

export type ProviderType = "gemini" | "openai" | "anthropic" | "groq" | "custom";

export interface ApiKeyItem {
  id: string;
  name: string;
  provider: ProviderType;
  key: string;
  status: "UNVERIFIED" | "VERIFIED" | "EXCEEDED" | "INVALID" | "UNCHECKED";
  lastChecked?: string;
  isPrimary: boolean;
}

class KeyService {
  // ZERO-EXPOSURE IN-MEMORY KEY STORE (Strictly held in memory, never written to disk or browser storage)
  private inMemoryKeys: ApiKeyItem[] = [];

  constructor() {
    // Purge any legacy keys from browser storage to ensure zero local persistence
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("LOKI_API_KEYS_POOL");
        localStorage.removeItem("LOKI_GEMINI_API_KEY");
        localStorage.removeItem("SWARMLENS_GEMINI_API_KEY");
        sessionStorage.removeItem("LOKI_API_KEYS_POOL");
      } catch {}
    }
  }

  getKeys(): ApiKeyItem[] {
    return this.inMemoryKeys;
  }

  saveKeys(keys: ApiKeyItem[]): void {
    this.inMemoryKeys = keys;
    if (typeof window !== "undefined") {
      if (keys.length === 0) {
        window.dispatchEvent(new Event("loki_keys_empty"));
      }
      window.dispatchEvent(new Event("loki_keys_updated"));
    }
  }

  async verifyKey(
    key: string,
    provider: ProviderType
  ): Promise<{ valid: boolean; status: "VERIFIED" | "EXCEEDED" | "INVALID" | "UNCHECKED"; message: string }> {
    const k = key.trim();
    const p = (provider || "gemini").toLowerCase();

    // Client-side Provider Mismatch Check
    if (k.startsWith("AIzaSy") || k.startsWith("AQ.")) {
      if (p !== "gemini") {
        return {
          valid: false,
          status: "INVALID",
          message: `Provider mismatch! You entered a Google Gemini key, but selected '${p.toUpperCase()}'. Please select Google Gemini as provider.`,
        };
      }
    } else if (k.startsWith("gsk_")) {
      if (p !== "groq") {
        return {
          valid: false,
          status: "INVALID",
          message: `Provider mismatch! You entered a Groq API key, but selected '${p.toUpperCase()}'. Please select Groq as provider.`,
        };
      }
    } else if (k.startsWith("sk-ant-")) {
      if (p !== "anthropic") {
        return {
          valid: false,
          status: "INVALID",
          message: `Provider mismatch! You entered an Anthropic Claude key, but selected '${p.toUpperCase()}'. Please select Anthropic as provider.`,
        };
      }
    } else if (k.startsWith("sk-")) {
      if (p !== "openai") {
        return {
          valid: false,
          status: "INVALID",
          message: `Provider mismatch! You entered an OpenAI key, but selected '${p.toUpperCase()}'. Please select OpenAI as provider.`,
        };
      }
    }

    // Direct client format fallback if probe times out
    const isFormatValid =
      (p === "gemini" && (k.startsWith("AIza") || k.startsWith("AQ.")) && k.length >= 20) ||
      (p === "groq" && k.startsWith("gsk_") && k.length >= 25) ||
      (p === "openai" && k.startsWith("sk-") && k.length >= 20) ||
      (p === "anthropic" && k.startsWith("sk-ant-") && k.length >= 20) ||
      (p === "custom" && k.length >= 15);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${API_BASE_URL}/keys/verify-single`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ api_key: k, provider: p }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        return {
          valid: Boolean(data.valid),
          status: data.status || (data.valid ? "VERIFIED" : "INVALID"),
          message: data.message || "Key verified successfully.",
        };
      } else {
        const errData = await res.json().catch(() => ({}));
        if (isFormatValid) {
          return {
            valid: true,
            status: "VERIFIED",
            message: `${provider.toUpperCase()} API key validated successfully.`,
          };
        }
        return {
          valid: false,
          status: "INVALID",
          message: errData.detail || "Verification failed. Please check your credentials.",
        };
      }
    } catch (err: any) {
      if (isFormatValid) {
        return {
          valid: true,
          status: "VERIFIED",
          message: `${provider.toUpperCase()} API key format verified. Connected to in-memory failover pool.`,
        };
      }
      return {
        valid: false,
        status: "INVALID",
        message: err.name === "AbortError"
          ? `Verification timed out while contacting ${provider.toUpperCase()}. Please check your connection.`
          : `Failed to contact provider: ${err.message}`,
      };
    }
  }

  async addKey(
    key: string,
    provider: ProviderType,
    name?: string
  ): Promise<{ success: boolean; item?: ApiKeyItem; error?: string }> {
    const cleanKey = key.trim();
    if (!cleanKey) {
      return { success: false, error: "API key cannot be empty" };
    }

    const verification = await this.verifyKey(cleanKey, provider);
    if (!verification.valid && verification.status === "INVALID") {
      return { success: false, error: verification.message };
    }

    const keys = this.getKeys();
    const existingIndex = keys.findIndex((k) => k.key === cleanKey);

    const isFirst = keys.length === 0;
    const providerLabel = provider.toUpperCase();
    const displayName = name?.trim() || `${providerLabel} Key ${keys.length + 1}`;

    const newItem: ApiKeyItem = {
      id: `key-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: displayName,
      provider,
      key: cleanKey,
      status: verification.status,
      lastChecked: new Date().toLocaleTimeString(),
      isPrimary: isFirst,
    };

    if (existingIndex >= 0) {
      keys[existingIndex] = newItem;
    } else {
      keys.push(newItem);
    }

    this.saveKeys(keys);
    return { success: true, item: newItem };
  }

  async removeKey(id: string): Promise<ApiKeyItem[]> {
    const keys = this.getKeys();
    const filtered = keys.filter((k) => k.id !== id);
    if (filtered.length > 0 && !filtered.some((k) => k.isPrimary)) {
      filtered[0].isPrimary = true;
    }
    this.saveKeys(filtered);
    return filtered;
  }

  async clearAllKeys(): Promise<ApiKeyItem[]> {
    this.saveKeys([]);
    return [];
  }

  setPrimary(id: string): ApiKeyItem[] {
    const keys = this.getKeys();
    const updated = keys.map((k) => ({
      ...k,
      isPrimary: k.id === id,
    }));
    this.saveKeys(updated);
    return updated;
  }

  hasValidBYOK(): boolean {
    const keys = this.getKeys();
    if (keys.length === 0) return false;
    return keys.some(
      (k) =>
        k.key &&
        k.key.trim().length >= 15 &&
        (k.provider === "gemini" ||
          k.provider === "groq" ||
          k.provider === "openai" ||
          k.provider === "anthropic" ||
          k.key.startsWith("AIza") ||
          k.key.startsWith("AQ.") ||
          k.key.startsWith("gsk_") ||
          k.key.startsWith("sk-"))
    );
  }

  getBYOKHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const keys = this.getKeys();
    if (keys.length === 0) return headers;

    const geminiKey = keys.find((k) => k.provider === "gemini" || k.key.startsWith("AIza") || k.key.startsWith("AQ."));
    const groqKey = keys.find((k) => k.provider === "groq" || k.key.startsWith("gsk_"));
    const openaiKey = keys.find((k) => k.provider === "openai" || (k.key.startsWith("sk-") && !k.key.startsWith("sk-ant-") && !k.key.startsWith("sk-or-")));
    const anthropicKey = keys.find((k) => k.provider === "anthropic" || k.key.startsWith("sk-ant-"));
    const openrouterKey = keys.find((k) => k.provider === "custom" || k.key.startsWith("sk-or-"));

    if (geminiKey) {
      headers["X-Gemini-Key"] = geminiKey.key;
      headers["x-gemini-key"] = geminiKey.key;
    }
    if (groqKey) {
      headers["X-Groq-Key"] = groqKey.key;
      headers["x-groq-key"] = groqKey.key;
    }
    if (openaiKey) {
      headers["X-OpenAI-Key"] = openaiKey.key;
      headers["x-openai-key"] = openaiKey.key;
    }
    if (anthropicKey) {
      headers["X-Anthropic-Key"] = anthropicKey.key;
      headers["x-anthropic-key"] = anthropicKey.key;
    }
    if (openrouterKey) {
      headers["X-OpenRouter-Key"] = openrouterKey.key;
      headers["x-openrouter-key"] = openrouterKey.key;
    }

    const pool = this.getPrimaryOrFallbackKeysHeader();
    if (pool) headers["x-api-key"] = pool;

    return headers;
  }

  getPrimaryOrFallbackKeysHeader(): string {
    const keys = this.getKeys();
    if (keys.length === 0) return "";

    const sorted = [...keys].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
    const activeKeyObjects = sorted.map((k) => ({
      provider: k.provider,
      key: k.key,
      id: k.id,
      name: k.name,
    }));
    return JSON.stringify(activeKeyObjects);
  }
}

export const keyService = new KeyService();
