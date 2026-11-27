"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { GeneratingSimulationCard } from "@/components/layout/GeneratingSimulationCard";
import { ShieldAlert, Users, Network, FolderGit2, ArrowRight, Play, Sparkles, Activity, AlertTriangle, Layers, FileUp, BarChart3 } from "lucide-react";
import { reportApi } from "@/lib/api/reportApi";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/lib/api/authService";
import { getActiveScenarioId, getActiveDocName, autoInitializeActiveScenario } from "@/lib/api/scenarioApi";

export default function OverviewPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [risksData, setRisksData] = useState<any>(null);
  const [sentimentData, setSentimentData] = useState<any>(null);
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // When logged out, do not stay in dashboard - redirect to overview page
  useEffect(() => {
    if (!isAuthenticated && !authService.getCurrentUser()) {
      window.location.href = "/";
    }
  }, [isAuthenticated]);

  const syncDoc = async (): Promise<string | null> => {
    if (typeof window !== "undefined") {
      let doc = getActiveDocName();
      let scen = localStorage.getItem("SWARMLENS_ACTIVE_SCENARIO_NAME") || localStorage.getItem("LOKI_ACTIVE_SCENARIO_NAME");
      let activeId = getActiveScenarioId();

      if (!doc || doc === "No document loaded" || !activeId) {
        if (localStorage.getItem("SWARMLENS_MANUALLY_CLEARED") !== "true") {
          const initialized = await autoInitializeActiveScenario();
          if (initialized) {
            doc = initialized.documentName && initialized.documentName !== "No document loaded"
              ? initialized.documentName
              : `${initialized.name.replace(/\s+/g, "_")}.pdf`;
            scen = initialized.name;
            activeId = initialized.id;
          }
        }
      }

      if (!doc) {
        setTimeout(() => {
          setActiveDoc(null);
          setActiveScenario(null);
          setRisksData(null);
          setSentimentData(null);
          setSummaryData(null);
          setIsInitializing(false);
        }, 0);
        return null;
      }

      setTimeout(() => {
        setActiveDoc(doc);
        setActiveScenario(scen || "Strategy Forecasting");
        setIsInitializing(false);
      }, 0);
      return activeId;
    }
    return null;
  };

  const [summaryData, setSummaryData] = useState<any>(null);

  const loadDashboardData = async (targetId?: string) => {
    const doc = getActiveDocName();
    if (!doc) {
      setRisksData(null);
      setSentimentData(null);
      setSummaryData(null);
      return;
    }

    let activeId = targetId || getActiveScenarioId();
    if (!activeId) return;

    try {
      const [rData, sumData, sentData] = await Promise.all([
        reportApi.getRisks(activeId),
        reportApi.getReportSummary(activeId),
        reportApi.getSentimentTimeSeries(activeId),
      ]);

      setRisksData(rData);
      if (sumData) setSummaryData(sumData);
      if (sentData) setSentimentData(sentData);
    } catch (err) {
      console.warn("[DashboardPage] Error loading dashboard data:", err);
    }
  };

  useEffect(() => {
    syncDoc().then((resolvedId) => {
      loadDashboardData(resolvedId || undefined);
    });

    const handleSync = () => {
      setTimeout(() => {
        syncDoc().then((resolvedId) => {
          loadDashboardData(resolvedId || undefined);
        });
      }, 50);
    };

    window.addEventListener("scenario_changed", handleSync);
    window.addEventListener("simulation_completed", handleSync);
    window.addEventListener("swarmlens_doc_updated", handleSync);

    return () => {
      window.removeEventListener("scenario_changed", handleSync);
      window.removeEventListener("simulation_completed", handleSync);
      window.removeEventListener("swarmlens_doc_updated", handleSync);
    };
  }, []);

  const overallRisk = summaryData?.risk_score ?? (risksData?.overallRiskScore ?? 50);
  const severityThreshold = overallRisk >= 70 ? "HIGH" : overallRisk >= 40 ? "MODERATE" : "LOW";
  const keyRisks = (summaryData?.risk_vectors && summaryData.risk_vectors.length > 0) ? summaryData.risk_vectors : (risksData?.keyRisks ?? []);

  const rawPos = Number(sentimentData?.breakdown?.positive ?? summaryData?.sentiment?.positive_pct ?? 50);
  const rawNeu = Number(sentimentData?.breakdown?.neutral ?? summaryData?.sentiment?.neutral_pct ?? 25);
  const rawNeg = Number(sentimentData?.breakdown?.negative ?? summaryData?.sentiment?.negative_pct ?? 15);
  const rawCrit = Number(sentimentData?.breakdown?.critical ?? summaryData?.sentiment?.critical_pct ?? 10);

  const totalRaw = rawPos + rawNeu + rawNeg + rawCrit;
  const safeTotal = totalRaw > 0 ? totalRaw : 100;
  const posPct = Math.round((rawPos / safeTotal) * 100);
  const neuPct = Math.round((rawNeu / safeTotal) * 100);
  const negPct = Math.round((rawNeg / safeTotal) * 100);
  const critPct = Math.max(0, 100 - (posPct + neuPct + negPct));

  return (
    <AppShell title="PLATFORM OVERVIEW" subtitle="EXECUTIVE AI SIMULATION & RISK ENGINE">
      {({ currentRound, simulationStatus, onInterrogateAgent }) => {
        const isRunning = ["GENERATING_GRAPH", "RUNNING_BASELINE", "RUNNING_WHAT_IF", "RUNNING"].includes(simulationStatus);
        return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12 select-none">
          {/* Executive Hero Banner */}
          <div className="rounded-3xl border border-line/80 bg-gradient-to-br from-surface via-surface to-raised/40 p-8 relative overflow-hidden shadow-2xl backdrop-blur-md">
            <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-accent/15 blur-3xl pointer-events-none" />
            <div className="absolute left-1/3 -bottom-20 h-56 w-56 rounded-full bg-accent2/10 blur-3xl pointer-events-none" />

            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
              <div className="space-y-3 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent font-mono text-[11px] font-semibold tracking-wide">
                  <Sparkles className="h-3.5 w-3.5" /> SWARMLENS MULTI-AGENT ORCHESTRATOR
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-ink leading-tight">
                  Enterprise Strategic Forecasting & Swarm Simulation
                </h1>
                <p className="text-xs sm:text-sm text-muted leading-relaxed">
                  Simulate complex executive decisions, market shifts, and consumer reactions across 200 autonomous AI personas in a 3-channel environment.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Link
                  href="/simulation"
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-accent text-white font-semibold text-xs hover:opacity-90 transition-all shadow-xl shadow-accent/25"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Launch Workspace</span>
                </Link>
                <Link
                  href="/risk"
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-raised/80 border border-line text-ink font-semibold text-xs hover:bg-line/60 transition-all backdrop-blur"
                >
                  <ShieldAlert className="h-4 w-4 text-accent2" />
                  <span>Risk Synthesis</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Clean Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metric 1 */}
            <div className="rounded-2xl border border-line/80 bg-surface/90 p-5 flex items-center justify-between hover:border-accent/40 transition-all shadow-md">
              <div>
                <p className="text-[10px] font-mono text-muted uppercase tracking-wider font-semibold">ACTIVE AGENT POPULATION</p>
                <p className="text-2xl font-display font-extrabold text-ink mt-1">
                  {activeDoc ? "200 Nodes" : "0 Nodes"}
                </p>
                <p className="text-[11px] font-mono text-emerald-600 mt-1 flex items-center gap-1 font-semibold">
                  <span className={`h-1.5 w-1.5 rounded-full ${activeDoc ? "bg-emerald-500 animate-pulse" : "bg-muted"}`} />
                  {activeDoc ? "5 Tier Hierarchy" : "Awaiting Strategy PDF"}
                </p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-accent/10 border border-accent/20 text-accent flex items-center justify-center shrink-0">
                <Users className="h-5 w-5" />
              </div>
            </div>

            {/* Metric 2 */}
            <div className="rounded-2xl border border-line/80 bg-surface/90 p-5 flex items-center justify-between hover:border-accent2/40 transition-all shadow-md">
              <div>
                <p className="text-[10px] font-mono text-muted uppercase tracking-wider font-semibold">OVERALL RISK SCORE</p>
                <p className="text-2xl font-display font-extrabold text-accent2 mt-1">
                  {activeDoc ? overallRisk : "--"} <span className="text-sm text-muted font-normal">/ 100</span>
                </p>
                <p className="text-[11px] font-mono text-accent2 mt-1 font-semibold uppercase">
                  {activeDoc ? `${severityThreshold} THRESHOLD` : "NO RISK DATA"}
                </p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-accent2/10 border border-accent2/20 text-accent2 flex items-center justify-center shrink-0">
                <ShieldAlert className="h-5 w-5" />
              </div>
            </div>

            {/* Metric 3 */}
            <div className="rounded-2xl border border-line/80 bg-surface/90 p-5 flex items-center justify-between hover:border-accent/40 transition-all shadow-md">
              <div>
                <p className="text-[10px] font-mono text-muted uppercase tracking-wider font-semibold">SIMULATION STATE</p>
                <p className="text-2xl font-display font-extrabold text-ink mt-1">
                  Round {String(currentRound).padStart(2, "0")} <span className="text-sm text-muted font-normal">/ 05</span>
                </p>
                <p className="text-[11px] font-mono text-accent mt-1 flex items-center gap-1 font-semibold uppercase">
                  <Activity className="h-3 w-3" /> {activeDoc ? "READY TO SIMULATE" : "STANDBY"}
                </p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-raised border border-line/80 text-accent flex items-center justify-center shrink-0">
                <Layers className="h-5 w-5" />
              </div>
            </div>

            {/* Metric 4 */}
            <div className="rounded-2xl border border-line/80 bg-surface/90 p-5 flex items-center justify-between hover:border-accent/40 transition-all shadow-md">
              <div>
                <p className="text-[10px] font-mono text-muted uppercase tracking-wider font-semibold">ACTIVE SCENARIO</p>
                <p className="text-sm font-display font-bold text-ink truncate mt-1 max-w-[140px]">
                  {activeScenario || "No Scenario"}
                </p>
                <p className="text-[11px] font-mono text-muted mt-1 truncate max-w-[140px]">
                  {activeDoc || "No document loaded"}
                </p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-raised border border-line/80 text-muted flex items-center justify-center shrink-0">
                <FolderGit2 className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Clean Split Modules */}
          {isRunning ? (
            <GeneratingSimulationCard
              currentRound={currentRound}
              simulationStatus={simulationStatus}
              onForceComplete={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new Event("swarmlens_force_complete"));
                }
              }}
            />
          ) : isInitializing ? (
            <div className="rounded-3xl border border-line bg-surface p-12 flex flex-col items-center justify-center text-center space-y-4 shadow-xl animate-pulse">
              <FolderGit2 className="h-8 w-8 text-accent animate-bounce" />
              <p className="text-xs font-mono text-muted">Syncing active strategy forecast...</p>
            </div>
          ) : !activeDoc ? (
            <div className="rounded-3xl border border-dashed border-line bg-surface p-10 flex flex-col items-center justify-center text-center space-y-4 shadow-xl">
              <div className="h-14 w-14 rounded-2xl bg-accent/10 border border-accent/30 text-accent flex items-center justify-center shadow-lg shadow-accent/10">
                <FolderGit2 className="h-7 w-7" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h3 className="font-display text-lg font-extrabold text-ink">No Active Strategy Forecast</h3>
                <p className="text-xs text-muted leading-relaxed font-body">
                  Upload your strategy document (.PDF, .DOCX, .TXT) to populate key risk vectors, critical turning points, and launch executive swarm simulations.
                </p>
              </div>

              <button
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new Event("swarmlens_open_upload"));
                  }
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-accent text-white text-xs font-semibold hover:opacity-90 transition-all shadow-xl shadow-accent/25"
              >
                <FileUp className="h-4 w-4" />
                <span>Upload PDF Strategy File</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Key Risk Vectors Card */}
              <div className="rounded-3xl border border-line/80 bg-surface/90 p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-line/60 pb-3">
                  <h3 className="font-display text-sm font-bold text-ink flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-accent2" /> KEY RISK VECTORS
                  </h3>
                  <Link
                    href="/risk"
                    className="text-xs font-mono text-accent hover:underline flex items-center gap-1 font-semibold"
                  >
                    View All <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="space-y-3">
                  {keyRisks.length === 0 ? (
                    <div className="p-4 text-center text-xs font-mono text-muted">No risk vectors generated yet.</div>
                  ) : (
                    keyRisks.slice(0, 3).map((risk: any, rIdx: number) => (
                      <div
                        key={risk.id ? `dash-risk-${risk.id}-${rIdx}` : `dash-risk-${rIdx}`}
                        className="p-4 rounded-2xl bg-base/60 border border-line/60 flex items-center justify-between gap-4 hover:border-accent/40 transition-all"
                      >
                        <div className="space-y-1 min-w-0">
                          <p className="text-xs font-bold text-ink truncate">{risk.title}</p>
                          <p className="text-[11px] text-muted line-clamp-1 leading-relaxed">
                            {risk.description}
                          </p>
                        </div>
                        <div className="text-right shrink-0 font-mono">
                          <span className="text-sm font-extrabold text-accent2">{risk.score}</span>
                          <span className="block text-[9px] text-muted uppercase font-semibold">{risk.severity}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Swarm Sentiment & Consensus Stacked Bar Card */}
              <div className="rounded-3xl border border-line/80 bg-surface/90 p-6 space-y-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-line/60 pb-3">
                    <h3 className="font-display text-sm font-bold text-ink flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-emerald-500" /> SWARM SENTIMENT & CONSENSUS
                    </h3>
                    <span className="text-[11px] font-mono font-bold text-muted uppercase">
                      200 Agent Nodes
                    </span>
                  </div>

                  <div className="mt-4 space-y-4">
                    {/* Multi-Segment Stacked Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[11px] font-mono text-muted">
                        <span>Equilibrium Distribution</span>
                        <span className="text-ink font-bold">{posPct}% Positive Alignment</span>
                      </div>
                      <div className="h-5 w-full bg-raised rounded-full overflow-hidden border border-line/80 flex p-0.5 shadow-inner">
                        {posPct > 0 && (
                          <div
                            style={{ width: `${posPct}%` }}
                            className="h-full bg-emerald-500 rounded-l-full transition-all duration-500"
                            title={`Positive: ${posPct}%`}
                          />
                        )}
                        {neuPct > 0 && (
                          <div
                            style={{ width: `${neuPct}%` }}
                            className="h-full bg-slate-400 dark:bg-slate-500 transition-all duration-500"
                            title={`Neutral: ${neuPct}%`}
                          />
                        )}
                        {negPct > 0 && (
                          <div
                            style={{ width: `${negPct}%` }}
                            className="h-full bg-amber-500 transition-all duration-500"
                            title={`Negative: ${negPct}%`}
                          />
                        )}
                        {critPct > 0 && (
                          <div
                            style={{ width: `${critPct}%` }}
                            className="h-full bg-rose-500 rounded-r-full transition-all duration-500"
                            title={`Critical: ${critPct}%`}
                          />
                        )}
                      </div>
                    </div>

                    {/* 4 Discrete Stance Breakdown Metrics */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="p-3 rounded-2xl bg-base/60 border border-line/60 space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="truncate">Positive Support</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-base font-extrabold text-emerald-500 font-mono">{posPct}%</span>
                          <span className="text-[10px] font-mono text-muted">~{Math.round(posPct * 2)} agents</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-base/60 border border-line/60 space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted">
                          <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" />
                          <span className="truncate">Neutral / Balanced</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-base font-extrabold text-slate-700 dark:text-slate-300 font-mono">{neuPct}%</span>
                          <span className="text-[10px] font-mono text-muted">~{Math.round(neuPct * 2)} agents</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-base/60 border border-line/60 space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted">
                          <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                          <span className="truncate">Negative Friction</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-base font-extrabold text-amber-500 font-mono">{negPct}%</span>
                          <span className="text-[10px] font-mono text-muted">~{Math.round(negPct * 2)} agents</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-base/60 border border-line/60 space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted">
                          <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                          <span className="truncate">Critical Pushback</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-base font-extrabold text-rose-500 font-mono">{critPct}%</span>
                          <span className="text-[10px] font-mono text-muted">~{Math.round(critPct * 2)} agents</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ground-Truth Status Pill */}
                <div className="pt-2 border-t border-line/40 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-muted">Consensus State:</span>
                  <span className="font-bold text-accent">
                    {posPct >= 50
                      ? "Majority Positive Alignment"
                      : (negPct + critPct >= 40)
                        ? "Active Dissent Resistance"
                        : "Multi-Faction Equilibrium"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        );
      }}
    </AppShell>
  );
}
