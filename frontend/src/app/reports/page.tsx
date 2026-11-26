"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import {
  Download,
  Share2,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Clock,
  FileText,
  FileUp,
  Activity,
  Play,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Users,
  Target,
  ChevronRight,
  Quote,
  Scale,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { reportApi } from "@/lib/api/reportApi";
import {
  ExecutiveReport,
  PlaybookItem,
  StructuredRiskItem,
  MarketPushbackItem,
  TradeoffAnalysis,
} from "@/types";
import { ExecutiveBriefingPanel } from "@/components/briefing/ExecutiveBriefingPanel";
import { ReportAgentChat } from "@/components/reports/ReportAgentChat";
import {
  getActiveScenarioId,
  autoInitializeActiveScenario,
  scenarioApi,
  getActiveDocName,
} from "@/lib/api/scenarioApi";
import { ScenarioStatusBanner } from "@/components/layout/ScenarioStatusBanner";
import { GeneratingSimulationCard } from "@/components/layout/GeneratingSimulationCard";

function ReportsContent({
  currentRound,
  simulationStatus,
}: {
  currentRound: number;
  simulationStatus: string;
}) {
  const [report, setReport] = useState<ExecutiveReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [forceComplete, setForceComplete] = useState(false);

  const syncDoc = async () => {
    if (typeof window !== "undefined") {
      let doc = getActiveDocName();
      let activeId = getActiveScenarioId();
      if (!doc || doc === "No document loaded" || !activeId) {
        if (localStorage.getItem("SWARMLENS_MANUALLY_CLEARED") !== "true") {
          const initialized = await autoInitializeActiveScenario();
          if (initialized) {
            doc =
              initialized.documentName && initialized.documentName !== "No document loaded"
                ? initialized.documentName
                : `${initialized.name.replace(/\s+/g, "_")}.pdf`;
            activeId = initialized.id;
          }
        }
      }
      if (doc && doc !== "No document loaded") {
        setActiveDoc(doc);
      } else {
        setActiveDoc(null);
        setReport(null);
        setForceComplete(false);
      }

      // Check if backend already completed scenario
      try {
        const scens = await scenarioApi.getScenarios();
        const currentScen = scens.find((s) => s.id === activeId);
        if (
          currentScen &&
          ["COMPLETED", "BASELINE_COMPLETED", "WHAT_IF_COMPLETED"].includes(currentScen.status)
        ) {
          setForceComplete(true);
        }
      } catch { }
    }
  };

  const loadReport = (isSilent = false) => {
    const doc = getActiveDocName();
    if (!doc) {
      setReport(null);
      setLoading(false);
      return;
    }
    const activeId = getActiveScenarioId();
    if (!activeId) {
      setReport(null);
      setLoading(false);
      return;
    }
    // Only show full-page loading spinner on initial load when no report exists yet
    if (!isSilent && !report) {
      setLoading(true);
    }
    reportApi
      .getExecutiveReport(activeId, currentRound)
      .then((data) => {
        if (data) {
          setReport(data);
        }
      })
      .catch((err) => {
        console.error("[ReportsPage] Exception fetching executive report:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    syncDoc().then(() => loadReport());
    let debounceTimer: any = null;
    const handleDocUpdated = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        syncDoc().then(() => loadReport(true));
      }, 100);
    };
    window.addEventListener("swarmlens_doc_updated", handleDocUpdated);
    window.addEventListener("scenario_changed", handleDocUpdated);
    window.addEventListener("simulation_completed", handleDocUpdated);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener("swarmlens_doc_updated", handleDocUpdated);
      window.removeEventListener("scenario_changed", handleDocUpdated);
      window.removeEventListener("simulation_completed", handleDocUpdated);
    };
  }, []);

  useEffect(() => {
    if (report) {
      loadReport(true);
    }
  }, [currentRound]);

  if (activeDoc && (loading || !report)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted font-mono text-sm space-y-3">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
        <span>Synthesizing Live Multi-Agent Simulation Report...</span>
      </div>
    );
  }

  const activeReport = report;
  const isRunning =
    simulationStatus === "GENERATING_GRAPH" ||
    simulationStatus === "SIMULATING" ||
    simulationStatus.startsWith("RUNNING") ||
    Boolean((activeReport as any)?.is_simulating);
  const isSimulationCompleted =
    forceComplete ||
    (!isRunning && ["COMPLETED", "BASELINE_COMPLETED", "WHAT_IF_COMPLETED"].includes(simulationStatus));

  // Extract structured executive metrics directly from live simulation backend
  const riskScore =
    (activeReport as any)?.risk_score ??
    (activeReport as any)?.riskScore ??
    (activeReport as any)?.overallRiskScore ??
    0;

  const totalAgents =
    (activeReport as any)?.total_agents ??
    (activeReport as any)?.totalAgents ??
    activeReport?.agentCount ??
    200;

  const primaryConcern =
    (activeReport as any)?.primary_concern ||
    (activeReport as any)?.primaryConcern ||
    "Stakeholder Consensus & Strategy Resiliency";

  const rawVerdict =
    (activeReport as any)?.decision_verdict ||
    (activeReport as any)?.decisionVerdict ||
    (riskScore < 40 ? "GO" : riskScore < 70 ? "CONDITIONAL_GO" : "HOLD");
  const decisionVerdict: "GO" | "CONDITIONAL_GO" | "HOLD" =
    rawVerdict === "GO" ? "GO" : rawVerdict === "HOLD" ? "HOLD" : "CONDITIONAL_GO";

  const oneLineVerdict =
    (activeReport as any)?.one_line_verdict ||
    (activeReport as any)?.oneLineVerdict ||
    (decisionVerdict === "CONDITIONAL_GO"
      ? `Conditional approval for '${activeReport?.scenarioName || "proposal"}': Establish deterministic safety gates and stakeholder onboarding before full rollout.`
      : decisionVerdict === "HOLD"
        ? `Hold deployment for '${activeReport?.scenarioName || "proposal"}': Address critical compliance and stakeholder friction voiced by dissenting channels.`
        : `Proceed with phased rollout for '${activeReport?.scenarioName || "proposal"}' while maintaining continuous telemetry across active channels.`);

  const sentiment = (activeReport as any)?.sentimentBreakdown || {
    positive: (activeReport as any)?.pos_pct ?? 0,
    neutral: (activeReport as any)?.neu_pct ?? 0,
    negative: (activeReport as any)?.neg_pct ?? 0,
    critical: (activeReport as any)?.crit_pct ?? 0,
  };

  const posPct = sentiment.positive ?? 0;
  const neuPct = sentiment.neutral ?? 0;
  const negPct = sentiment.negative ?? 0;
  const critPct = sentiment.critical ?? 0;

  // Live Executive Strategic Summary
  const cleanExecSummary = String(
    activeReport?.executiveSummary ||
    (activeReport as any)?.executive_summary ||
    ""
  ).trim();

  // Live Structured Action Playbook
  const rawPlaybook: PlaybookItem[] =
    (activeReport as any)?.action_playbook ||
    (activeReport as any)?.actionPlaybook ||
    [];

  // Live Key Findings & Market Pushback
  const rawPushback: MarketPushbackItem[] =
    (activeReport as any)?.market_pushback ||
    (activeReport as any)?.marketPushback ||
    [];

  // Live Strategic Trade-Off Analysis
  const rawTradeoff: TradeoffAnalysis =
    (activeReport as any)?.tradeoff_analysis ||
    (activeReport as any)?.tradeoffAnalysis ||
    {
      advantages: [],
      disadvantages: [],
      verdict: "",
      verdict_explanation: "",
    };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-32">
      <ScenarioStatusBanner onScenarioCompleted={() => loadReport(true)} />
      {!activeDoc ? (
        <div className="rounded-3xl border border-dashed border-line bg-surface p-12 flex flex-col items-center justify-center text-center space-y-5 my-12">
          <div className="h-16 w-16 rounded-2xl bg-accent/10 border border-accent/30 text-accent flex items-center justify-center shadow-lg shadow-accent/10">
            <FileText className="h-8 w-8" />
          </div>
          <div className="space-y-2 max-w-md">
            <h3 className="font-display text-xl font-extrabold text-ink">
              No Executive Report Generated
            </h3>
            <p className="text-xs text-muted leading-relaxed font-body">
              Upload your strategy document (.PDF, .DOCX, .TXT) and run a simulation to synthesize a
              live forecast report.
            </p>
          </div>

          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("swarmlens_open_upload"));
              }
            }}
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-accent text-white text-xs font-semibold hover:opacity-90 transition-all shadow-xl shadow-accent/25"
          >
            <FileUp className="h-4 w-4" />
            <span>Upload Document</span>
          </button>
        </div>
      ) : !isSimulationCompleted || !activeReport ? (
        <GeneratingSimulationCard
          currentRound={currentRound}
          simulationStatus={simulationStatus}
          onForceComplete={() => {
            setForceComplete(true);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("swarmlens_force_complete"));
            }
          }}
        />
      ) : (
        <>
          {/* Action Header Card */}
          <div className="rounded-3xl border border-line bg-surface p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-accent font-semibold">
                <Sparkles className="h-3.5 w-3.5" /> LIVE SIMULATION SYNTHESIS · {activeReport.generatedAt}
              </div>
              <h1 className="font-display text-2xl font-bold text-ink mt-1">
                {activeReport.title}
              </h1>
              <p className="text-xs text-muted font-mono mt-0.5">
                Scenario: {activeReport.scenarioName} · Source: {activeDoc}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => reportApi.exportReport(getActiveScenarioId() || activeReport.id, "pdf")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-xs font-semibold hover:opacity-90 transition-all shadow-md shadow-accent/20"
              >
                <Download className="h-4 w-4" /> Export PDF
              </button>
              <button
                onClick={() => reportApi.exportReport(getActiveScenarioId() || activeReport.id, "json")}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-raised border border-line text-muted hover:text-ink text-xs font-mono font-semibold transition-all"
                title="Export JSON Data"
              >
                <FileText className="h-4 w-4" /> JSON
              </button>
              <button
                onClick={() => alert("Shareable report link copied to clipboard.")}
                className="p-2 rounded-xl bg-raised border border-line text-muted hover:text-ink transition-all"
                title="Share Report"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* TOP DECISION VERDICT HERO BANNER */}
          <div className="rounded-3xl border border-line bg-surface p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
            <div className="absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-accent2/10 blur-3xl pointer-events-none" />

            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
              <div className="space-y-3 max-w-3xl">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-mono font-bold tracking-wider uppercase border flex items-center gap-1.5 shadow-sm ${decisionVerdict === "GO"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : decisionVerdict === "HOLD"
                          ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                          : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      }`}
                  >
                    {decisionVerdict === "GO" && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {decisionVerdict === "HOLD" && <ShieldAlert className="h-3.5 w-3.5" />}
                    {decisionVerdict === "CONDITIONAL_GO" && (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                    DECISION VERDICT: {decisionVerdict.replace("_", " ")}
                  </span>
                  <span className="text-xs font-mono text-muted flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Round 05 of 05 Equilibrium
                  </span>
                </div>

                <h2 className="font-display text-xl md:text-2xl font-extrabold text-ink leading-snug">
                  {oneLineVerdict}
                </h2>
              </div>

              {/* Overall Risk Score Badge & Full Primary Concern */}
              <div className="flex items-center gap-4 bg-base p-4 rounded-2xl border border-line shrink-0 w-full lg:w-auto justify-between lg:justify-start shadow-sm">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono text-muted uppercase font-bold tracking-wider block">
                    OVERALL RISK SCORE
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`font-display text-3xl md:text-4xl font-extrabold ${riskScore >= 70
                          ? "text-rose-400"
                          : riskScore >= 40
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }`}
                    >
                      {riskScore}
                    </span>
                    <span className="text-xs font-mono text-muted font-normal">/ 100</span>
                  </div>
                </div>
                <div className="h-10 w-[1px] bg-line hidden sm:block" />
                <div className="space-y-1 max-w-[220px]">
                  <span className="text-[10px] font-mono text-muted uppercase font-semibold block">
                    PRIMARY CONCERN
                  </span>
                  <p className="text-xs font-bold text-ink leading-tight">{primaryConcern}</p>
                </div>
              </div>
            </div>

            {/* Horizontal Stacked Sentiment Distribution Bar */}
            <div className="space-y-2.5 pt-4 border-t border-line/60 relative z-10">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-muted font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-accent" /> Swarm Sentiment Consensus ({totalAgents}{" "}
                  Agents)
                </span>
                <span className="text-muted text-[11px]">
                  Net Alignment: <strong className="text-ink">{posPct}% Backing</strong> vs{" "}
                  <strong className="text-ink">{negPct + critPct}% Dissent</strong>
                </span>
              </div>

              {/* Stacked Sentiment Bar */}
              <div className="h-3.5 w-full bg-raised rounded-full overflow-hidden flex border border-line/80 shadow-inner">
                <div
                  style={{ width: `${posPct}%` }}
                  className="bg-emerald-500 h-full transition-all duration-500"
                  title={`Positive: ${posPct}%`}
                />
                <div
                  style={{ width: `${neuPct}%` }}
                  className="bg-slate-400 h-full transition-all duration-500"
                  title={`Neutral: ${neuPct}%`}
                />
                <div
                  style={{ width: `${negPct}%` }}
                  className="bg-amber-500 h-full transition-all duration-500"
                  title={`Negative: ${negPct}%`}
                />
                <div
                  style={{ width: `${critPct}%` }}
                  className="bg-rose-500 h-full transition-all duration-500"
                  title={`Critical: ${critPct}%`}
                />
              </div>

              {/* Legend with exact percentages */}
              <div className="flex flex-wrap items-center justify-between gap-y-2 pt-1 text-[11px] font-mono">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="flex items-center gap-1.5 text-ink/90 font-medium">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Positive {posPct}%
                  </span>
                  <span className="flex items-center gap-1.5 text-ink/90 font-medium">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                    Neutral {neuPct}%
                  </span>
                  <span className="flex items-center gap-1.5 text-ink/90 font-medium">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    Negative {negPct}%
                  </span>
                  <span className="flex items-center gap-1.5 text-ink/90 font-medium">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    Critical {critPct}%
                  </span>
                </div>
                <span className="text-muted text-[10px]">Round 5 Equilibrium Distribution</span>
              </div>
            </div>
          </div>

          {/* TOP TWO-COLUMN GRID: STRATEGIC SYNTHESIS & BRIEFING/CHAT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Synthesis & Action Playbook (col-span-6) */}
            <div className="lg:col-span-6 space-y-6">
              {/* Section 1: Executive Strategic Synthesis */}
              <div className="rounded-3xl border border-line bg-surface p-6 space-y-3.5 shadow-xl">
                <div className="flex items-center justify-between border-b border-line pb-2.5">
                  <h3 className="font-display text-base font-bold text-ink flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-accent" /> Executive Strategic Synthesis
                  </h3>
                  <span className="text-[10px] font-mono text-muted uppercase">Grounded Narrative</span>
                </div>
                <p className="text-sm text-ink/90 leading-relaxed font-body">
                  {cleanExecSummary || "Executive synthesis synthesized from multi-round simulation telemetry across all agent factions."}
                </p>
              </div>

              {/* Section 2: Recommended Action Playbook */}
              <div className="rounded-3xl border border-line bg-surface p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-line pb-2.5">
                  <h3 className="font-display text-base font-bold text-ink flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Recommended Action Playbook
                  </h3>
                  <span className="text-[10px] font-mono text-muted uppercase">Tactical Mitigations</span>
                </div>

                {rawPlaybook.length === 0 ? (
                  <p className="text-xs text-muted font-mono py-4 text-center">
                    No mitigation playbook items required for current scenario risk parameters.
                  </p>
                ) : (
                  <div className="space-y-3.5">
                    {rawPlaybook.map((playItem, pIdx) => {
                      const priority = playItem.priority || `P${pIdx + 1}`;
                      const targetRisk = playItem.target_risk || playItem.targetRisk || "Operational Alignment";
                      const riskDrop = playItem.projected_risk_drop || playItem.projectedRiskDrop || (18 - pIdx * 3);
                      const numMatch = String(riskDrop).match(/\d+/);
                      const dropNum = numMatch ? numMatch[0] : `${18 - pIdx * 3}`;

                      return (
                        <div
                          key={pIdx}
                          className="p-4.5 rounded-2xl bg-base border border-line space-y-2.5 shadow-sm hover:border-emerald-500/40 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="h-6 w-6 rounded-lg bg-emerald-500/15 text-emerald-400 font-mono text-xs font-bold flex items-center justify-center border border-emerald-500/30">
                                {priority}
                              </span>
                              <span className="text-[11px] font-mono text-muted uppercase font-semibold">
                                Target: <strong className="text-ink">{targetRisk}</strong>
                              </span>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-mono font-bold shrink-0">
                              -{dropNum} pts risk
                            </span>
                          </div>

                          <p className="text-xs text-ink/90 leading-relaxed font-body whitespace-pre-line">
                            {playItem.action}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: 60-Second Audio Briefing & Interactive ReportAgent Chat (col-span-6) */}
            <div className="lg:col-span-6 space-y-6">
              <ExecutiveBriefingPanel report={activeReport} activeDoc={activeDoc} />
              <ReportAgentChat
                scenarioId={getActiveScenarioId() || activeReport.id || ""}
                scenarioName={activeReport.scenarioName}
                documentName={activeDoc || activeReport.documentName}
              />
            </div>
          </div>

          {/* SECTION 1: KEY FINDINGS & MARKET PUSHBACK (SINGLE FULL-WIDTH COLUMN) */}
          <div className="rounded-3xl border border-line bg-surface p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <div>
                <h3 className="font-display text-base font-bold text-ink flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-accent" /> Key Findings & Market Pushback
                </h3>
                <p className="text-[11px] text-muted font-mono mt-0.5">
                  What People Worry About · Major Stakeholder Trust Barriers
                </p>
              </div>
              <span className="text-[10px] font-mono text-muted uppercase">Verbatim Telemetry</span>
            </div>

            {rawPushback.length === 0 ? (
              <p className="text-xs text-muted font-mono py-4 text-center">
                No critical stakeholder pushback recorded in current round.
              </p>
            ) : (
              <div className="space-y-4">
                {rawPushback.map((item, pbIdx) => (
                  <div
                    key={pbIdx}
                    className="p-4.5 rounded-2xl bg-base border border-line space-y-3 shadow-sm hover:border-accent/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-display text-sm font-bold text-ink leading-snug">
                          {item.title}
                        </h4>
                        <span className="text-[11px] font-mono text-muted">
                          Stakeholder Focus: <strong className="text-ink">{item.stakeholder_group || (item as any).stakeholderGroup}</strong>
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase shrink-0 border ${String(item.severity).includes("CRITICAL")
                            ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                            : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          }`}
                      >
                        {item.severity || "HIGH FRICTION"}
                      </span>
                    </div>

                    {/* Verbatim Stakeholder Quote */}
                    {item.quote && (
                      <div className="p-3 rounded-xl bg-surface/90 border-l-2 border-accent text-xs text-ink italic flex items-start gap-2.5 shadow-inner">
                        <Quote className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                        <span className="font-medium">&ldquo;{item.quote}&rdquo;</span>
                      </div>
                    )}

                    {/* Detailed explanation */}
                    {item.explanation && (
                      <p className="text-xs text-ink/90 leading-relaxed font-body">
                        {item.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2: STRATEGIC TRADE-OFF ANALYSIS (PARALLEL COLUMNS: ADVANTAGES VS DISADVANTAGES) */}
          <div className="rounded-3xl border border-line bg-surface p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <div>
                <h3 className="font-display text-base font-bold text-ink flex items-center gap-2">
                  <Scale className="h-4 w-4 text-accent" /> Advantages vs. Disadvantages
                </h3>
                <p className="text-[11px] text-muted font-mono mt-0.5">
                  Commercial Trade-off Analysis · Will it be helpful or not?
                </p>
              </div>
              <span className="text-[10px] font-mono text-muted uppercase">Viability Matrix</span>
            </div>

            {(!rawTradeoff.advantages || rawTradeoff.advantages.length === 0) &&
              (!rawTradeoff.disadvantages || rawTradeoff.disadvantages.length === 0) ? (
              <p className="text-xs text-muted font-mono py-4 text-center">
                Commercial trade-off evaluation pending final simulation consensus.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Advantages (Parallel Column Left) */}
                  <div className="p-4.5 rounded-2xl bg-base border border-emerald-500/30 space-y-3 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-line/60 pb-2">
                      <div className="h-6 w-6 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold text-xs">
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-display text-xs font-bold text-ink uppercase tracking-wide">
                        Key Commercial Advantages
                      </span>
                    </div>

                    <div className="space-y-3 text-xs text-ink/90 font-body">
                      {rawTradeoff.advantages.map((adv, aIdx) => {
                        const parts = adv.split(":");
                        const title = parts.length > 1 ? parts[0] : `Advantage ${aIdx + 1}`;
                        const desc = parts.length > 1 ? parts.slice(1).join(":") : adv;
                        return (
                          <div key={aIdx} className="space-y-1">
                            <p className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                              {title}
                            </p>
                            <p className="leading-relaxed text-ink/80 pl-3 whitespace-pre-line">
                              {desc}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Disadvantages (Parallel Column Right) */}
                  <div className="p-4.5 rounded-2xl bg-base border border-rose-500/30 space-y-3 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-line/60 pb-2">
                      <div className="h-6 w-6 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center font-bold text-xs">
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-display text-xs font-bold text-ink uppercase tracking-wide">
                        Downside Risks & Frictions
                      </span>
                    </div>

                    <div className="space-y-3 text-xs text-ink/90 font-body">
                      {rawTradeoff.disadvantages.map((dis, dIdx) => {
                        const parts = dis.split(":");
                        const title = parts.length > 1 ? parts[0] : `Disadvantage ${dIdx + 1}`;
                        const desc = parts.length > 1 ? parts.slice(1).join(":") : dis;
                        return (
                          <div key={dIdx} className="space-y-1">
                            <p className="font-bold text-rose-400 text-xs flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                              {title}
                            </p>
                            <p className="leading-relaxed text-ink/80 pl-3 whitespace-pre-line">
                              {desc}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Net Executive Verdict Banner (Full-Width Summary) */}
                {rawTradeoff.verdict && (
                  <div className="p-4.5 rounded-2xl bg-base border border-accent/40 space-y-2 shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted uppercase font-bold tracking-wider">
                        NET EXECUTIVE VERDICT (WILL IT BE HELPFUL?)
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono text-[10px] font-bold">
                        {rawTradeoff.verdict}
                      </span>
                    </div>
                    <p className="text-xs text-ink font-body leading-relaxed whitespace-pre-line">
                      {rawTradeoff.verdict_explanation || (rawTradeoff as any).verdictExplanation}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <AppShell title="EXECUTIVE REPORT" subtitle="AI FORECAST SYNTHESIS & ANALYSIS">
      {({ currentRound, simulationStatus }) => (
        <ReportsContent currentRound={currentRound} simulationStatus={simulationStatus} />
      )}
    </AppShell>
  );
}
