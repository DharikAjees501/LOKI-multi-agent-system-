"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Key, FileUp, CheckCircle2, ArrowRight, X, Shield, Zap } from "lucide-react";
import { keyService } from "@/lib/api/keyService";
import { useAuth } from "@/context/AuthContext";

interface NewUserOnboardingProps {
  onOpenKeyModal: () => void;
  onOpenUploadModal: () => void;
}

export const NewUserOnboarding: React.FC<NewUserOnboardingProps> = ({
  onOpenKeyModal,
  onOpenUploadModal,
}) => {
  const { user, isNewUser } = useAuth();
  const [hasKeys, setHasKeys] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkKeys = () => {
      setHasKeys(keyService.hasValidBYOK() || keyService.getKeys().length > 0);
    };
    checkKeys();

    window.addEventListener("loki_keys_updated", checkKeys);
    window.addEventListener("loki_keys_empty", checkKeys);
    return () => {
      window.removeEventListener("loki_keys_updated", checkKeys);
      window.removeEventListener("loki_keys_empty", checkKeys);
    };
  }, []);

  // Check if dismissed previously in session
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDismissed = sessionStorage.getItem("LOKI_ONBOARDING_DISMISSED");
      if (isDismissed === "true") {
        setDismissed(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("LOKI_ONBOARDING_DISMISSED", "true");
    }
  };

  // If dismissed, don't render
  if (dismissed) return null;

  return (
    <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/[0.04] via-surface to-surface p-5 shadow-xs relative overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-ink">
                Welcome to LOKI Intelligence Workspace
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 text-[10px] font-mono font-bold">
                {isNewUser ? "NEW WORKSPACE" : "QUICK SETUP"}
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              Complete these 2 quick steps to initialize your 50-agent persona swarm simulation.
            </p>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="text-muted hover:text-ink p-1 rounded-lg hover:bg-raised transition-colors shrink-0"
          title="Dismiss onboarding"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        {/* Step 1: Connect BYOK Key */}
        <div
          onClick={onOpenKeyModal}
          className={`cursor-pointer group p-3.5 rounded-xl border transition-all flex items-center justify-between ${
            hasKeys
              ? "bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/50"
              : "bg-surface border-line hover:border-emerald-500/30 hover:bg-emerald-500/[0.02]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                hasKeys ? "bg-emerald-500/15 text-emerald-600" : "bg-raised text-muted group-hover:text-emerald-600"
              }`}
            >
              {hasKeys ? <CheckCircle2 className="h-4 w-4" /> : <Key className="h-4 w-4" />}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold text-muted uppercase">STEP 1</span>
                {hasKeys ? (
                  <span className="text-[10px] font-mono font-bold text-emerald-600">CONNECTED</span>
                ) : (
                  <span className="text-[10px] font-mono text-amber-500 font-bold">REQUIRED FOR UNLIMITED</span>
                )}
              </div>
              <p className="text-xs font-semibold text-ink group-hover:text-emerald-600 transition-colors">
                {hasKeys ? "BYOK Key Active (Unlimited Runs)" : "Paste Gemini or Groq API Key"}
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0" />
        </div>

        {/* Step 2: Upload Document */}
        <div
          onClick={onOpenUploadModal}
          className="cursor-pointer group p-3.5 rounded-xl border border-line bg-surface hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-raised text-muted group-hover:text-emerald-600 flex items-center justify-center shrink-0">
              <FileUp className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold text-muted uppercase">STEP 2</span>
                <span className="text-[10px] font-mono text-muted">PDF · DOCX · TXT</span>
              </div>
              <p className="text-xs font-semibold text-ink group-hover:text-emerald-600 transition-colors">
                Upload Strategic Policy Document
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0" />
        </div>
      </div>
    </div>
  );
};

