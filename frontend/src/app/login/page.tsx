"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoogleLogin } from "@react-oauth/google";
import {
  Waypoints,
  Lock,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, loginWithGoogleCredential } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // If already signed in, immediately redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse.credential) {
      setError("Failed to retrieve Google credentials.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await loginWithGoogleCredential(credentialResponse.credential);
      setSuccess(
        response.is_new_user
          ? "Account created successfully! Loading your workspace..."
          : "Welcome back! Redirecting to dashboard..."
      );
      setTimeout(() => {
        router.push("/dashboard");
      }, 500);
    } catch (err: any) {
      setError(err.message || "Google authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError("Google Sign-In was cancelled or failed. Please try again.");
  };

  return (
    <div className="min-h-screen bg-base text-ink flex flex-col justify-between p-4 sm:p-6 select-none">
      {/* Top Navbar */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between py-2">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-xl bg-accent text-white flex items-center justify-center font-bold shadow-md shadow-accent/20 group-hover:scale-105 transition-transform">
            <Waypoints className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-base font-black tracking-tight text-ink">LOKI</span>
            <span className="font-mono text-[9px] text-accent font-semibold tracking-wider">SWARMLENS PLATFORM</span>
          </div>
        </Link>
        <Link
          href="/"
          className="text-xs font-mono text-muted hover:text-ink transition-colors px-3 py-1.5 rounded-lg border border-line bg-surface hover:bg-raised"
        >
          ← Back to Overview
        </Link>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full mx-auto my-8">
        <div className="rounded-3xl border border-line bg-surface p-8 sm:p-10 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-accent/10 border border-accent/20 text-accent mb-2">
              <Lock className="h-7 w-7" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              Sign in to SwarmLens
            </h1>
            <p className="text-xs text-muted max-w-xs mx-auto leading-relaxed">
              Connect with your Google account to access your simulations, saved documents, and 200-agent workspace.
            </p>
          </div>

          {/* Feedback alerts */}
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-mono flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs font-mono flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* 1-Click Google Sign In */}
          <div className="space-y-4 pt-2">
            <div className="flex justify-center w-full">
              {loading ? (
                <div className="w-full py-3 rounded-xl bg-surface border border-line flex items-center justify-center gap-2 text-xs font-mono text-muted">
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
                1-Click Google OAuth
              </span>
              <p className="text-[10.5px] text-muted leading-relaxed">
                No password needed. New users automatically receive 2 free courtesy simulation runs upon signing in.
              </p>
            </div>
          </div>

          {/* Security footnote */}
          <div className="pt-3 border-t border-line text-center flex items-center justify-center gap-1.5 text-[11px] font-mono text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" />
            <span>Encrypted HttpOnly session · Zero log retention</span>
          </div>
        </div>
      </div>

      {/* Footer note */}
      <div className="text-center text-[11px] font-mono text-muted py-2">
        <span>Protected by LOKI SwarmLens Intelligence Platform</span>
      </div>
    </div>
  );
}
