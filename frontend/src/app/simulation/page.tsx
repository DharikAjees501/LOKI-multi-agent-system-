"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { GeneratingSimulationCard } from "@/components/layout/GeneratingSimulationCard";
import {
  FileUp,
  Sparkles,
  Network,
  Play,
  ShieldAlert,
  SlidersHorizontal,
  ArrowRight,
  Zap,
  Loader2,
} from "lucide-react";
import { graphApi } from "@/lib/api/graphApi";
import { scenarioApi, getActiveScenarioId, getActiveDocName, setActiveScenarioContext, autoInitializeActiveScenario } from "@/lib/api/scenarioApi";

function SimulationWorkspaceContent({
  currentRound,
  simulationStatus,
  onInterrogateAgent,
}: {
  currentRound: number;
  simulationStatus: string;
  onInterrogateAgent: (agent: any) => void;
}) {
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  
  // MiroFish 3-Phase Lifecycle State
  const [phase, setPhase] = useState<"A_INGESTION" | "B_CONFIG" | "C_SIMULATING" | "COMPLETED">("A_INGESTION");
  
  // Phase B Config Inputs
  const [goalPrompt, setGoalPrompt] = useState("");
  const [shockEvent, setShockEvent] = useState("");
  const [riskThreshold, setRiskThreshold] = useState(35);
  
  // Timeline Scrubber State (Rounds 1-5)
  const [scrubRound, setScrubRound] = useState(1);

  const syncDoc = async () => {
    if (typeof window !== "undefined") {
      let doc = getActiveDocName();
      let activeId = getActiveScenarioId();

      if (!doc || doc === "No document loaded" || !activeId) {
        if (localStorage.getItem("SWARMLENS_MANUALLY_CLEARED") !== "true") {
          const initialized = await autoInitializeActiveScenario();
          if (initialized) {
            doc = initialized.documentName;
            activeId = initialized.id;
          }
        }
      }

      if (!doc) {
        setTimeout(() => {
          setActiveDoc(null);
          setGoalPrompt("");
          setPhase("A_INGESTION");
        }, 0);
        return;
      }

      const scenDesc = localStorage.getItem("SWARMLENS_ACTIVE_SCENARIO_DESC") || localStorage.getItem("LOKI_ACTIVE_SCENARIO_DESC");

      setTimeout(() => {
        setActiveDoc((prev) => (prev !== doc ? doc : prev));

        if (scenDesc) {
          setGoalPrompt((prev) => (prev !== scenDesc ? scenDesc : prev));
        } else if (doc) {
          const promptText = `Evaluate stakeholder alignment and market risk for strategy document: ${doc}`;
          setGoalPrompt((prev) => (prev !== promptText ? promptText : prev));
        } else {
          const fallbackPrompt = "Predict stakeholder backlash against unannounced strategy restructuring.";
          setGoalPrompt((prev) => (prev !== fallbackPrompt ? fallbackPrompt : prev));
        }

        setShockEvent(`CRITICAL SHOCK: Unannounced strategy price restructuring & data compliance audit launched!`);
      }, 0);

      // Check if active scenario is already completed in backend
      try {
        const scens = await scenarioApi.getScenarios();
        const currentScen = scens.find((s) => s.id === activeId);
        if (simulationStatus !== "RUNNING" && currentScen && ["COMPLETED", "BASELINE_COMPLETED", "WHAT_IF_COMPLETED"].includes(currentScen.status)) {
          setPhase((prev) => (prev !== "COMPLETED" ? "COMPLETED" : prev));
          setScrubRound((prev) => (prev !== 5 ? 5 : prev));
        }
      } catch (err) {
        console.warn("[SimulationPage] Error checking scenario completion status:", err);
      }
    }
  };

  useEffect(() => {
    syncDoc();
    const handleSync = () => {
      setTimeout(() => {
        syncDoc();
      }, 50);
    };
    window.addEventListener("swarmlens_doc_updated", handleSync);
    window.addEventListener("scenario_changed", handleSync);
    return () => {
      window.removeEventListener("swarmlens_doc_updated", handleSync);
      window.removeEventListener("scenario_changed", handleSync);
    };
  }, []);

  const handleStartSimulation = async () => {
    setPhase("C_SIMULATING");
    setScrubRound(1);

    const docName = activeDoc || "AeroFlow_Cloud_Migration_Strategy.pdf";
    const titleToSave = `What-If Scenario: ${goalPrompt.slice(0, 30)}...`;

    try {
      // Create new isolated Scenario 2 record & trigger background What-If simulation
      const newScen = await scenarioApi.createAndRunScenario({
        name: titleToSave,
        description: goalPrompt,
        documentId: docName,
        isWhatIf: true,
      });

      const scenId = newScen?.id || `scen-whatif-${Date.now().toString(36)}`;
      setActiveScenarioContext(scenId, docName, titleToSave, goalPrompt);

      if (typeof window !== "undefined") {
        localStorage.setItem("LOKI_ACTIVE_SCENARIO_DESC", goalPrompt);
        localStorage.setItem("SWARMLENS_ACTIVE_SCENARIO_DESC", goalPrompt);
        localStorage.setItem("SWARMLENS_CURRENT_ROUND", "1");
        localStorage.setItem("LOKI_CURRENT_ROUND", "1");
        localStorage.setItem("SWARMLENS_SIM_STATUS", "RUNNING");
        localStorage.setItem("LOKI_SIM_STATUS", "RUNNING");
        window.dispatchEvent(new Event("loki_start_simulation"));
        window.dispatchEvent(new Event("swarmlens_start_simulation"));
      }
    } catch (err) {
      console.warn("What-If simulation run notice:", err);
    }
  };

  // Real Dynamic Graph State
  const [swarmNodes, setSwarmNodes] = useState<any[]>([]);
  const [swarmEdges, setSwarmEdges] = useState<any[]>([]);

  const loadDynamicGraph = async () => {
    const activeId = getActiveScenarioId();
    const data = await graphApi.getSwarmGraph(activeId, scrubRound);
    if (data && data.nodes) {
      setSwarmNodes(data.nodes);
      setSwarmEdges(data.edges || []);
    }
  };

  useEffect(() => {
    loadDynamicGraph();
  }, [scrubRound, activeDoc, phase]);

  // Synchronize round progression when simulation is RUNNING or completed
  useEffect(() => {
    if (simulationStatus === "RUNNING") {
      setScrubRound(currentRound);
    }
    if (simulationStatus === "COMPLETED" && phase !== "COMPLETED") {
      setScrubRound(5);
      setPhase("COMPLETED");
    }
  }, [currentRound, simulationStatus, phase]);

  return (
    <div className="w-full max-w-7xl mx-auto select-none flex flex-col space-y-6 pb-24">
          {!activeDoc ? (
            /* No Document State */
            <div className="rounded-3xl border border-dashed border-line bg-surface p-12 flex flex-col items-center justify-center text-center space-y-5 my-8 min-h-[400px]">
              <div className="h-16 w-16 rounded-2xl bg-accent/10 border border-accent/30 text-accent flex items-center justify-center shadow-lg shadow-accent/10">
                <Network className="h-8 w-8" />
              </div>
              <div className="space-y-2 max-w-md">
                <h3 className="font-display text-xl font-extrabold text-ink">No Strategy Document Loaded</h3>
                <p className="text-xs text-muted leading-relaxed font-body">
                  Upload your strategy memo, pricing document, or policy file (.PDF, .DOCX, .TXT) to initialize Phase A Knowledge Graph extraction.
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
                <span>Upload PDF Document (Phase A)</span>
              </button>
            </div>
          ) : (
            <>
              {/* Phase Banner - hidden when simulation is complete */}
              {phase !== "COMPLETED" && (
                <div className="rounded-3xl border border-line bg-surface p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center font-mono font-bold text-sm">
                      {simulationStatus === "RUNNING" ? "C" : phase === "A_INGESTION" ? "A" : "B"}
                    </div>
                    <div>
                      <h3 className="font-display text-sm font-bold text-ink">
                        {simulationStatus === "RUNNING" && `PHASE C: 5-Cycle OASIS Simulation Executing (Round 0${currentRound} / 05)...`}
                        {simulationStatus !== "RUNNING" && phase === "A_INGESTION" && "PHASE A: Static Knowledge Graph Extracted"}
                        {simulationStatus !== "RUNNING" && phase === "B_CONFIG" && "PHASE B: Scenario & Shock Event Configuration"}
                      </h3>
                      <p className="text-[11px] font-mono text-muted">Document: {activeDoc}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {simulationStatus === "RUNNING" ? (
                      <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-xs font-bold flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> DELIBERATING ROUND 0{currentRound} / 05
                      </span>
                    ) : (
                      <>
                        {phase === "A_INGESTION" && (
                          <button
                            onClick={() => setPhase("B_CONFIG")}
                            className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-1.5 shadow-md shadow-accent/20"
                          >
                            <span>Configure Scenario (Phase B)</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {phase === "B_CONFIG" && (
                          <button
                            onClick={() => setPhase("A_INGESTION")}
                            className="px-3.5 py-2 rounded-xl bg-surface border border-line text-muted hover:text-ink text-xs font-mono"
                          >
                            Back to Graph
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* SIMULATION IN PROGRESS LOADING CARD */}
              {simulationStatus === "RUNNING" ? (
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
                  {/* PHASE B CONFIGURATION VIEW */}
                  {phase === "B_CONFIG" && (
                    <div className="rounded-3xl border border-line bg-surface p-8 space-y-6 shadow-xl max-w-4xl mx-auto w-full animate-in fade-in duration-300">
                      <div className="flex items-center gap-3 border-b border-line pb-4">
                        <div className="h-10 w-10 rounded-2xl bg-accent/15 text-accent flex items-center justify-center">
                          <SlidersHorizontal className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="font-display text-lg font-bold text-ink">Phase B: Scenario Configuration</h2>
                          <p className="text-xs text-muted font-mono">Define goal prompt, shock event, and risk threshold before simulation execution.</p>
                        </div>
                      </div>

                      {/* 1. Goal Prompt */}
                      <div className="space-y-2">
                        <label className="text-xs font-mono font-bold text-ink uppercase flex items-center gap-2">
                          <Sparkles className="h-3.5 w-3.5 text-accent" /> 1. Goal / "What-If" Prompt
                        </label>
                        <textarea
                          value={goalPrompt}
                          onChange={(e) => setGoalPrompt(e.target.value)}
                          rows={2}
                          className="w-full bg-base border border-line rounded-2xl p-3.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:border-accent font-body"
                        />
                      </div>

                      {/* 2. Swarm Size Badge */}
                      <div className="p-4 rounded-2xl bg-base border border-line flex items-center justify-between">
                        <div>
                          <span className="text-xs font-mono font-bold text-ink uppercase block">2. Swarm Size & Factions</span>
                          <span className="text-[11px] text-muted font-mono">Locked to 200 Heavy Agents across 8 OASIS sub-cluster channels</span>
                        </div>
                        <span className="px-3 py-1.5 rounded-full bg-accent/10 border border-accent/30 text-accent font-mono text-xs font-bold">
                          200 AGENTS · 8 FACTIONS
                        </span>
                      </div>

                      {/* 3. Shock Injection Event */}
                      <div className="space-y-2">
                        <label className="text-xs font-mono font-bold text-ink uppercase flex items-center gap-2">
                          <Zap className="h-3.5 w-3.5 text-amber-500" /> 3. Round 3 Shock Injection Event
                        </label>
                        <input
                          type="text"
                          value={shockEvent}
                          onChange={(e) => setShockEvent(e.target.value)}
                          className="w-full bg-base border border-line rounded-2xl px-4 py-3 text-xs text-ink focus:outline-none focus:border-accent font-body"
                        />
                      </div>

                      {/* 4. Risk Threshold Slider */}
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <label className="font-bold text-ink uppercase flex items-center gap-2">
                            <ShieldAlert className="h-3.5 w-3.5 text-accent2" /> 4. Risk Threshold Alert (%)
                          </label>
                          <span className="text-accent font-bold text-sm">{riskThreshold}% Opposed Alert</span>
                        </div>
                        <input
                          type="range"
                          min={10}
                          max={80}
                          value={riskThreshold}
                          onChange={(e) => setRiskThreshold(Number(e.target.value))}
                          className="w-full accent-accent"
                        />
                      </div>

                      {/* Start Button */}
                      <button
                        onClick={handleStartSimulation}
                        className="w-full py-4 rounded-2xl bg-accent text-white font-bold text-sm hover:opacity-90 transition-all shadow-xl shadow-accent/25 flex items-center justify-center gap-3"
                      >
                        <Play className="h-5 w-5 fill-current" />
                        <span>Start Simulation (Rounds 1–5)</span>
                      </button>
                    </div>
                  )}

                  {/* PHASE A / COMPLETED GRAPH CANVAS VIEW */}
                  {(phase === "A_INGESTION" || phase === "COMPLETED") && (
                    <div className="space-y-6">
                      {/* Compact Sentiment Indicator Legend */}
                      <div className="flex items-center justify-end gap-5 font-mono text-xs px-2 py-0.5">
                        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50" /> Pro
                        </span>
                        <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-xs shadow-amber-500/50" /> Warning / Neutral
                        </span>
                        <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
                          <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-xs shadow-rose-500/50" /> Opposed
                        </span>
                      </div>

                  {/* 200-Node Force Directed Canvas */}
                  <GraphCanvas
                    nodes={swarmNodes}
                    edges={swarmEdges}
                    onInterrogateAgent={onInterrogateAgent}
                  />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
  );
}

export default function SimulationWorkspacePage() {
  return (
    <AppShell title="SIMULATION WORKSPACE" subtitle="MIROFISH MULTI-STAGE LIFECYCLE & 200-AGENT SWARM">
      {({ currentRound, simulationStatus, onInterrogateAgent }) => (
        <SimulationWorkspaceContent
          currentRound={currentRound}
          simulationStatus={simulationStatus}
          onInterrogateAgent={onInterrogateAgent}
        />
      )}
    </AppShell>
  );
}
