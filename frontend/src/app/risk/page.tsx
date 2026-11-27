"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ShieldAlert, Users, AlertTriangle, CheckCircle2, FileUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { reportApi } from "@/lib/api/reportApi";
import { agentApi } from "@/lib/api/agentApi";

import { getActiveScenarioId, getActiveDocName, autoInitializeActiveScenario } from "@/lib/api/scenarioApi";
import { ScenarioStatusBanner } from "@/components/layout/ScenarioStatusBanner";
import { GeneratingSimulationCard } from "@/components/layout/GeneratingSimulationCard";

export default function RiskSynthesisPage() {
  const [risksData, setRisksData] = useState<any>(null);
  const [sentimentData, setSentimentData] = useState<any>(null);
  const [consensusData, setConsensusData] = useState<any>(null);
  const [allAgents, setAllAgents] = useState<any[]>([]);
  const [activeDoc, setActiveDoc] = useState<string | null>(null);

  const [isInitializing, setIsInitializing] = useState(true);

  const syncDoc = async (): Promise<string | null> => {
    if (typeof window !== "undefined") {
      let doc = getActiveDocName();
      let activeId = getActiveScenarioId();
      if (!doc || doc === "No document loaded" || !activeId) {
        if (localStorage.getItem("SWARMLENS_MANUALLY_CLEARED") !== "true") {
          const initialized = await autoInitializeActiveScenario();
          if (initialized) {
            doc = initialized.documentName && initialized.documentName !== "No document loaded"
              ? initialized.documentName
              : `${initialized.name.replace(/\s+/g, "_")}.pdf`;
            activeId = initialized.id;
          }
        }
      }

      if (!doc) {
        setTimeout(() => {
          setActiveDoc(null);
          setRisksData(null);
          setSentimentData(null);
          setConsensusData(null);
          setAllAgents([]);
          setSummaryData(null);
          setIsInitializing(false);
        }, 0);
        return null;
      }

      setTimeout(() => {
        setActiveDoc(doc);
        setIsInitializing(false);
      }, 0);
      return activeId;
    }
    return null;
  };

  const [summaryData, setSummaryData] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadRiskData = async (targetId?: string) => {
    const doc = getActiveDocName();
    if (!doc) {
      setRisksData(null);
      setSentimentData(null);
      setConsensusData(null);
      setAllAgents([]);
      setSummaryData(null);
      return;
    }

    let activeId = targetId || getActiveScenarioId();
    if (!activeId) return;

    try {
      const [rData, sData, cData, agentsList, sumData] = await Promise.all([
        reportApi.getRisks(activeId),
        reportApi.getSentimentTimeSeries(activeId),
        reportApi.getConsensusMatrix(activeId),
        agentApi.getAgentsForScenario(activeId),
        reportApi.getReportSummary(activeId),
      ]);

      setRisksData(rData);
      setSentimentData(sData);
      setConsensusData(cData);
      setAllAgents(agentsList || []);
      if (sumData) setSummaryData(sumData);
    } catch (err) {
      console.warn("[RiskPage] Error loading risk data:", err);
    }
  };

  useEffect(() => {
    syncDoc().then((resolvedId) => {
      loadRiskData(resolvedId || undefined);
    });

    const handleSync = () => {
      setTimeout(() => {
        syncDoc().then((resolvedId) => {
          loadRiskData(resolvedId || undefined);
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
  const primaryConcern = summaryData?.primary_concern ?? risksData?.primaryConcern ?? "Stakeholder Backlash & Market Churn";
  const keyRisks = (summaryData?.risk_vectors && summaryData.risk_vectors.length > 0) ? summaryData.risk_vectors : (risksData?.keyRisks ?? []);
  
  const rawPos = summaryData?.sentiment?.positive_pct ?? sentimentData?.breakdown?.positive ?? 0;
  const rawNeu = summaryData?.sentiment?.neutral_pct ?? sentimentData?.breakdown?.neutral ?? 0;
  const rawNeg = summaryData?.sentiment?.negative_pct ?? sentimentData?.breakdown?.negative ?? 0;
  const rawCrit = summaryData?.sentiment?.critical_pct ?? sentimentData?.breakdown?.critical ?? 0;
  const breakdown = {
    positive: Math.round(Number(rawPos)),
    neutral: Math.round(Number(rawNeu)),
    negative: Math.round(Number(rawNeg)),
    critical: Math.round(Number(rawCrit)),
  };
  const matrixItems = consensusData?.items ?? [];
  const totalItems = matrixItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedItems = matrixItems.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  return (
    <AppShell title="RISK SYNTHESIS" subtitle="EXECUTIVE SCENARIO RISK DASHBOARD">
      {({ currentRound, simulationStatus, onInterrogateAgent }) => {
        const isRunning = (simulationStatus as string) === "GENERATING_GRAPH" || (simulationStatus as string) === "SIMULATING" || (simulationStatus as string).startsWith("RUNNING") || Boolean((risksData as any)?.is_simulating);
        return (
          <div className="space-y-6 max-w-7xl mx-auto pb-32 select-none">
            <ScenarioStatusBanner onScenarioCompleted={loadRiskData} />
            {isInitializing ? (
              <div className="rounded-3xl border border-line bg-surface p-12 flex flex-col items-center justify-center text-center space-y-4 my-12 animate-pulse">
                <ShieldAlert className="h-8 w-8 text-accent animate-bounce" />
                <p className="text-xs font-mono text-muted">Loading scenario risk matrix...</p>
              </div>
            ) : !activeDoc ? (
              <div className="rounded-3xl border border-dashed border-line bg-surface p-12 flex flex-col items-center justify-center text-center space-y-5 my-12">
                <div className="h-16 w-16 rounded-2xl bg-accent2/10 border border-accent2/30 text-accent2 flex items-center justify-center shadow-lg shadow-accent2/10">
                  <ShieldAlert className="h-8 w-8" />
                </div>
                <div className="space-y-2 max-w-md">
                  <h3 className="font-display text-xl font-extrabold text-ink">No Risk Synthesis Available</h3>
                  <p className="text-xs text-muted leading-relaxed font-body">
                    Upload your strategy document (.PDF, .DOCX, .TXT) to run executive scenario risk synthesis, calculate agent consensus stance ratios, and quantify sentiment vectors.
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
                  <span>Upload PDF Document</span>
                </button>
              </div>
            ) : isRunning ? (
              <GeneratingSimulationCard
                currentRound={currentRound}
                simulationStatus={simulationStatus}
                onForceComplete={() => {
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new Event("swarmlens_force_complete"));
                  }
                }}
              />
            ) : (
              <>
          {/* Risk Overview Gauge & Sentiment Header */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Overall Risk Score Card */}
            <div className="lg:col-span-4 rounded-3xl border border-line/80 bg-surface/90 p-6 flex flex-col justify-between shadow-xl">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-muted uppercase tracking-wider font-semibold">OVERALL SCENARIO RISK</span>
                  <span className="px-3 py-1 rounded-full bg-accent2/15 text-accent2 border border-accent2/30 text-[10px] font-mono font-bold">
                    {severityThreshold} THRESHOLD
                  </span>
                </div>

                <div className="mt-6 flex items-baseline gap-3">
                  <span className="font-display text-5xl font-extrabold text-accent2">
                    {overallRisk}
                  </span>
                  <span className="text-xl font-mono text-muted">/ 100</span>
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="h-2.5 w-full bg-base rounded-full overflow-hidden border border-line/60 p-0.5">
                    <div
                      className="h-full bg-accent2 rounded-full transition-all duration-500"
                      style={{ width: `${overallRisk}%` }}
                    />
                  </div>
                  <p className="text-[11px] font-mono text-muted">
                    Calculated across 200 autonomous agent vectors & public sentiment
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-line/60 mt-6 flex items-center justify-between text-xs font-mono">
                <span className="text-muted font-medium">Primary Concern:</span>
                <span className="text-ink font-semibold">{primaryConcern}</span>
              </div>
            </div>

            {/* Sentiment Evolution */}
            <div className="lg:col-span-8 rounded-3xl border border-line/80 bg-surface/90 p-6 flex flex-col justify-between shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-line/60 pb-3">
                <div>
                  <h3 className="font-display text-sm font-bold text-ink">SENTIMENT DISTRIBUTION</h3>
                  <p className="text-xs text-muted">Aggregated across Boardroom, Press, & Public channels</p>
                </div>
                <span className="text-xs font-mono text-accent font-semibold">Real Simulation Aggregation</span>
              </div>

              {/* Sentiment Bars */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> POSITIVE
                    </span>
                    <span className="text-ink font-bold">{breakdown.positive}%</span>
                  </div>
                  <div className="h-2 w-full bg-base/80 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${breakdown.positive}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted font-semibold">NEUTRAL</span>
                    <span className="text-ink font-bold">{breakdown.neutral}%</span>
                  </div>
                  <div className="h-2 w-full bg-base/80 rounded-full overflow-hidden">
                    <div className="h-full bg-muted transition-all duration-500" style={{ width: `${breakdown.neutral}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-red-400 font-semibold flex items-center gap-1">
                      <ShieldAlert className="h-3.5 w-3.5" /> NEGATIVE
                    </span>
                    <span className="text-ink font-bold">{breakdown.negative}%</span>
                  </div>
                  <div className="h-2 w-full bg-base/80 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 transition-all duration-500" style={{ width: `${breakdown.negative}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-accent2 font-semibold flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> CRITICAL
                    </span>
                    <span className="text-ink font-bold">{breakdown.critical}%</span>
                  </div>
                  <div className="h-2 w-full bg-base/80 rounded-full overflow-hidden">
                    <div className="h-full bg-accent2 transition-all duration-500" style={{ width: `${breakdown.critical}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Key Risks Vectors */}
          <div className="rounded-3xl border border-line/80 bg-surface/90 p-6 space-y-4 shadow-xl">
            <h3 className="font-display text-base font-bold text-ink border-b border-line/60 pb-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-accent2" /> KEY RISK VECTORS
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {keyRisks.map((risk: any, rIdx: number) => (
                <div key={risk.id ? `risk-vec-${risk.id}-${rIdx}` : `risk-idx-${rIdx}`} className="p-5 rounded-2xl bg-base/60 border border-line/60 space-y-3 hover:border-accent/40 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">{risk.title}</span>
                    <span className="text-xs font-mono font-bold text-accent2">{risk.score}/100</span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">{risk.description}</p>
                  <div className="flex items-center justify-between pt-2 border-t border-line/40 text-[10px] font-mono text-muted">
                    <span>Impacted Agents: {risk.impactedAgentsCount ?? risk.impacted_agents ?? 65}</span>
                    <span className="text-accent font-semibold">
                      {String(risk.severity || "MODERATE").replace(/SEVERITY/gi, "").trim()} SEVERITY
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Agent Consensus Matrix */}
          <div className="rounded-3xl border border-line/80 bg-surface/90 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <h3 className="font-display text-base font-bold text-ink flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" /> AGENT CONSENSUS MATRIX
              </h3>
              <div className="flex items-center gap-3">
                {totalItems > 0 && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-raised text-muted border border-line">
                    Page {currentPage} of {totalPages}
                  </span>
                )}
                <span className="text-xs font-mono text-muted font-medium">
                  Live {totalItems > 0 ? `${totalItems}-Agent` : "Agent"} Stance Ratios
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-line/60 text-muted uppercase text-[10px]">
                  <tr>
                    <th className="pb-3 font-semibold">Agent & Role</th>
                    <th className="pb-3 font-semibold">Tier</th>
                    <th className="pb-3 font-semibold">Stance / Position</th>
                    <th className="pb-3 font-semibold text-right">Confidence</th>
                    <th className="pb-3 font-semibold text-right">Risk Level</th>
                    <th className="pb-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/40">
                  {paginatedItems.map((item: any, mIdx: number) => {
                    const globalIdx = startIndex + mIdx;
                    const agent = allAgents.find((a) => a.id === item.agentId);
                    return (
                      <tr key={`matrix-row-${item.agentId || item.id || mIdx}-${globalIdx}`} className="hover:bg-raised/40 transition-colors">
                        <td className="py-3 font-semibold text-ink">
                          {item.role} <span className="text-muted font-normal">({item.agentName})</span>
                        </td>
                        <td className="py-3 text-muted">Tier {item.tier}</td>
                        <td className="py-3 text-ink/90 font-body max-w-md leading-relaxed">{item.position}</td>
                        <td className="py-3 text-right font-bold text-emerald-400">{item.confidence}%</td>
                        <td className="py-3 text-right">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              item.riskLevel === "CRITICAL"
                                ? "bg-accent2/20 text-accent2 border border-accent2/30"
                                : item.riskLevel === "HIGH"
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : "bg-raised text-muted border border-line"
                            }`}
                          >
                            {item.riskLevel}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          {agent && onInterrogateAgent && (
                            <button
                              onClick={() => onInterrogateAgent(agent)}
                              className="text-accent hover:underline font-bold text-[11px]"
                            >
                              Interrogate
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalItems > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-line/60">
                <div className="flex items-center gap-3 text-xs font-mono text-muted">
                  <span>
                    Showing <span className="font-bold text-ink">{startIndex + 1}</span>–
                    <span className="font-bold text-ink">{Math.min(startIndex + pageSize, totalItems)}</span> of{" "}
                    <span className="font-bold text-ink">{totalItems}</span> Agents
                  </span>
                  <div className="flex items-center gap-1.5 ml-2">
                    <span className="text-[11px] text-muted">Per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="bg-base border border-line/80 rounded-lg px-2 py-1 text-xs font-mono text-ink focus:outline-none focus:border-accent cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-line bg-base text-muted hover:text-ink hover:bg-raised disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    title="First Page"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-line bg-base text-muted hover:text-ink hover:bg-raised disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    title="Previous Page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div className="flex items-center gap-1 font-mono text-xs px-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        if (totalPages <= 7) return true;
                        if (page === 1 || page === totalPages) return true;
                        if (Math.abs(page - currentPage) <= 1) return true;
                        return false;
                      })
                      .reduce((acc: (number | string)[], page, idx, arr) => {
                        if (idx > 0 && (page as number) - (arr[idx - 1] as number) > 1) {
                          acc.push(`ellipsis-${page}`);
                        }
                        acc.push(page);
                        return acc;
                      }, [])
                      .map((item, pIdx) => {
                        if (typeof item === "string") {
                          return (
                            <span key={`page-ell-${item}-${pIdx}`} className="px-1 text-muted">
                              …
                            </span>
                          );
                        }
                        const isCurrent = item === currentPage;
                        return (
                          <button
                            key={`page-btn-${item}-${pIdx}`}
                            onClick={() => setCurrentPage(item)}
                            className={`min-w-[28px] h-7 px-2 rounded-lg font-bold text-xs transition-all ${
                              isCurrent
                                ? "bg-accent text-white shadow-xs"
                                : "text-muted hover:text-ink hover:bg-raised"
                            }`}
                          >
                            {item}
                          </button>
                        );
                      })}
                  </div>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-line bg-base text-muted hover:text-ink hover:bg-raised disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    title="Next Page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-line bg-base text-muted hover:text-ink hover:bg-raised disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    title="Last Page"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
          </>
          )}
        </div>
        );
      }}
    </AppShell>
  );
}
