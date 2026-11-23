"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/context/AuthContext";

export const AuthModal: React.FC = () => {
  const router = useRouter();
  const { isAuthModalOpen, closeAuthModal, loginWithGoogleCredential } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  if (!isAuthModalOpen) return null;

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse.credential) {
      setError("Failed to retrieve Google credentials.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await loginWithGoogleCredential(credentialResponse.credential);
      setSuccessMessage(
        response.is_new_user ? "Welcome to LOKI! Workspace initialized." : "Welcome back!"
      );
      setTimeout(() => {
        closeAuthModal();
        router.push("/dashboard");
      }, 500);
    } catch (err: any) {
      setError(err.message || "Google authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError("Google Sign-In was cancelled or failed. Please try again.");
  };

  return (
    <div className="fixed inset-0 z-50 bg-base/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-line rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 select-none">
        {/* Modal Header */}
        <div className="p-6 border-b border-line bg-raised/50 relative">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-ink">
                Sign In to SwarmLens
              </h3>
              <p className="text-xs text-muted">
                Connect your Google account to access your simulations & 200-agent workspace.
              </p>
            </div>
          </div>

          <button
            onClick={closeAuthModal}
            className="absolute top-4 right-4 text-muted hover:text-ink text-xs font-mono p-1.5 rounded-lg bg-base border border-line cursor-pointer"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-500 font-mono flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-600 font-mono flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1-Click Google Sign In */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-center w-full">
              {loading ? (
                <div className="w-full py-3 rounded-xl bg-base border border-line flex items-center justify-center gap-2 text-xs font-mono text-muted">
                  <RefreshCw className="h-4 w-4 animate-spin text-accent" />
                  <span>Authenticating with Google...</span>
                </div>
              ) : (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  useOneTap={false}
                  theme="outline"
                  size="large"
                  shape="rectangular"
                  width="100%"
                  text="signin_with"
                />
              )}
            </div>

            <div className="p-3.5 rounded-2xl bg-base border border-line/60 text-center space-y-1">
              <span className="text-[11px] font-mono text-ink font-semibold flex items-center justify-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                1-Click Google Authentication
              </span>
              <p className="text-[10.5px] text-muted leading-relaxed">
                No password required. Your workspace and simulations load automatically.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-line text-center flex items-center justify-center gap-1.5 text-[11px] font-mono text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" />
            <span>Encrypted HttpOnly session · Zero log retention</span>
          </div>
        </div>
      </div>
    </div>
  );
};
