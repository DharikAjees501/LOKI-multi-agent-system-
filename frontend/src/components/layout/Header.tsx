"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, Bell, FileUp, Cpu, Activity, User as UserIcon, Globe, Key, CheckCircle2, AlertCircle, DoorOpen, Trash2 } from "lucide-react";
import { ApiKeyGateModal } from "@/components/auth/ApiKeyGateModal";
import { keyService } from "@/lib/api/keyService";

import { clearActiveScenarioContext, autoInitializeActiveScenario, deleteActiveScenarioAndDoc } from "@/lib/api/scenarioApi";

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
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [hasDoc, setHasDoc] = useState<boolean>(false);
  const [docSubtitle, setDocSubtitle] = useState<string>(subtitle);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const syncDoc = async () => {
    if (typeof window !== "undefined") {
      let doc = localStorage.getItem("SWARMLENS_ACTIVE_DOC_NAME") || localStorage.getItem("LOKI_ACTIVE_DOC_NAME");
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
        const scenDesc = localStorage.getItem("SWARMLENS_ACTIVE_SCENARIO_DESC") || localStorage.getItem("LOKI_ACTIVE_SCENARIO_DESC");
        const descPreview = scenDesc ? ` · ${scenDesc.length > 50 ? scenDesc.slice(0, 50) + "..." : scenDesc}` : "";
        setDocSubtitle(`${doc}${descPreview}`);
      } else {
        setDocSubtitle("No Active Document Loaded · Click New Simulation to Begin");
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

    window.addEventListener("loki_keys_updated", syncKeys);
    window.addEventListener("loki_keys_empty", syncKeys);
    window.addEventListener("loki_doc_updated", syncDoc);
    window.addEventListener("swarmlens_doc_updated", syncDoc);
    return () => {
      window.removeEventListener("loki_keys_updated", syncKeys);
      window.removeEventListener("loki_keys_empty", syncKeys);
      window.removeEventListener("loki_doc_updated", syncDoc);
      window.removeEventListener("swarmlens_doc_updated", syncDoc);
    };
  }, []);

  const handleKeySubmitted = (newKey: string) => {
    setApiKey(newKey);
  };
  const isKeyActive = !!(apiKey && apiKey.trim().length > 0);
  return (
    <>
      <header className="h-16 border-b border-line bg-surface px-6 flex items-center justify-between shrink-0 sticky top-0 z-30 select-none shadow-xs">
        {/* Title & Identifier */}
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-ink uppercase">
            {title}
          </h2>
          <p className="text-[11px] font-mono text-muted tracking-wide">{docSubtitle}</p>
        </div>
        {/* System Status Metrics - Centered Compact Sleek AGENTS, ROUND & API KEY Pills */}
        <div className="flex-1 hidden lg:flex items-center justify-center gap-2.5 text-[10.5px] font-mono px-4">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 shadow-2xs">
            <Cpu className="h-3 w-3 text-emerald-600 shrink-0" />
            <span className="text-emerald-800/80 font-medium">AGENTS:</span>
            <span className="text-emerald-950 font-bold" suppressHydrationWarning>{hasDoc ? activeAgentsCount : 0}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 shadow-2xs">
            <Activity className="h-3 w-3 text-emerald-600 shrink-0" />
            <span className="text-emerald-800/80 font-medium">ROUND:</span>
            <span className="text-emerald-950 font-bold" suppressHydrationWarning>
              {String(currentRound).padStart(2, "0")}
            </span>
          </div>
          {/* API Key Status Pill */}
          <button
            onClick={() => setIsKeyModalOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10.5px] font-mono transition-all hover:scale-105 ${
              isKeyActive
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20"
                : "bg-amber-500/10 border-amber-500/30 text-amber-600 animate-pulse hover:bg-amber-500/20"
            }`}
            title={isKeyActive ? "Click to manage API Keys & Fallback pool" : "Click to configure API Key"}
          >
            <Key className="h-3 w-3 shrink-0" />
            <span className="text-emerald-800/80 font-medium">API KEY:</span>
            <span className="font-bold flex items-center gap-1">
              {isKeyActive ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  <span>ACTIVE</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 text-amber-500" />
                  <span>CONFIGURE</span>
                </>
              )}
            </span>
          </button>
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
          <div className="flex items-center gap-1.5 p-1 rounded-full bg-raised/60 border border-line/70 backdrop-blur-md shadow-2xs">
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

            {/* Notifications Button */}
            <button
              className="h-8 w-8 rounded-full bg-surface hover:bg-line/60 border border-line/60 flex items-center justify-center text-muted hover:text-ink transition-all relative group"
              title="Notifications"
            >
              <Bell className="h-3.5 w-3.5 text-muted group-hover:text-ink transition-colors" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-surface animate-pulse" />
            </button>

            {/* Profile Avatar Badge */}
            <div
              className="h-8 w-8 rounded-full bg-surface hover:bg-line/60 border border-line/60 flex items-center justify-center text-ink transition-all cursor-pointer relative"
              title="User Account & Profile"
            >
              <UserIcon className="h-3.5 w-3.5 text-muted" />
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-surface" />
            </div>
          </div>
        </div>
      </header>
      {/* API Key Modal */}
      <ApiKeyGateModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        isRequired={false}
        onKeySubmitted={handleKeySubmitted}
      />
    </>
  );
};
