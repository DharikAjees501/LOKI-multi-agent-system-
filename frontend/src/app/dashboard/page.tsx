"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { GeneratingSimulationCard } from "@/components/layout/GeneratingSimulationCard";
import { ShieldAlert, Users, Network, FolderGit2, ArrowRight, Play, Sparkles, Activity, AlertTriangle, Layers, FileUp } from "lucide-react";
import { reportApi } from "@/lib/api/reportApi";

import { getActiveScenarioId, getActiveDocName, autoInitializeActiveScenario } from "@/lib/api/scenarioApi";

export default function OverviewPage() {
  const [risksData, setRisksData] = useState<any>(null);
  const [turningPoints, setTurningPoints] = useState<any[]>([]);
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

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
          setTurningPoints([]);
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
      setTurningPoints([]);
      setSummaryData(null);
      return;
    }

    let activeId = targetId || getActiveScenarioId();
    if (!activeId) return;

    try {
      const [rData, tpData, sumData] = await Promise.all([
        reportApi.getRisks(activeId),
        reportApi.getTurningPoints(activeId),
        reportApi.getReportSummary(activeId),
      ]);

      setRisksData(rData);
      setTurningPoints(tpData || []);
      if (sumData) setSummaryData(sumData);
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

              {/* Simulation Turning Points Card */}
              <div className="rounded-3xl border border-line/80 bg-surface/90 p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-line/60 pb-3">
                  <h3 className="font-display text-sm font-bold text-ink flex items-center gap-2">
                    <Activity className="h-4 w-4 text-accent" /> CRITICAL TURNING POINTS
                  </h3>
                  <Link
                    href="/reports"
                    className="text-xs font-mono text-accent hover:underline flex items-center gap-1 font-semibold"
                  >
                    View Report <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="space-y-3">
                  {turningPoints.length === 0 ? (
                    <div className="p-4 text-center text-xs font-mono text-muted">No turning points generated yet.</div>
                  ) : (
                    turningPoints.slice(0, 3).map((tp: any, tpIdx: number) => (
                      <div
                        key={tp.id ? `dash-tp-${tp.id}-${tpIdx}` : `dash-tp-${tpIdx}`}
                        className="p-4 rounded-2xl bg-base/60 border border-line/60 flex items-start gap-3 hover:border-accent/40 transition-all"
                      >
                        <span className="h-7 w-7 rounded-xl bg-accent/15 text-accent font-mono text-xs font-bold flex items-center justify-center shrink-0 border border-accent/20">
                          R{tp.round}
                        </span>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-ink">{tp.event}</p>
                            <span className="text-[9px] font-mono text-accent2 font-bold uppercase">{tp.severity}</span>
                          </div>
                          <p className="text-[11px] text-muted leading-relaxed line-clamp-1">{tp.impact}</p>
                        </div>
                      </div>
                    ))
                  )}
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
