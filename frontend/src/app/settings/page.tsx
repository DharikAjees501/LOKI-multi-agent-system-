"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  Key,
  Eye,
  EyeOff,
  ShieldCheck,
  Plus,
  Trash2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Cpu,
  Lock,
  Layers,
  Sparkles,
  X,
} from "lucide-react";
import { keyService, ApiKeyItem, ProviderType } from "@/lib/api/keyService";

const PROVIDERS: {
  id: ProviderType;
  name: string;
  icon: string;
  placeholder: string;
  badge: string;
  models: string;
  desc: string;
}[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    icon: "💎",
    placeholder: "AIzaSy... or AQ....",
    badge: "Gemini 3.5 & 3.8",
    models: "Gemini 3.5 Flash-Lite & 3.8",
    desc: "Primary reasoning & multi-agent deliberation",
  },
  {
    id: "groq",
    name: "Groq",
    icon: "🚀",
    placeholder: "gsk_...",
    badge: "GPT-OSS",
    models: "OpenAI GPT-OSS 120B & 20B",
    desc: "Ultra-fast inference & high-throughput agent responses",
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: "⚡",
    placeholder: "sk-proj-...",
    badge: "GPT-4o",
    models: "GPT-4o & GPT-4o-mini",
    desc: "Executive synthesis & boardroom strategy",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    icon: "🧠",
    placeholder: "sk-ant-...",
    badge: "Claude 3.5",
    models: "Claude 3.5 Sonnet & Haiku",
    desc: "Strategic interrogation & regulatory audits",
  },
  {
    id: "custom",
    name: "Custom Provider",
    icon: "🔑",
    placeholder: "sk-or-... or custom API key",
    badge: "Compatible",
    models: "OpenRouter & OpenAI-compatible",
    desc: "External custom endpoint support",
  },
];

export default function SettingsPage() {
  const [keysList, setKeysList] = useState<ApiKeyItem[]>([]);
  const [provider, setProvider] = useState<ProviderType>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [keyName, setKeyName] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    status: "VERIFIED" | "EXCEEDED" | "INVALID" | "UNCHECKED";
    message: string;
  } | null>(null);

  useEffect(() => {
    const keys = keyService.getKeys();
    setKeysList(keys);

    const handleKeysSync = () => {
      setKeysList(keyService.getKeys());
    };
    window.addEventListener("loki_keys_updated", handleKeysSync);
    return () => window.removeEventListener("loki_keys_updated", handleKeysSync);
  }, []);

  const handleVerify = async () => {
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      setVerificationResult({
        valid: false,
        status: "INVALID",
        message: "Please enter an API key to verify.",
      });
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);
    const res = await keyService.verifyKey(cleanKey, provider);
    setVerificationResult(res);
    setIsVerifying(false);
  };

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = apiKey.trim();
    if (!cleanKey) return;

    setIsVerifying(true);
    setVerificationResult(null);
    try {
      await keyService.addKey(cleanKey, provider, keyName);
      const updated = keyService.getKeys();
      setKeysList(updated);
      setApiKey("");
      setKeyName("");
      setVerificationResult({
        valid: true,
        status: "VERIFIED",
        message: `${provider.toUpperCase()} API key verified and registered successfully.`,
      });
      setTimeout(() => setVerificationResult(null), 3000);
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
  };

  const handleSetPrimary = (id: string) => {
    const updated = keyService.setPrimary(id);
    setKeysList(updated);
  };

  const handleClearAll = async () => {
    if (confirm("Clear all registered API keys from the current session?")) {
      const updated = await keyService.clearAllKeys();
      setKeysList(updated);
      setVerificationResult(null);
    }
  };

  return (
    <AppShell title="SETTINGS" subtitle="API KEY & MODEL CONFIGURATION">
      {() => (
        <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6 select-none">
          {/* Minimal Classic Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-line">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-ink font-display">API Key & Model Management</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-semibold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE ENGINE
                </span>
              </div>
              <p className="text-xs text-muted mt-1">
                Configure your official provider credentials for multi-agent simulation with zero persistent storage retention.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-raised border border-line text-ink">
                {keysList.length} {keysList.length === 1 ? "Active Key" : "Active Keys"}
              </span>
              {keysList.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs font-mono px-3 py-1 rounded-full text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all flex items-center gap-1"
                  title="Purge all keys from memory"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Clear All</span>
                </button>
              )}
            </div>
          </div>

          {/* 2-Column Responsive Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (7 cols): Active Keys + Add Form */}
            <div className="lg:col-span-7 space-y-6">
              {/* Active Keys List */}
              <div className="rounded-2xl border border-line bg-surface p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-line">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-emerald-600" />
                    <h2 className="text-sm font-semibold text-ink">Configured Keys</h2>
                  </div>
                  {keysList.length > 0 && (
                    <span className="text-[11px] font-mono text-muted">Primary key handles agent requests</span>
                  )}
                </div>

                {keysList.length > 0 ? (
                  <div className="space-y-2">
                    {keysList.map((item, index) => {
                      const provConfig = PROVIDERS.find((p) => p.id === item.provider);
                      return (
                        <div
                          key={item.id}
                          className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                            item.isPrimary
                              ? "bg-emerald-500/5 border-emerald-500/30 shadow-xs"
                              : "bg-base border-line hover:border-line/80"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-xl bg-raised border border-line flex items-center justify-center text-base shrink-0">
                              {provConfig?.icon || "🔑"}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-ink truncate">{item.name}</span>
                                {item.isPrimary ? (
                                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold">
                                    PRIMARY
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-raised border border-line text-muted">
                                    #{index + 1}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted truncate mt-0.5 flex items-center gap-2 font-mono">
                                <span>
                                  {item.key.substring(0, 8)}...{item.key.substring(item.key.length - 4)}
                                </span>
                                <span>•</span>
                                <span className="uppercase text-[10px] font-semibold text-emerald-600">
                                  {item.provider}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Status & Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {item.status === "VERIFIED" && (
                              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Verified
                              </span>
                            )}
                            {item.status === "EXCEEDED" && (
                              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/30 font-semibold flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Quota Exceeded
                              </span>
                            )}
                            {item.status === "INVALID" && (
                              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 border border-red-500/30 font-semibold flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Invalid
                              </span>
                            )}
                            {item.status === "UNVERIFIED" && (
                              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-raised text-muted border border-line font-semibold">
                                Active
                              </span>
                            )}

                            {!item.isPrimary && (
                              <button
                                onClick={() => handleSetPrimary(item.id)}
                                className="px-2.5 py-1 rounded-lg bg-raised hover:bg-line border border-line text-[11px] font-mono text-muted hover:text-ink transition-all"
                              >
                                Set Primary
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
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl border border-dashed border-line text-center space-y-1 bg-base/40">
                    <p className="text-xs font-semibold text-ink">No API keys registered</p>
                    <p className="text-[11px] text-muted">Add a key below to execute autonomous agent simulations.</p>
                  </div>
                )}
              </div>

              {/* Add Key Form */}
              <div className="rounded-2xl border border-line bg-surface p-5 space-y-4 shadow-xs">
                <div className="border-b border-line pb-3">
                  <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
                    <Plus className="h-4 w-4 text-emerald-600" /> Add API Key
                  </h2>
                  <p className="text-[11px] text-muted mt-0.5">
                    Connect an official LLM key to unlock unlimited high-throughput agent deliberation.
                  </p>
                </div>

                <form onSubmit={handleAddKey} className="space-y-4">
                  {/* Provider Pills */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono font-medium text-muted block uppercase tracking-wider">
                      Provider
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {PROVIDERS.map((p) => {
                        const isSelected = provider === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setProvider(p.id);
                              setVerificationResult(null);
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all ${
                              isSelected
                                ? "bg-emerald-500/10 border-emerald-500/40 text-ink font-semibold shadow-2xs"
                                : "bg-base border-line text-muted hover:text-ink hover:border-line/80"
                            }`}
                          >
                            <div className="text-sm">{p.icon}</div>
                            <div className="text-xs font-medium mt-1 truncate">{p.name}</div>
                            <div className="text-[10px] text-muted font-mono">{p.badge}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-mono font-medium text-muted block uppercase tracking-wider">
                        Key Label (Optional)
                      </label>
                      <input
                        type="text"
                        value={keyName}
                        onChange={(e) => setKeyName(e.target.value)}
                        placeholder="e.g. Production Key"
                        className="w-full bg-base border border-line rounded-xl px-3.5 py-2 text-xs text-ink font-mono placeholder:text-muted/60 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-mono font-medium text-muted block uppercase tracking-wider">
                        API Key Secret
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type={showApiKey ? "text" : "password"}
                          value={apiKey}
                          onChange={(e) => {
                            setApiKey(e.target.value);
                            if (verificationResult) setVerificationResult(null);
                          }}
                          placeholder={PROVIDERS.find((p) => p.id === provider)?.placeholder || "Enter API Key"}
                          className="w-full bg-base border border-line rounded-xl pl-3.5 pr-10 py-2 text-xs text-ink font-mono placeholder:text-muted/60 focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 text-muted hover:text-ink p-1"
                          title={showApiKey ? "Hide Secret" : "Show Secret"}
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Feedback Banner */}
                  {verificationResult && (
                    <div
                      className={`p-3 rounded-xl border text-xs font-mono flex items-start gap-2.5 ${
                        verificationResult.status === "VERIFIED"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                          : verificationResult.status === "EXCEEDED"
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-600"
                          : "bg-red-500/10 border-red-500/30 text-red-500"
                      }`}
                    >
                      {verificationResult.status === "VERIFIED" && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                      )}
                      {verificationResult.status === "EXCEEDED" && (
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                      )}
                      {verificationResult.status === "INVALID" && (
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                      )}
                      <div>
                        <div className="font-bold">
                          {verificationResult.status === "VERIFIED" && "Verification Successful"}
                          {verificationResult.status === "EXCEEDED" && "Quota / Rate Limit Exceeded"}
                          {verificationResult.status === "INVALID" && "Verification Failed"}
                        </div>
                        <div className="text-[11px] opacity-90 mt-0.5">{verificationResult.message}</div>
                      </div>
                    </div>
                  )}

                  {/* Form Actions */}
                  <div className="flex items-center justify-end gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={handleVerify}
                      disabled={isVerifying || !apiKey.trim()}
                      className="px-4 py-2 rounded-xl border border-line bg-raised hover:bg-line text-xs font-medium text-ink disabled:opacity-50 flex items-center gap-1.5 transition-all"
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
                      className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5 transition-all shadow-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Save Key</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Right Column (5 cols): Supported Models & Zero Retention Architecture */}
            <div className="lg:col-span-5 space-y-6">
              {/* Models Reference Card */}
              <div className="rounded-2xl border border-line bg-surface p-5 space-y-4 shadow-xs">
                <div className="border-b border-line pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-emerald-600" />
                    <h2 className="text-sm font-semibold text-ink">Supported Models</h2>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-raised border border-line text-muted">
                    PRIMARY TIERS
                  </span>
                </div>

                <div className="space-y-2.5">
                  {PROVIDERS.filter((p) => p.id !== "custom").map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl bg-base border border-line hover:border-line/80 transition-all space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{p.icon}</span>
                          <span className="text-xs font-semibold text-ink">{p.name}</span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold">
                          {p.badge}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-ink/90 font-medium pl-6">{p.models}</div>
                      <p className="text-[10px] text-muted pl-6">{p.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Zero Log Retention Security Card */}
              <div className="rounded-2xl border border-line bg-surface p-5 space-y-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
                    Zero Log Retention & BYOK
                  </h3>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Your credentials are used solely in-memory to execute agent reasoning and generate simulation insights.
                  API keys are never written to server logs, ORM models, or shared across tenant environments.
                </p>
                <div className="pt-2 border-t border-line flex items-center justify-between text-[11px] font-mono text-muted">
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <ShieldCheck className="h-3.5 w-3.5" /> End-to-End Encrypted Session
                  </span>
                  <span>HTTP/2 TLS</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
