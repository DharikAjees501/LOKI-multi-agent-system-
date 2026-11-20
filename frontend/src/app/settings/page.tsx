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
  Lock,
  CheckCircle2,
  Cpu,
  Layers,
  Sparkles,
} from "lucide-react";
import { keyService, ApiKeyItem, ProviderType } from "@/lib/api/keyService";

const PROVIDERS: { id: ProviderType; name: string; icon: string; placeholder: string; badge: string; desc: string }[] = [
  { id: "gemini", name: "Google Gemini", icon: "💎", placeholder: "AIzaSy... or AQ....", badge: "Recommended", desc: "Gemini 1.5 Flash & Pro models" },
  { id: "openai", name: "OpenAI GPT", icon: "⚡", placeholder: "sk-proj-...", badge: "Fast", desc: "GPT-4o & GPT-4o-mini models" },
  { id: "anthropic", name: "Anthropic Claude", icon: "🧠", placeholder: "sk-ant-...", badge: "Reasoning", desc: "Claude 3.5 Sonnet & Haiku models" },
  { id: "groq", name: "Groq / Llama", icon: "🚀", placeholder: "gsk_...", badge: "Ultra-Fast", desc: "Llama 3.3 70B & 8B fast inference" },
  { id: "custom", name: "Custom Provider", icon: "🔑", placeholder: "Enter API key...", badge: "Custom", desc: "OpenRouter & custom compatible APIs" },
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
        message: `${provider.toUpperCase()} API key verified by official provider and saved to pool!`,
      });
      setTimeout(() => setVerificationResult(null), 3500);
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

  const activeKeysCount = keysList.length;

  return (
    <AppShell title="SETTINGS" subtitle="MULTI-PROVIDER API KEY MANAGEMENT">
      {() => (
        <div className="space-y-6 max-w-7xl mx-auto pb-16 select-none">
          {/* Top Header Banner */}
          <div className="rounded-3xl border border-line bg-surface p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm relative overflow-hidden">
            <div className="absolute -right-16 -top-16 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center gap-4 relative">
              <div className="h-12 w-12 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center text-accent shrink-0">
                <Key className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-bold text-ink">API Key Access & Provider Management</h3>
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE ENGINE
                  </span>
                </div>
                <p className="text-xs text-muted mt-0.5">
                  Configure and verify your official API key credentials (Google Gemini, OpenAI, Anthropic Claude, Groq) with zero log retention.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-line pt-4 md:pt-0">
              <div className="text-right">
                <div className="text-[10px] font-mono text-muted uppercase">ACTIVE KEY POOL</div>
                <div className="text-xs font-mono font-bold text-accent">{activeKeysCount} Provider Keys Registered</div>
              </div>
            </div>
          </div>

          {/* 2-Column Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN: API Keys Pool Manager (7 Columns) */}
            <div className="lg:col-span-7 space-y-6">
              
              <div className="rounded-3xl border border-line bg-surface p-6 space-y-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-line pb-4">
                  <div>
                    <h4 className="font-display text-sm font-bold text-ink flex items-center gap-2">
                      <Key className="h-4 w-4 text-accent" /> API Keys & Multi-Provider Failover Pool
                    </h4>
                    <p className="text-[11px] text-muted font-mono mt-0.5">
                      Automatic zero-downtime failover across providers on HTTP 429 rate limits.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded-xl bg-raised border border-line text-muted font-semibold">
                    {activeKeysCount} ACTIVE
                  </span>
                </div>

                {/* Active Key List */}
                {keysList.length > 0 ? (
                  <div className="space-y-3 font-mono">
                    <div className="flex items-center justify-between text-muted text-[10px] font-bold tracking-wider uppercase px-1">
                      <span>KEY POOL PRIORITY ORDER</span>
                      <span>STATUS</span>
                    </div>

                    <div className="space-y-2.5">
                      {keysList.map((item, index) => {
                        const provConfig = PROVIDERS.find((p) => p.id === item.provider);
                        return (
                          <div
                            key={item.id}
                            className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                              item.isPrimary
                                ? "bg-accent/5 border-accent/40 shadow-xs"
                                : "bg-base/60 border-line hover:border-line/80"
                            }`}
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className="h-10 w-10 rounded-xl bg-raised border border-line flex items-center justify-center text-lg shrink-0">
                                {provConfig?.icon || "🔑"}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-ink truncate">{item.name}</span>
                                  {item.isPrimary ? (
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-accent text-white font-bold tracking-wide">
                                      PRIMARY
                                    </span>
                                  ) : (
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-raised border border-line text-muted font-medium">
                                      PRIORITY #{index + 1}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-muted truncate mt-1 flex items-center gap-2">
                                  <span className="font-mono">{item.key.substring(0, 8)}...{item.key.substring(item.key.length - 4)}</span>
                                  <span>•</span>
                                  <span className="uppercase text-[10px] font-semibold text-accent">{item.provider}</span>
                                </div>
                              </div>
                            </div>

                            {/* Status & Actions */}
                            <div className="flex items-center gap-2 shrink-0">
                              {item.status === "VERIFIED" && (
                                <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Verified
                                </span>
                              )}
                              {item.status === "EXCEEDED" && (
                                <span className="text-[10px] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/30 font-semibold flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" /> Quota Exceeded
                                </span>
                              )}
                              {item.status === "INVALID" && (
                                <span className="text-[10px] px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 border border-red-500/30 font-semibold flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" /> Invalid
                                </span>
                              )}
                              {item.status === "UNVERIFIED" && (
                                <span className="text-[10px] px-2.5 py-1 rounded-full bg-raised text-muted border border-line font-semibold">
                                  Active
                                </span>
                              )}

                              {!item.isPrimary && (
                                <button
                                  onClick={() => handleSetPrimary(item.id)}
                                  className="px-2.5 py-1 rounded-xl bg-raised hover:bg-line border border-line text-[11px] text-muted hover:text-ink transition-all"
                                >
                                  Make Primary
                                </button>
                              )}

                              <button
                                onClick={() => handleRemoveKey(item.id)}
                                className="p-1.5 rounded-xl bg-raised hover:bg-red-500/10 text-muted hover:text-red-500 transition-all border border-line"
                                title="Remove Key"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl bg-base border border-line text-xs font-mono text-muted text-center space-y-2">
                    <p className="font-semibold text-ink">No API Keys Configured in Pool</p>
                    <p className="text-[11px] opacity-80">
                      Add an API key below to enable multi-turn AI interrogation and dynamic simulation features.
                    </p>
                  </div>
                )}

                {/* Add New Key Form */}
                <form onSubmit={handleAddKey} className="p-5 rounded-2xl bg-base/70 border border-line space-y-4 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink uppercase flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5 text-accent" /> ADD NEW API KEY TO POOL
                    </span>
                    <span className="text-[10px] text-muted">Auto-Encrypted Storage</span>
                  </div>

                  {/* Provider Pills */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-muted block font-bold">SELECT PROVIDER</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {PROVIDERS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setProvider(p.id);
                            setVerificationResult(null);
                          }}
                          className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-1.5 transition-all ${
                            provider === p.id
                              ? "bg-accent/15 border-accent text-accent font-bold shadow-xs"
                              : "bg-surface border-line text-muted hover:text-ink"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span>{p.icon}</span>
                            <span className="truncate">{p.name}</span>
                          </div>
                          <span className="text-[9px] opacity-60 font-mono hidden sm:inline">{p.badge}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Key Secret Input & Label */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted block font-bold">KEY LABEL (OPTIONAL)</label>
                      <input
                        type="text"
                        value={keyName}
                        onChange={(e) => setKeyName(e.target.value)}
                        placeholder="e.g. Primary Production Key"
                        className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-xs text-ink focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-muted block font-bold">API KEY SECRET</label>
                      <div className="relative flex items-center">
                        <input
                          type={showApiKey ? "text" : "password"}
                          value={apiKey}
                          onChange={(e) => {
                            setApiKey(e.target.value);
                            if (verificationResult) setVerificationResult(null);
                          }}
                          placeholder={PROVIDERS.find((p) => p.id === provider)?.placeholder || "Enter API Key"}
                          className="w-full bg-surface border border-line rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-ink focus:outline-none focus:border-accent"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 text-muted hover:text-ink p-1"
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Verification Banner */}
                  {verificationResult && (
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                        verificationResult.status === "VERIFIED"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                          : verificationResult.status === "EXCEEDED"
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-600"
                          : "bg-red-500/10 border-red-500/30 text-red-500"
                      }`}
                    >
                      {verificationResult.status === "VERIFIED" && <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />}
                      {verificationResult.status === "EXCEEDED" && <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                      {verificationResult.status === "INVALID" && <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                      <div>
                        <div className="font-bold">
                          {verificationResult.status === "VERIFIED" && "API KEY VERIFIED"}
                          {verificationResult.status === "EXCEEDED" && "QUOTA / RATE LIMIT EXCEEDED"}
                          {verificationResult.status === "INVALID" && "INVALID API KEY"}
                        </div>
                        <div className="text-[11px] opacity-90 mt-0.5">{verificationResult.message}</div>
                      </div>
                    </div>
                  )}

                  {/* Submit Actions */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleVerify}
                      disabled={isVerifying || !apiKey.trim()}
                      className="px-4 py-2 rounded-xl border border-line bg-raised hover:bg-line text-xs font-semibold text-ink disabled:opacity-50 flex items-center gap-1.5 transition-all"
                    >
                      {isVerifying ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-accent" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                      )}
                      <span>Verify Key</span>
                    </button>

                    <button
                      type="submit"
                      disabled={isVerifying || !apiKey.trim()}
                      className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 transition-all shadow-md shadow-accent/20"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add to Pool</span>
                    </button>
                  </div>
                </form>
              </div>

            </div>

            {/* RIGHT COLUMN: Supported Providers & Security (5 Columns) */}
            <div className="lg:col-span-5 space-y-6">

              {/* Supported Providers Reference Card */}
              <div className="rounded-3xl border border-line bg-surface p-6 space-y-4 shadow-sm font-mono">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <h4 className="font-display text-sm font-bold text-ink flex items-center gap-2">
                    <Layers className="h-4 w-4 text-accent" /> Supported LLM Providers
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/30 font-semibold">
                    BYOK
                  </span>
                </div>

                <div className="space-y-2.5">
                  {PROVIDERS.filter((p) => p.id !== "custom").map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-2xl bg-base border border-line flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{p.icon}</span>
                        <div>
                          <div className="text-xs font-bold text-ink">{p.name}</div>
                          <div className="text-[10px] text-muted">{p.desc}</div>
                        </div>
                      </div>
                      <span className="text-[9px] px-2 py-0.5 rounded-md bg-raised border border-line text-muted">
                        {p.placeholder.split("...")[0]}...
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security & Privacy Rules */}
              <div className="p-5 rounded-3xl bg-base border border-line flex items-start gap-3.5 text-xs font-mono text-muted leading-relaxed">
                <Lock className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <span className="font-bold text-ink block text-xs">ZERO LOG RETENTION & SECURE BYOK</span>
                  <p className="text-[11px] opacity-80 leading-normal">
                    Your API keys are stored in encrypted client browser storage and used solely to probe and execute agent decisions. Keys are never logged in cleartext or shared across tenant environments.
                  </p>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}
    </AppShell>
  );
}
