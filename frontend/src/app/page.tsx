"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Waypoints,
  Play,
  ShieldAlert,
  Sparkles,
  Users,
  Network,
  Activity,
  ArrowRight,
  CheckCircle2,
  Lock,
  Layers,
  FileSpreadsheet,
  Zap,
  Globe,
  BarChart3,
  Cpu,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { keyService } from "@/lib/api/keyService";

export default function LandingPage() {
  const router = useRouter();
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [hasValidKey, setHasValidKey] = useState(false);

  const handleLaunchSwarm = () => {
    if (isAuthenticated) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  };

  useEffect(() => {
    setMounted(true);
    const checkKeys = () => {
      setHasValidKey(keyService.hasValidBYOK() || keyService.getKeys().length > 0);
    };
    checkKeys();
    window.addEventListener("loki_keys_updated", checkKeys);
    window.addEventListener("loki_keys_empty", checkKeys);
    return () => {
      window.removeEventListener("loki_keys_updated", checkKeys);
      window.removeEventListener("loki_keys_empty", checkKeys);
    };
  }, []);
  return (
    <div className="min-h-screen bg-base text-ink font-body selection:bg-accent/20 selection:text-ink">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-line shadow-xs">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-2xl bg-accent text-white flex items-center justify-center shadow-lg shadow-accent/25 group-hover:scale-105 transition-transform">
              <Waypoints className="h-6 w-6" />
            </div>
            <div>
              <span className="font-display text-xl font-extrabold tracking-tight text-ink block">
                LOKI
              </span>
              <span className="text-[10px] font-mono text-accent uppercase font-bold tracking-widest block -mt-1">
                L.O.K.I. INTELLIGENCE PLATFORM
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-ink/80">
            <a href="#features" className="hover:text-accent transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-accent transition-colors">
              How It Works
            </a>
            <Link href="/use-cases" className="hover:text-accent transition-colors flex items-center gap-1 text-accent font-bold">
              <span>Use Cases</span>
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            </Link>
            <button
              onClick={handleLaunchSwarm}
              className="hover:text-accent transition-colors flex items-center gap-1 font-mono text-accent cursor-pointer"
            >
              <span>Platform App</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </nav>

          {/* Direct Launch & Sign-In Actions */}
          <div className="flex items-center gap-2.5">
            {mounted && isAuthenticated && user ? (
              <div className="flex items-center gap-2 bg-surface/90 border border-line rounded-xl px-2.5 py-1.5 shadow-2xs">
                {user.avatar_url || user.picture ? (
                  <img
                    src={user.avatar_url || user.picture}
                    alt={user.full_name || "User"}
                    className="h-6 w-6 rounded-full border border-line object-cover"
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-accent/15 text-accent font-bold text-xs flex items-center justify-center">
                    {(user.full_name || user.email || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-[11px] font-semibold text-ink leading-tight truncate max-w-[110px]">
                    {user.full_name || user.email.split("@")[0]}
                  </span>
                  <span className="text-[9.5px] font-mono leading-none">
                    {hasValidKey ? (
                      <span className="text-emerald-600 font-bold">BYOK: Unlimited</span>
                    ) : (
                      <span className="text-amber-600 font-semibold">BYOK: Ready</span>
                    )}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="text-muted hover:text-red-500 text-[10.5px] font-mono px-1.5 py-0.5 rounded hover:bg-red-500/10 transition-colors"
                  title="Sign Out"
                >
                  Sign Out
                </button>
              </div>
            ) : mounted ? (
              <button
                onClick={() => router.push("/login")}
                className="px-3.5 py-2 rounded-xl bg-surface hover:bg-raised border border-line text-ink text-xs font-semibold hover:border-accent/40 transition-all shadow-xs flex items-center gap-2 group cursor-pointer"
                title="Sign in with Google"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Sign In</span>
              </button>
            ) : (
              <div className="h-8 w-20" />
            )}

            <button
              onClick={handleLaunchSwarm}
              className="px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-semibold hover:opacity-90 transition-all shadow-md shadow-accent/20 flex items-center gap-2 cursor-pointer"
            >
              <span>Launch Swarm</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 overflow-hidden bg-gradient-to-b from-surface via-base to-raised/30">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-raised border border-line text-accent font-mono text-xs font-bold shadow-xs">
            <Sparkles className="h-4 w-4" />
            <span>NEXT-GEN MULTI-AGENT AI SIMULATION ENGINE</span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-4xl sm:text-6xl font-black text-ink tracking-tight max-w-4xl mx-auto leading-tight">
            Predict Executive & Market Reactions{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-accent2 to-accent">
              Before You Launch
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-muted max-w-2xl mx-auto leading-relaxed">
            Simulate 200+ autonomous AI personas across 3 organizational channels. Extract Knowledge Graphs, forecast consumer churn, and identify critical risk turning points with precision.
          </p>

          {/* CTAs */}
          <div className="flex items-center justify-center pt-2">
            <button
              onClick={handleLaunchSwarm}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-accent text-white font-bold text-sm hover:opacity-90 transition-all shadow-xl shadow-accent/25 flex items-center justify-center gap-3 cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Start 200-Agent Simulation</span>
            </button>
          </div>

          {/* Highlights */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs font-mono text-muted">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Unlimited with BYOK (Gemini / Groq)
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> 200 Autonomous Personas
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Powered by Gemini GraphRAG
            </span>
          </div>

          {mounted && !isAuthenticated && (
            <div className="pt-2 flex justify-center">
              <button
                onClick={() => router.push("/login")}
                className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-surface/90 hover:bg-raised border border-line text-xs font-medium text-ink shadow-2xs hover:border-accent/40 transition-all cursor-pointer group"
              >
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Sign in with Google to save your workspace & simulations</span>
                <ArrowRight className="h-3 w-3 text-muted group-hover:text-ink group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Social Proof & Metrics Ribbon */}
      <section className="py-12 border-y border-line bg-surface">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-xs font-mono uppercase text-muted tracking-widest font-bold mb-8">
            TRUSTED BY STRATEGY & RISK TEAMS WORLDWIDE
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="space-y-1">
              <p className="text-3xl sm:text-4xl font-display font-black text-accent">200+</p>
              <p className="text-xs font-mono text-muted uppercase">Personas per Run</p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl sm:text-4xl font-display font-black text-ink">99.4%</p>
              <p className="text-xs font-mono text-muted uppercase">Cascade Accuracy</p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl sm:text-4xl font-display font-black text-accent2">&lt;30s</p>
              <p className="text-xs font-mono text-muted uppercase">Simulation Time</p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl sm:text-4xl font-display font-black text-ink">10M+</p>
              <p className="text-xs font-mono text-muted uppercase">Tokens Processed</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-base">
        <div className="max-w-7xl mx-auto px-6 space-y-16">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-mono uppercase font-bold text-accent tracking-widest">
              END-TO-END ARCHITECTURE
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-black text-ink tracking-tight">
              From Document Seed to Executive Risk Matrix
            </h2>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              LOKI ingests strategic documents, constructs Knowledge Graphs, and triggers multi-agent cascade simulations in 4 automated steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="rounded-3xl border border-line bg-surface p-6 space-y-4 shadow-sm hover:border-accent/40 transition-all">
              <div className="h-12 w-12 rounded-2xl bg-accent/10 text-accent font-mono font-bold text-lg flex items-center justify-center border border-accent/20">
                01
              </div>
              <h3 className="font-display text-base font-bold text-ink">Seed Ingestion</h3>
              <p className="text-xs text-muted leading-relaxed">
                Upload PDFs, DOCX, or policy memos. Extractor parses context up to 15MB securely.
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded-3xl border border-line bg-surface p-6 space-y-4 shadow-sm hover:border-accent/40 transition-all">
              <div className="h-12 w-12 rounded-2xl bg-accent2/10 text-accent2 font-mono font-bold text-lg flex items-center justify-center border border-accent2/20">
                02
              </div>
              <h3 className="font-display text-base font-bold text-ink">GraphRAG Mining</h3>
              <p className="text-xs text-muted leading-relaxed">
                Gemini LLM extracts key entities, pricing shifts, policies, and strategic relationships.
              </p>
            </div>

            {/* Step 3 */}
            <div className="rounded-3xl border border-line bg-surface p-6 space-y-4 shadow-sm hover:border-accent/40 transition-all">
              <div className="h-12 w-12 rounded-2xl bg-accent/10 text-accent font-mono font-bold text-lg flex items-center justify-center border border-accent/20">
                03
              </div>
              <h3 className="font-display text-base font-bold text-ink">200 Swarm Cascade</h3>
              <p className="text-xs text-muted leading-relaxed">
                5-tier autonomous personas negotiate across Executive, Internal Operational, and Public channels.
              </p>
            </div>

            {/* Step 4 */}
            <div className="rounded-3xl border border-line bg-surface p-6 space-y-4 shadow-sm hover:border-accent/40 transition-all">
              <div className="h-12 w-12 rounded-2xl bg-accent2/10 text-accent2 font-mono font-bold text-lg flex items-center justify-center border border-accent2/20">
                04
              </div>
              <h3 className="font-display text-base font-bold text-ink">Risk Synthesis</h3>
              <p className="text-xs text-muted leading-relaxed">
                Generates overall risk scores, consensus matrix, turning points, and exportable PDF reports.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Features Grid */}
      <section id="features" className="py-20 bg-surface border-t border-line">
        <div className="max-w-7xl mx-auto px-6 space-y-16">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-mono uppercase font-bold text-accent tracking-widest">
              POWERFUL CAPABILITIES
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-black text-ink tracking-tight">
              Engineered for Complex Enterprise Forecasting
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="rounded-3xl border border-line bg-base p-6 space-y-4 shadow-xs">
              <div className="h-10 w-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center border border-accent/20">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">5-Tier Persona Generator</h3>
              <p className="text-xs text-muted leading-relaxed">
                Auto-generates 200 distinct personas with risk thresholds, biases, roles, and initial positions ranging from C-suite to media critics.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-3xl border border-line bg-base p-6 space-y-4 shadow-xs">
              <div className="h-10 w-10 rounded-xl bg-accent2/10 text-accent2 flex items-center justify-center border border-accent2/20">
                <Network className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">GraphRAG Knowledge Engine</h3>
              <p className="text-xs text-muted leading-relaxed">
                Parses unstructured business documents into connected NetworkX graphs with entity relationships, risk drivers, and policy dependencies.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-3xl border border-line bg-base p-6 space-y-4 shadow-xs">
              <div className="h-10 w-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center border border-accent/20">
                <Activity className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">3-Channel Communication</h3>
              <p className="text-xs text-muted leading-relaxed">
                Simulates top-down policy directives and bottom-up feedback cascades across Executive, Internal Operational, and Public channels.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-3xl border border-line bg-base p-6 space-y-4 shadow-xs">
              <div className="h-10 w-10 rounded-xl bg-accent2/10 text-accent2 flex items-center justify-center border border-accent2/20">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">Risk Synthesis Engine</h3>
              <p className="text-xs text-muted leading-relaxed">
                Computes overall risk score (0-100), key risk vectors, time-series sentiment shifts, and detects critical round turning points automatically.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="rounded-3xl border border-line bg-base p-6 space-y-4 shadow-xs">
              <div className="h-10 w-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center border border-accent/20">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">Consensus Matrix</h3>
              <p className="text-xs text-muted leading-relaxed">
                Aggregates 200 agent positions into structured Support vs Oppose percentages across major strategic issues.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="rounded-3xl border border-line bg-base p-6 space-y-4 shadow-xs">
              <div className="h-10 w-10 rounded-xl bg-accent2/10 text-accent2 flex items-center justify-center border border-accent2/20">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">PDF & JSON Export</h3>
              <p className="text-xs text-muted leading-relaxed">
                Export comprehensive executive forecast reports formatted for board reviews, strategy presentations, and audit trails.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Bottom Banner */}
      <section className="py-20 bg-gradient-to-br from-surface via-surface to-raised/50 border-t border-line">
        <div className="max-w-5xl mx-auto px-6 text-center space-y-6">
          <h2 className="font-display text-3xl sm:text-5xl font-black text-ink tracking-tight">
            Ready to Simulate Your Next Strategic Decision?
          </h2>
          <p className="text-xs sm:text-sm text-muted max-w-xl mx-auto leading-relaxed">
            Join enterprise strategy teams deploying 200-agent swarm simulations to foresee risks before execution.
          </p>

          <div className="pt-2">
            <button
              onClick={handleLaunchSwarm}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-accent text-white font-bold text-sm hover:opacity-90 transition-all shadow-xl shadow-accent/25 cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Launch Swarm Workspace Now</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-line bg-surface text-xs text-muted">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-xl bg-accent text-white flex items-center justify-center font-bold">
              <Waypoints className="h-4 w-4" />
            </div>
            <span className="font-display text-sm font-bold text-ink">LOKI</span>
            <span className="font-mono text-[10px]">© 2026 LOKI AI. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6 font-mono text-[11px]">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#how-it-works" className="hover:text-ink">Architecture</a>
            <Link href="/settings" className="hover:text-ink">Settings</Link>
          </div>
        </div>
      </footer>

      {/* Global Google Auth Modal */}
      <AuthModal />
    </div>
  );
}
