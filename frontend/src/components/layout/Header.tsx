"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Bell,
  FileUp,
  Cpu,
  Activity,
  User as UserIcon,
  Globe,
  Key,
  CheckCircle2,
  AlertCircle,
  DoorOpen,
  Trash2,
  Zap,
  ChevronDown,
  LogOut,
  Clock,
  Layers,
  ShieldCheck,
  FileText,
  Plus,
} from "lucide-react";
import { ApiKeyGateModal } from "@/components/auth/ApiKeyGateModal";
import { AuthModal } from "@/components/auth/AuthModal";
import { keyService } from "@/lib/api/keyService";
import { useAuth } from "@/context/AuthContext";
import {
  clearActiveScenarioContext,
  autoInitializeActiveScenario,
  deleteActiveScenarioAndDoc,
  setActiveScenarioContext,
} from "@/lib/api/scenarioApi";

interface HeaderProps {
  title: string;
  subtitle?: string;
  currentRound: number;
  totalRounds: number;
  activeAgentsCount: number;
  onOpenUpload: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle = "Dynamic Real-Time Pipeline · Active Swarm Simulation",
  currentRound,
  activeAgentsCount,
  onOpenUpload,
}) => {
  const router = useRouter();
  const { user, isAuthenticated, openAuthModal, logout, refreshUser } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [hasDoc, setHasDoc] = useState<boolean>(false);
  const [docSubtitle, setDocSubtitle] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);

  const menuRef = useRef<HTMLDivElement>(null);

  const syncDoc = async () => {
    if (typeof window !== "undefined") {
      let doc =
        localStorage.getItem("SWARMLENS_ACTIVE_DOC_NAME") ||
        localStorage.getItem("LOKI_ACTIVE_DOC_NAME");
      if (!doc || doc === "No document loaded") {
        if (localStorage.getItem("SWARMLENS_MANUALLY_CLEARED") !== "true") {
          const initialized = await autoInitializeActiveScenario();
          if (initialized) {
            doc = initialized.documentName;
          }
        }
      }
      const isDocValid = !!(doc && doc.trim().length > 0 && doc !== "No document loaded");
      setHasDoc(isDocValid);
      if (isDocValid) {
        const scenDesc =
          localStorage.getItem("SWARMLENS_ACTIVE_SCENARIO_DESC") ||
          localStorage.getItem("LOKI_ACTIVE_SCENARIO_DESC");
        const descPreview = scenDesc
          ? ` · ${scenDesc.length > 50 ? scenDesc.slice(0, 50) + "..." : scenDesc}`
          : "";
        setDocSubtitle(`${doc}${descPreview}`);
      } else {
        setDocSubtitle("");
      }
    }
  };

  const handleDeleteDoc = async () => {
    setIsDeleting(true);
    try {
      await deleteActiveScenarioAndDoc();
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    const syncKeys = () => {
      const keys = keyService.getKeys();
      if (keys.length > 0) {
        setApiKey(keys[0].key);
      } else {
        setApiKey(null);
      }
    };
    syncKeys();
    syncDoc();

    const handleQuotaExceeded = () => {
      setIsKeyModalOpen(true);
    };

    window.addEventListener("loki_keys_updated", syncKeys);
    window.addEventListener("loki_keys_empty", syncKeys);
    window.addEventListener("loki_doc_updated", syncDoc);
    window.addEventListener("swarmlens_doc_updated", syncDoc);
    window.addEventListener("loki_quota_exceeded", handleQuotaExceeded);

    // Close user dropdown when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("loki_keys_updated", syncKeys);
      window.removeEventListener("loki_keys_empty", syncKeys);
      window.removeEventListener("loki_doc_updated", syncDoc);
      window.removeEventListener("swarmlens_doc_updated", syncDoc);
      window.removeEventListener("loki_quota_exceeded", handleQuotaExceeded);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleKeySubmitted = (newKey: string) => {
    setApiKey(newKey);
  };

  const handleSelectScenario = (scen: any) => {
    const docName = scen.document_id || `${scen.name.replace(/\s+/g, "_")}.pdf`;
    setActiveScenarioContext(scen.id, docName, scen.name, scen.description || "");
    setIsUserMenuOpen(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("loki_doc_updated"));
      window.dispatchEvent(new Event("swarmlens_doc_updated"));
      window.dispatchEvent(new Event("scenario_changed"));
    }
  };

  const isKeyActive = !!(apiKey && apiKey.trim().length > 0) || keyService.hasValidBYOK();
  const freeRemaining = user?.free_sessions_remaining ?? 2;

  return (
    <>
      <header className="h-16 border-b border-line bg-surface px-6 flex items-center justify-between shrink-0 sticky top-0 z-30 select-none shadow-xs">
        {/* Title & Identifier */}
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-ink uppercase">
            {title}
          </h2>
          {docSubtitle ? (
            <p className="text-[11px] font-mono text-muted tracking-wide truncate max-w-md">{docSubtitle}</p>
          ) : null}
        </div>

        {/* System Status Metrics - Sleek Compact Round & API Key Status Capsule */}
        <div className="flex-1 hidden md:flex items-center justify-center gap-2.5 px-4">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-raised/70 border border-line/70 backdrop-blur-md shadow-2xs">
            {/* Deliberation Round / Cycle Indicator */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface border border-line/50 text-xs font-mono shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-muted/80 font-medium text-[10.5px] tracking-wider uppercase">ROUND</span>
              <span className="font-bold text-ink text-[11px]" suppressHydrationWarning>
                {String(currentRound).padStart(2, "0")}
                <span className="text-muted/50 font-normal"> / 05</span>
              </span>
            </div>

            {/* API Key Status Pill */}
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className={`flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-mono transition-all hover:scale-102 cursor-pointer shadow-2xs ${
                isKeyActive
                  ? "bg-surface hover:bg-line/40 border-line/50 text-emerald-600"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-600 hover:bg-amber-500/20"
              }`}
              title={isKeyActive ? "Click to manage API Keys & Fallback pool" : "Click to configure Gemini or Groq API Key"}
            >
              <Key className="h-3 w-3 shrink-0 text-muted" />
              <span className="font-medium text-muted/80 text-[10.5px] tracking-wider uppercase">API KEY</span>
              <div className="flex items-center gap-1.5 pl-1.5 border-l border-line/60">
                <span className={`h-1.5 w-1.5 rounded-full ${isKeyActive ? "bg-emerald-500 shadow-xs shadow-emerald-500/50" : "bg-amber-500 animate-pulse"}`} />
                <span className={`text-[10.5px] font-bold ${isKeyActive ? "text-emerald-600" : "text-amber-600"}`}>
                  {isKeyActive ? "ACTIVE" : "CONNECT"}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Modern SaaS Quick Action Capsule */}
        <div className="flex items-center gap-2">
          {hasDoc && (
            <button
              onClick={handleDeleteDoc}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 text-[11px] font-mono font-semibold transition-all shadow-2xs disabled:opacity-50"
              title="Delete Document & Unload Workspace"
            >
              <Trash2 className={`h-3.5 w-3.5 ${isDeleting ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{isDeleting ? "Deleting..." : "Delete Doc"}</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 p-1 rounded-full bg-raised/60 border border-line/70 backdrop-blur-md shadow-2xs relative" ref={menuRef}>
            {/* Home / Return Button */}
            <Link
              href="/"
              className="h-8 w-8 rounded-full bg-surface hover:bg-line/60 border border-line/60 flex items-center justify-center text-emerald-600 transition-all hover:scale-105"
              title="Return to Landing Page"
            >
              <DoorOpen className="h-4 w-4" />
            </Link>

            {/* Primary CTA: New Simulation */}
            <button
              onClick={onOpenUpload}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-bold hover:shadow-md hover:shadow-emerald-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <FileUp className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Simulation</span>
            </button>

            {/* Profile Avatar / Google Sign-In Capsule */}
            {mounted && isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-surface hover:bg-line/60 border border-line/60 transition-all cursor-pointer group"
                  title="Your Sessions & Account"
                >
                  {user.avatar_url || user.picture ? (
                    <img
                      src={user.avatar_url || user.picture}
                      alt={user.full_name || "User"}
                      className="h-6 w-6 rounded-full border border-line object-cover"
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-700 font-bold text-xs flex items-center justify-center">
                      {(user.full_name || user.email || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden md:inline text-xs font-medium text-ink max-w-[100px] truncate">
                    {user.full_name || user.email.split("@")[0]}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted group-hover:text-ink transition-transform" />
                </button>

                {/* "Your Sessions" & Profile Dropdown Drawer */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 top-11 w-80 bg-surface border border-line rounded-2xl shadow-2xl p-4 z-50 text-ink animate-in fade-in zoom-in-95 duration-150">
                    {/* User Identity Header */}
                    <div className="flex items-center gap-3 pb-3 border-b border-line">
                      {user.avatar_url || user.picture ? (
                        <img
                          src={user.avatar_url || user.picture}
                          alt={user.full_name || "User"}
                          className="h-10 w-10 rounded-full border border-line object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-700 font-bold text-sm flex items-center justify-center">
                          {(user.full_name || user.email || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-display text-sm font-bold truncate block">
                            {user.full_name || user.email.split("@")[0]}
                          </span>
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        </div>
                        <span className="text-[11px] font-mono text-muted truncate block">
                          {user.email}
                        </span>
                      </div>
                    </div>

                    {/* Tier & Quota Status */}
                    <div className="py-2.5 px-3 my-2.5 rounded-xl bg-raised border border-line flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isKeyActive ? (
                          <>
                            <Sparkles className="h-4 w-4 text-emerald-600" />
                            <div>
                              <span className="text-[11px] font-bold text-emerald-600 block">
                                BYOK ACTIVE
                              </span>
                              <span className="text-[10px] font-mono text-muted">
                                Unlimited Simulations
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <Key className="h-4 w-4 text-amber-500" />
                            <div>
                              <span className="text-[11px] font-bold text-amber-600 block">
                                API KEY
                              </span>
                              <span className="text-[10px] font-mono text-muted">
                                Configure Gemini / Groq
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setIsKeyModalOpen(true);
                        }}
                        className="px-2 py-1 rounded-lg bg-surface border border-line text-[10px] font-mono font-bold text-ink hover:border-emerald-500/40 transition-colors"
                      >
                        {isKeyActive ? "Manage Keys" : "Connect Key"}
                      </button>
                    </div>

                    {/* "Your Sessions" Scenarios List */}
                    <div className="py-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted">
                          YOUR SAVED SESSIONS
                        </span>
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onOpenUpload();
                          }}
                          className="text-[10px] font-mono text-emerald-600 font-bold hover:underline flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          <span>New</span>
                        </button>
                      </div>

                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {user.saved_scenarios && user.saved_scenarios.length > 0 ? (
                          user.saved_scenarios.map((scen) => (
                            <div
                              key={scen.id}
                              onClick={() => handleSelectScenario(scen)}
                              className="p-2 rounded-xl border border-line hover:border-emerald-500/30 hover:bg-emerald-500/[0.03] cursor-pointer transition-all flex items-center justify-between group"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="text-xs font-semibold text-ink group-hover:text-emerald-600 block truncate">
                                  {scen.name}
                                </span>
                                <div className="flex items-center gap-2 text-[10px] font-mono text-muted">
                                  <span>{scen.agent_count || 50} Agents</span>
                                  <span>·</span>
                                  <span>{scen.created_date || "Saved"}</span>
                                </div>
                              </div>
                              <Clock className="h-3.5 w-3.5 text-muted group-hover:text-emerald-600 shrink-0 ml-2" />
                            </div>
                          ))
                        ) : (
                          <div className="p-3 text-center rounded-xl bg-raised/50 border border-line/60">
                            <span className="text-[11px] font-mono text-muted block">
                              No saved simulations yet.
                            </span>
                            <span className="text-[10px] text-muted block mt-0.5">
                              Upload a document to start your first session.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sign Out CTA */}
                    <div className="pt-3 border-t border-line flex items-center justify-between">
                      <button
                        onClick={async () => {
                          setIsUserMenuOpen(false);
                          await logout();
                          window.location.href = "/";
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-mono font-semibold text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sign Out of Workspace</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : mounted ? (
              <button
                onClick={() => router.push("/login")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface hover:bg-line/60 border border-line/60 text-xs font-medium text-ink transition-all hover:border-emerald-500/40 cursor-pointer"
                title="Sign in with Google"
              >
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Sign In</span>
              </button>
            ) : (
              <div className="h-7 w-20" />
            )}
          </div>
        </div>
      </header>

      {/* Global API Key Modal */}
      <ApiKeyGateModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        isRequired={false}
        onKeySubmitted={handleKeySubmitted}
      />

      {/* Global Google Auth Modal */}
      <AuthModal />
    </>
  );
};
