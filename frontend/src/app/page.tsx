"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { graphApi } from "@/lib/api/graphApi";
import { GraphNode, GraphEdge } from "@/types";

export default function LandingPage() {
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });

  useEffect(() => {
    graphApi.getSwarmGraph("scen-01").then(setGraphData).catch(() => {});
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
            <a href="#demo" className="hover:text-accent transition-colors">
              Interactive Demo
            </a>
            <Link href="/dashboard" className="hover:text-accent transition-colors flex items-center gap-1 font-mono text-accent">
              <span>Platform App</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </nav>

          {/* Direct Launch Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/simulation"
              className="px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-semibold hover:opacity-90 transition-all shadow-md shadow-accent/20 flex items-center gap-2"
            >
              <span>Launch Swarm</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
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
            Simulate 50+ autonomous AI personas across 3 organizational channels. Extract Knowledge Graphs, forecast consumer churn, and identify critical risk turning points with precision.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              href="/simulation"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-accent text-white font-bold text-sm hover:opacity-90 transition-all shadow-xl shadow-accent/25 flex items-center justify-center gap-3"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Start Free 50-Agent Simulation</span>
            </Link>

            <Link
              href="/risk"
              className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-surface border border-line text-ink font-semibold text-sm hover:bg-raised transition-all flex items-center justify-center gap-2 shadow-xs"
            >
              <ShieldAlert className="h-4 w-4 text-accent2" />
              <span>Explore Risk Synthesis</span>
            </Link>
          </div>

          {/* Highlights */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs font-mono text-muted">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> 50 Autonomous Personas
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Powered by Gemini GraphRAG
            </span>
          </div>
        </div>

        {/* Live Swarm Interactive Demo Container */}
        <div id="demo" className="max-w-6xl mx-auto px-6 mt-16">
          <div className="rounded-3xl border border-line bg-surface p-4 shadow-2xl space-y-3 relative">
            <div className="flex items-center justify-between px-4 py-2 border-b border-line text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-ink font-bold">LIVE SIMULATION CANVAS PREVIEW</span>
              </div>
              <div className="flex items-center gap-4 text-muted">
                <span>SCENARIO: Enterprise Pricing Restructure</span>
                <span className="text-accent font-bold">50 AGENTS ONLINE</span>
              </div>
            </div>

            <div className="h-[480px] w-full rounded-2xl overflow-hidden border border-line">
              <GraphCanvas
                nodes={graphData.nodes}
                edges={graphData.edges}
                title="LOKI ORCHESTRATION DEMO"
                subtitle="50 Personas · Concentric Tier Topology"
              />
            </div>
          </div>
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
              <p className="text-3xl sm:text-4xl font-display font-black text-accent">50+</p>
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
              <h3 className="font-display text-base font-bold text-ink">50 Swarm Cascade</h3>
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
                Auto-generates 50 distinct personas with risk thresholds, biases, roles, and initial positions ranging from C-suite to media critics.
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
            <Link
              href="/simulation"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-accent text-white font-bold text-sm hover:opacity-90 transition-all shadow-xl shadow-accent/25"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Launch Swarm Workspace Now</span>
            </Link>
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
    </div>
  );
}
