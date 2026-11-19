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

const STORAGE_KEY = "LOKI_API_KEYS_POOL";
const LEGACY_STORAGE_KEY = "LOKI_GEMINI_API_KEY";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

class KeyService {
  getKeys(): ApiKeyItem[] {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }

      // Check legacy single key fallback ONLY if STORAGE_KEY was never initialized
      const legacyKey = localStorage.getItem(LEGACY_STORAGE_KEY) || localStorage.getItem("SWARMLENS_GEMINI_API_KEY");
      if (legacyKey && legacyKey.trim().length > 0) {
        const initial: ApiKeyItem[] = [
          {
            id: "key-1",
            name: "Primary Key",
            provider: "gemini",
            key: legacyKey.trim(),
            status: "UNVERIFIED",
            isPrimary: true,
          },
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
        return initial;
      }
    } catch (e) {
      console.warn("Failed to load API keys pool:", e);
    }
    return [];
  }

  saveKeys(keys: ApiKeyItem[]): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    const primary = keys.find((k) => k.isPrimary) || keys[0];
    if (primary && keys.length > 0) {
      localStorage.setItem(LEGACY_STORAGE_KEY, primary.key);
      localStorage.setItem("SWARMLENS_GEMINI_API_KEY", primary.key);
    } else {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      localStorage.removeItem("SWARMLENS_GEMINI_API_KEY");
    }

    if (keys.length === 0) {
      window.dispatchEvent(new Event("loki_keys_empty"));
    }
    window.dispatchEvent(new Event("loki_keys_updated"));
  }

  async verifyKey(key: string, provider: ProviderType): Promise<{ valid: boolean; status: "VERIFIED" | "EXCEEDED" | "INVALID" | "UNCHECKED"; message: string }> {
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
          message: `Provider mismatch! You entered a Groq key ('gsk_...'), but selected '${p.toUpperCase()}'. Please select Groq as provider.`,
        };
      }
    } else if (k.startsWith("sk-ant-")) {
      if (p !== "anthropic") {
        return {
          valid: false,
          status: "INVALID",
          message: `Provider mismatch! You entered an Anthropic Claude key ('sk-ant-...'), but selected '${p.toUpperCase()}'. Please select Anthropic Claude as provider.`,
        };
      }
    } else if (k.startsWith("sk-")) {
      if (p !== "openai") {
        return {
          valid: false,
          status: "INVALID",
          message: `Provider mismatch! You entered an OpenAI key ('sk-...'), but selected '${p.toUpperCase()}'. Please select OpenAI as provider.`,
        };
      }
    }

    if (p === "gemini") {
      if (k.startsWith("sk-") || k.startsWith("gsk_")) {
        return {
          valid: false,
          status: "INVALID",
          message: "Provider mismatch: You entered a key for another provider (OpenAI/Anthropic/Groq).",
        };
      }
      if (k.length < 15) {
        return {
          valid: false,
          status: "INVALID",
          message: "Invalid Google Gemini API key: key is too short.",
        };
      }
    }
    if (p === "groq" && !k.startsWith("gsk_")) {
      return {
        valid: false,
        status: "INVALID",
        message: "Provider mismatch: Groq keys must start with 'gsk_'.",
      };
    }
    if (p === "anthropic" && !k.startsWith("sk-ant-")) {
      return {
        valid: false,
        status: "INVALID",
        message: "Provider mismatch: Anthropic Claude keys must start with 'sk-ant-'.",
      };
    }
    if (p === "openai" && (!k.startsWith("sk-") || k.startsWith("sk-ant-"))) {
      return {
        valid: false,
        status: "INVALID",
        message: "Provider mismatch: OpenAI keys must start with 'sk-'.",
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${API_BASE_URL}/keys/verify-single`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: k, provider: p }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const isVerified = Boolean(data.valid && data.status === "VERIFIED");
        return {
          valid: isVerified,
          status: isVerified ? "VERIFIED" : (data.status === "EXCEEDED" ? "EXCEEDED" : "INVALID"),
          message: data.message || (isVerified ? `${p.toUpperCase()} Key verified successfully with official provider.` : "Verification failed with official provider."),
        };
      } else {
        const errData = await res.json().catch(() => null);
        const errMsg = errData?.detail || errData?.message || `Verification failed (HTTP ${res.status})`;
        return {
          valid: false,
          status: res.status === 429 ? "EXCEEDED" : "INVALID",
          message: errMsg,
        };
      }
    } catch (err) {
      console.warn("API Key Verification server timeout or network warning:", err);
      return {
        valid: false,
        status: "INVALID",
        message: "Failed to connect to verification server. Please ensure backend is running.",
      };
    }
  }

  async addKey(key: string, provider: ProviderType = "gemini", name?: string): Promise<ApiKeyItem> {
    const keys = this.getKeys();
    const cleanKey = key.trim();
    const verification = await this.verifyKey(cleanKey, provider);

    if (!verification.valid || verification.status !== "VERIFIED") {
      throw new Error(verification.message || `The ${provider.toUpperCase()} API key could not be verified by the official provider. Key was not saved.`);
    }

    const newKeyItem: ApiKeyItem = {
      id: `key-${Date.now()}`,
      name: name || `${provider.toUpperCase()} Key #${keys.length + 1}`,
      provider,
      key: cleanKey,
      status: "VERIFIED",
      lastChecked: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isPrimary: keys.length === 0,
    };

    const updated = [...keys, newKeyItem];
    this.saveKeys(updated);

    // Sync to backend DB for persistence across sessions
    try {
      const res = await fetch(`${API_BASE_URL}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          api_key: cleanKey,
          key_name: name || `${provider.toUpperCase()} Key #${keys.length + 1}`,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        console.warn("Backend rejected key storage:", errData);
      }
    } catch (e) {
      console.warn("Could not sync API key to backend database:", e);
    }

    return newKeyItem;
  }

  async removeKey(id: string): Promise<ApiKeyItem[]> {
    const keys = this.getKeys();
    const targetKey = keys.find((k) => k.id === id);
    const filtered = keys.filter((k) => k.id !== id);
    if (filtered.length > 0 && !filtered.some((k) => k.isPrimary)) {
      filtered[0].isPrimary = true;
    }
    this.saveKeys(filtered);

    // Sync deletion to backend DB
    try {
      await fetch(`${API_BASE_URL}/keys/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: targetKey?.key || "" }),
      });
    } catch (e) {
      console.warn("Could not delete API key from backend database:", e);
    }

    return filtered;
  }

  async clearAllKeys(): Promise<ApiKeyItem[]> {
    this.saveKeys([]);
    try {
      await fetch(`${API_BASE_URL}/keys/clear`, {
        method: "DELETE",
      });
    } catch (e) {
      console.warn("Could not clear API keys from backend database:", e);
    }
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

  getPrimaryOrFallbackKeysHeader(): string {
    const keys = this.getKeys();
    if (keys.length === 0) return "";

    // Sort so primary is first, followed by other active keys
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
