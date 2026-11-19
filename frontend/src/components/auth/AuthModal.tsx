"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Mail,
  Lock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Shield,
  Sparkles,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import { authService } from "@/lib/api/authService";
import { useAuth } from "@/context/AuthContext";

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, initialMode, setUserSession } = useAuth();
  const [tab, setTab] = useState<"LOGIN" | "SIGNUP">("SIGNUP");

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Status Banners
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (isAuthModalOpen) {
      setTab(initialMode);
      setError("");
      setSuccessMessage("");
      setEmail("");
      setPassword("");
    }
  }, [isAuthModalOpen, initialMode]);

  if (!isAuthModalOpen) return null;

  // Direct Account Creation (No Verification Code)
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await authService.register(cleanEmail, "123456", password);
      setUserSession(response.user);
      setSuccessMessage("Account created successfully!");
      setTimeout(() => {
        closeAuthModal();
      }, 500);
    } catch (err: any) {
      setError(err.message || "Account creation failed.");
    } finally {
      setLoading(false);
    }
  };

  // Direct Sign In
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await authService.login(cleanEmail, password);
      setUserSession(response.user);
      setSuccessMessage("Signed in successfully!");
      setTimeout(() => {
        closeAuthModal();
      }, 500);
    } catch (err: any) {
      setError(err.message || "Invalid login credentials.");
    } finally {
      setLoading(false);
    }
  };

  // Google Account SSO Login / Sign Up
  const handleGoogleAuth = async () => {
    const googleEmail = email.trim() || prompt("Enter your Google Account email:", "user@gmail.com");
    if (!googleEmail) return;

    setLoading(true);
    setError("");

    try {
      const response = await authService.googleLogin(
        googleEmail.trim().toLowerCase(),
        googleEmail.split("@")[0].toUpperCase() + " Operator",
        `https://api.dicebear.com/7.x/bottts/svg?seed=${googleEmail}`
      );
      setUserSession(response.user);
      setSuccessMessage("Google Account connected!");
      setTimeout(() => {
        closeAuthModal();
      }, 500);
    } catch (err: any) {
      setError(err.message || "Google authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-base/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-line rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 select-none">
        {/* Modal Header */}
        <div className="p-6 border-b border-line bg-raised/50 relative">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-ink">
                {tab === "LOGIN" ? "Sign In to LOKI" : "Create Account"}
              </h3>
              <p className="text-xs text-muted">
                {tab === "LOGIN"
                  ? "Enter your credentials or continue with Google."
                  : "Sign up with your email and password or Google SSO."}
              </p>
            </div>
          </div>

          <button
            onClick={closeAuthModal}
            className="absolute top-4 right-4 text-muted hover:text-ink text-xs font-mono px-2 py-1 rounded-lg bg-base border border-line"
          >
            Esc
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 font-mono">
          {/* Status Banners */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-500 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-600 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. GOOGLE ACCOUNT SSO BUTTON (PROMINENT AT TOP) */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full py-3 rounded-xl border border-line bg-raised hover:bg-line text-xs font-bold text-ink flex items-center justify-center gap-3 transition-all shadow-xs hover:border-accent/40"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.35 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.21 0 10.05 0 12s.47 3.79 1.29 5.42l3.99-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Sign In with Google Account</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center py-1">
            <div className="border-t border-line w-full" />
            <span className="bg-surface px-3 text-[10px] text-muted uppercase shrink-0">
              OR WITH EMAIL & PASSWORD
            </span>
          </div>

          {/* 2. DIRECT EMAIL & PASSWORD FORM */}
          <form onSubmit={tab === "LOGIN" ? handleLogin : handleCreateAccount} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted block uppercase">WORK EMAIL</label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 h-4 w-4 text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="executive@company.com"
                  className="w-full bg-base border border-line rounded-xl pl-10 pr-4 py-2.5 text-xs text-ink focus:outline-none focus:border-accent"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted block uppercase">PASSWORD</label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 h-4 w-4 text-muted" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-base border border-line rounded-xl pl-10 pr-10 py-2.5 text-xs text-ink focus:outline-none focus:border-accent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-muted hover:text-ink p-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Action Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-accent text-white text-xs font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-md shadow-accent/20 font-sans"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>{tab === "LOGIN" ? "Sign In to Platform" : "Create Account"}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Mode Switcher Link at Bottom */}
          <div className="pt-2 border-t border-line text-center text-xs">
            {tab === "LOGIN" ? (
              <p className="text-muted">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setTab("SIGNUP");
                    setError("");
                    setSuccessMessage("");
                  }}
                  className="text-accent font-bold hover:underline"
                >
                  Create Account
                </button>
              </p>
            ) : (
              <p className="text-muted">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setTab("LOGIN");
                    setError("");
                    setSuccessMessage("");
                  }}
                  className="text-accent font-bold hover:underline"
                >
                  Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
