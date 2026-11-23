"use client";

import React, { useState, useEffect } from "react";
import {
  Key,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  Plus,
  Trash2,
  RefreshCw,
  Zap,
  X,
} from "lucide-react";
import { keyService, ApiKeyItem, ProviderType } from "@/lib/api/keyService";

interface ApiKeyGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRequired?: boolean;
  onKeySubmitted?: (key: string) => void;
}

const PROVIDERS: { id: ProviderType; name: string; icon: string; placeholder: string; models: string }[] = [
  { id: "gemini", name: "Google Gemini", icon: "💎", placeholder: "AIzaSy... or AQ....", models: "Gemini 3.5 & 3.8" },
  { id: "groq", name: "Groq", icon: "🚀", placeholder: "gsk_...", models: "OpenAI GPT-OSS 120B & 20B" },
  { id: "openai", name: "OpenAI GPT", icon: "⚡", placeholder: "sk-proj-...", models: "GPT-4o & 4o-mini" },
  { id: "anthropic", name: "Anthropic Claude", icon: "🧠", placeholder: "sk-ant-...", models: "Claude 3.5 Sonnet & Haiku" },
  { id: "custom", name: "Custom Provider", icon: "🔑", placeholder: "sk-or-... or custom key", models: "OpenRouter & Compatible" },
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

      if (onKeySubmitted && newKey.item?.key) {
        onKeySubmitted(newKey.item.key);
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
    <div className="fixed inset-0 z-50 bg-base/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-surface border border-line rounded-3xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 select-none">
        {/* Modal Top Header */}
        <div className="p-6 border-b border-line bg-raised/40 relative">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shrink-0">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-ink">API Key & Model Access</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-semibold">
                  BYOK
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Connect your official API credentials for high-throughput multi-agent simulations.
              </p>
            </div>
          </div>

          {(!isRequired || hasActiveKey) && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-muted hover:text-ink p-1.5 rounded-lg hover:bg-base border border-transparent hover:border-line transition-all"
              title="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Active Key List */}
          {keysList.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-ink flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-emerald-600" /> CONFIGURED KEYS ({keysList.length})
                </span>
                <span className="text-[10px] text-muted">PRIMARY ENGINE</span>
              </div>

              <div className="space-y-2">
                {keysList.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      item.isPrimary
                        ? "bg-emerald-500/5 border-emerald-500/30 shadow-xs"
                        : "bg-base border-line hover:border-line/80"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-raised border border-line flex items-center justify-center text-sm shrink-0">
                        {PROVIDERS.find((p) => p.id === item.provider)?.icon || "🔑"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold font-mono text-ink truncate">{item.name}</span>
                          {item.isPrimary && (
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold">
                              PRIMARY
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-muted">
                          <span>
                            {item.key.substring(0, 7)}...{item.key.substring(item.key.length - 4)}
                          </span>
                          <span>•</span>
                          <span className="uppercase text-[10px] text-emerald-600 font-semibold">{item.provider}</span>
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
                          className="px-2 py-1 rounded-lg bg-raised hover:bg-line border border-line text-[10px] font-mono text-muted hover:text-ink transition-all"
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
              className="w-full py-2.5 rounded-xl border border-dashed border-line hover:border-emerald-500/60 text-xs font-mono text-muted hover:text-ink flex items-center justify-center gap-2 transition-all bg-base/40"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Another Provider Key</span>
            </button>
          )}

          {/* Add / Verify API Key Form */}
          {(showAddForm || keysList.length === 0) && (
            <form onSubmit={handleAddKey} className="p-4 rounded-2xl bg-base border border-line space-y-3.5">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <span className="text-xs font-mono font-bold text-ink flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-emerald-600" /> REGISTER API KEY
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

              {/* Provider Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-muted block uppercase">
                  Select Provider
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setProvider(p.id);
                        setVerificationResult(null);
                      }}
                      className={`p-2 rounded-xl border text-xs font-mono text-left transition-all ${
                        provider === p.id
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600 font-bold"
                          : "bg-surface border-line text-muted hover:text-ink hover:border-line/80"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{p.icon}</span>
                        <span className="truncate">{p.name}</span>
                      </div>
                      <div className="text-[9px] text-muted font-normal mt-0.5 truncate">{p.models}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Key Nickname */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-muted block uppercase">
                  Key Label (Optional)
                </label>
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g. Primary Key"
                  className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-xs text-ink font-mono placeholder:text-muted/60 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Key Secret Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-muted block uppercase">
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
                    className="w-full bg-surface border border-line rounded-xl pl-3 pr-10 py-2 text-xs text-ink font-mono placeholder:text-muted/60 focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 text-muted hover:text-ink transition-colors p-1"
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

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={isVerifying || !apiKey.trim()}
                  className="px-3.5 py-1.5 rounded-xl border border-line bg-raised hover:bg-line text-xs font-mono text-ink font-semibold disabled:opacity-50 flex items-center gap-1.5 transition-all"
                >
                  {isVerifying ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  )}
                  <span>Verify Key</span>
                </button>

                <button
                  type="submit"
                  disabled={isVerifying || !apiKey.trim()}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Save Key</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        {hasActiveKey && (
          <div className="p-4 border-t border-line bg-raised/30 flex items-center justify-between">
            <span className="text-[11px] font-mono text-muted flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-emerald-600" /> Zero Server Log Retention
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-all shadow-xs"
            >
              Continue to Simulation
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
