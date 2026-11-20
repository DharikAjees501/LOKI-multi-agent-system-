"use client";

import React, { useState, useEffect } from "react";
import {
  Key,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Lock,
  Plus,
  Trash2,
  Check,
  ArrowDownUp,
  RefreshCw,
  Zap,
} from "lucide-react";
import { keyService, ApiKeyItem, ProviderType } from "@/lib/api/keyService";

interface ApiKeyGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRequired?: boolean;
  onKeySubmitted?: (key: string) => void;
}

const PROVIDERS: { id: ProviderType; name: string; icon: string; placeholder: string }[] = [
  { id: "gemini", name: "Google Gemini", icon: "💎", placeholder: "AIzaSy... or AQ...." },
  { id: "openai", name: "OpenAI GPT", icon: "⚡", placeholder: "sk-proj-..." },
  { id: "anthropic", name: "Anthropic Claude", icon: "🧠", placeholder: "sk-ant-..." },
  { id: "groq", name: "Groq / OpenRouter", icon: "🚀", placeholder: "gsk_..." },
  { id: "custom", name: "Custom Provider", icon: "🔑", placeholder: "Enter API key..." },
];

export const ApiKeyGateModal: React.FC<ApiKeyGateModalProps> = ({
  isOpen,
  onClose,
  isRequired = false,
  onKeySubmitted,
}) => {
  const [keysList, setKeysList] = useState<ApiKeyItem[]>([]);
  const [provider, setProvider] = useState<ProviderType>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [keyName, setKeyName] = useState("");
  const [showKey, setShowKey] = useState(false);

  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    status: "VERIFIED" | "EXCEEDED" | "INVALID" | "UNCHECKED";
    message: string;
  } | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const keys = keyService.getKeys();
      setKeysList(keys);
      setVerificationResult(null);
      setApiKey("");
      setKeyName("");
      // If no keys exist, show form directly
      if (keys.length === 0) {
        setShowAddForm(true);
      } else {
        setShowAddForm(false);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleVerify = async () => {
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      setVerificationResult({
        valid: false,
        status: "INVALID",
        message: "Please enter an API Key to verify.",
      });
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    const result = await keyService.verifyKey(cleanKey, provider);
    setVerificationResult(result);
    setIsVerifying(false);
  };

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      setVerificationResult({
        valid: false,
        status: "INVALID",
        message: "Please enter a valid API Key.",
      });
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);
    try {
      const newKey = await keyService.addKey(cleanKey, provider, keyName);
      const updated = keyService.getKeys();
      setKeysList(updated);
      setApiKey("");
      setKeyName("");
      setVerificationResult(null);
      setShowAddForm(false);

      if (onKeySubmitted) {
        onKeySubmitted(newKey.key);
      }

      if (!isRequired || updated.length > 0) {
        setTimeout(() => {
          onClose();
        }, 400);
      }
    } catch (err: any) {
      setVerificationResult({
        valid: false,
        status: "INVALID",
        message: err.message || "Failed to verify API key with official provider. Key not saved.",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRemoveKey = async (id: string) => {
    const updated = await keyService.removeKey(id);
    setKeysList(updated);
    if (updated.length === 0) {
      setShowAddForm(true);
    }
  };

  const handleSetPrimary = (id: string) => {
    const updated = keyService.setPrimary(id);
    setKeysList(updated);
  };

  const hasActiveKey = keysList.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-base/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-surface border border-line rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 select-none">
        {/* Modal Top Header */}
        <div className="p-6 border-b border-line bg-raised/50 relative">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0">
              <Key className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-bold text-ink">API Key & Provider Access</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/10 border border-accent/30 text-accent font-semibold">
                  MULTI-PROVIDER
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Configure and manage your API credentials for multi-agent simulation.
              </p>
            </div>
          </div>

          {(!isRequired || hasActiveKey) && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-muted hover:text-ink text-xs font-mono px-2.5 py-1 rounded-lg bg-base border border-line"
            >
              Esc
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Active Key Pool List */}
          {keysList.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-ink flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-accent" /> CONFIGURED KEYS ({keysList.length})
                </span>
                <span className="text-[10px] text-muted">ACTIVE PROVIDERS</span>
              </div>

              <div className="space-y-2">
                {keysList.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      item.isPrimary
                        ? "bg-accent/5 border-accent/40 shadow-xs"
                        : "bg-base border-line hover:border-line/80"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-raised border border-line flex items-center justify-center text-base shrink-0">
                        {PROVIDERS.find((p) => p.id === item.provider)?.icon || "🔑"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold font-mono text-ink truncate">{item.name}</span>
                          {item.isPrimary && (
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-accent text-white font-bold">
                              PRIMARY
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-muted">
                          <span>
                            {item.key.substring(0, 7)}...{item.key.substring(item.key.length - 4)}
                          </span>
                          <span>•</span>
                          <span className="uppercase">{item.provider}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge & Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {item.status === "VERIFIED" && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="h-3 w-3" /> Verified
                        </span>
                      )}
                      {item.status === "EXCEEDED" && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/30 flex items-center gap-1 font-semibold">
                          <AlertCircle className="h-3 w-3" /> Quota Exceeded
                        </span>
                      )}
                      {item.status === "INVALID" && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/30 flex items-center gap-1 font-semibold">
                          <AlertCircle className="h-3 w-3" /> Invalid
                        </span>
                      )}
                      {item.status === "UNVERIFIED" && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-raised text-muted border border-line font-semibold">
                          Active
                        </span>
                      )}

                      {!item.isPrimary && (
                        <button
                          onClick={() => handleSetPrimary(item.id)}
                          className="px-2.5 py-1 rounded-lg bg-raised hover:bg-line border border-line text-[11px] font-mono text-muted hover:text-ink transition-all"
                          title="Set as Primary Key"
                        >
                          Make Primary
                        </button>
                      )}

                      <button
                        onClick={() => handleRemoveKey(item.id)}
                        className="p-1.5 rounded-lg bg-raised hover:bg-red-500/10 text-muted hover:text-red-500 transition-all border border-line"
                        title="Remove Key"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Key Form Toggle */}
          {keysList.length > 0 && !showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-2.5 rounded-2xl border border-dashed border-line hover:border-accent text-xs font-mono text-muted hover:text-accent flex items-center justify-center gap-2 transition-all bg-base/50"
            >
              <Plus className="h-4 w-4" />
              <span>Add API Key (OpenAI, Gemini, Anthropic, Groq)</span>
            </button>
          )}

          {/* Add / Verify API Key Form */}
          {(showAddForm || keysList.length === 0) && (
            <form onSubmit={handleAddKey} className="p-4 rounded-2xl bg-base border border-line space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <span className="text-xs font-mono font-bold text-ink flex items-center gap-1.5">
                  <Key className="h-4 w-4 text-accent" /> ENTER API KEY CREDENTIAL
                </span>
                {keysList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="text-[11px] font-mono text-muted hover:text-ink"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* Provider Selection Bar */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono font-bold text-muted block uppercase">
                  Select Provider
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setProvider(p.id);
                        setVerificationResult(null);
                      }}
                      className={`p-2.5 rounded-xl border text-xs font-mono flex items-center gap-2 transition-all ${
                        provider === p.id
                          ? "bg-accent/15 border-accent text-accent font-bold"
                          : "bg-surface border-line text-muted hover:text-ink hover:border-line/80"
                      }`}
                    >
                      <span>{p.icon}</span>
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Key Nickname */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono font-bold text-muted block uppercase">
                  Key Label / Identifier (Optional)
                </label>
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g. Production Gemini Key, Backup OpenAI Key"
                  className="w-full bg-surface border border-line rounded-xl px-3.5 py-2 text-xs text-ink font-mono placeholder:text-muted focus:outline-none focus:border-accent"
                />
              </div>

              {/* Key Secret Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono font-bold text-muted block uppercase">
                  API Key Secret
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      if (verificationResult) setVerificationResult(null);
                    }}
                    placeholder={PROVIDERS.find((p) => p.id === provider)?.placeholder || "Enter key..."}
                    className="w-full bg-surface border border-line rounded-xl pl-3.5 pr-12 py-2.5 text-xs text-ink font-mono placeholder:text-muted focus:outline-none focus:border-accent"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3.5 text-muted hover:text-ink transition-colors p-1"
                    title={showKey ? "Hide Secret" : "Show Secret"}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Verification Feedback Banner */}
              {verificationResult && (
                <div
                  className={`p-3 rounded-xl border text-xs font-mono flex items-start gap-2 ${
                    verificationResult.status === "VERIFIED"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                      : verificationResult.status === "EXCEEDED"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-600"
                      : "bg-red-500/10 border-red-500/30 text-red-500"
                  }`}
                >
                  {verificationResult.status === "VERIFIED" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold">
                      {verificationResult.status === "VERIFIED"
                        ? "VERIFICATION SUCCESS"
                        : verificationResult.status === "EXCEEDED"
                        ? "QUOTA / RATE LIMIT EXCEEDED"
                        : "VERIFICATION FAILED"}
                    </div>
                    <div className="text-[11px] opacity-90 mt-0.5">
                      {verificationResult.message || "Please check your API key secret and provider."}
                    </div>
                  </div>
                </div>
              )}

              {/* Form Actions: Verify API Key & Save Key */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={isVerifying || !apiKey.trim()}
                  className="px-4 py-2 rounded-xl border border-line bg-raised hover:bg-line text-xs font-mono text-ink font-semibold disabled:opacity-50 flex items-center gap-1.5 transition-all"
                >
                  {isVerifying ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-accent" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                  )}
                  <span>Verify API Key</span>
                </button>

                <button
                  type="submit"
                  disabled={isVerifying || !apiKey.trim()}
                  className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 transition-all shadow-md shadow-accent/20"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Save Key to Pool</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        {hasActiveKey && (
          <div className="p-4 border-t border-line bg-raised/30 flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-semibold hover:opacity-90 transition-all shadow-md shadow-accent/20"
            >
              Continue to Simulation
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
