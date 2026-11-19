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
  Sliders,
  ShieldAlert,
  SlidersHorizontal,
  ArrowRight,
  RotateCcw,
  Volume2,
  VolumeX,
  FileSpreadsheet,
  Layers,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  UserCheck,
  Shield,
  Zap,
  Loader2,
} from "lucide-react";
import { reportApi } from "@/lib/api/reportApi";
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
  
  // Post-Simulation Report Data
  const [riskMonitor, setRiskMonitor] = useState<any>(null);
  const [raciMatrix, setRaciMatrix] = useState<any>(null);
  const [slideDeck, setSlideDeck] = useState<any[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [audioBriefing, setAudioBriefing] = useState<any>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

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
          setRiskMonitor(null);
          setRaciMatrix(null);
          setSlideDeck([]);
          setAudioBriefing(null);
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
          Promise.all([
            reportApi.getRiskThresholdMonitor(activeId, riskThreshold),
            reportApi.getRaciMatrix(activeId),
            reportApi.getSlideDeck(activeId),
            reportApi.getAudioBriefing(activeId),
          ]).then(([monitorData, raciData, slidesData, audioData]) => {
            if (monitorData) setRiskMonitor(monitorData);
            if (raciData) setRaciMatrix(raciData);
            if (slidesData) setSlideDeck(slidesData);
            if (audioData) setAudioBriefing(audioData);
          }).catch(() => {});
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

  const handleToggleAudio = () => {
    if (!audioBriefing?.narration_script) return;
    if (isPlayingAudio) {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingAudio(false);
    } else {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const cleanScript = (audioBriefing.narration_script || "")
          .replace(/[*_#`~\[\]]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        const utterance = new SpeechSynthesisUtterance(cleanScript);
        utterance.lang = "en-US";
        utterance.rate = 1.05;

        const synth = window.speechSynthesis;
        const voices = synth.getVoices();
        if (voices && voices.length > 0) {
          const preferred = voices.find(
            (v) =>
              v.lang.startsWith("en") &&
              (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Microsoft") || v.default)
          ) || voices.find((v) => v.lang.startsWith("en"));
          if (preferred) utterance.voice = preferred;
        }

        utterance.onend = () => setIsPlayingAudio(false);
        utterance.onerror = () => setIsPlayingAudio(false);
        synth.speak(utterance);
        setIsPlayingAudio(true);
      }
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
    const activeId = getActiveScenarioId();
    if (simulationStatus === "RUNNING") {
      setScrubRound(currentRound);
    }
    if ((simulationStatus === "COMPLETED" || currentRound >= 5) && phase !== "COMPLETED") {
      setScrubRound(5);
      Promise.all([
        reportApi.getRiskThresholdMonitor(activeId, riskThreshold),
        reportApi.getRaciMatrix(activeId),
        reportApi.getSlideDeck(activeId),
        reportApi.getAudioBriefing(activeId),
      ]).then(([monitorData, raciData, slidesData, audioData]) => {
        if (monitorData) setRiskMonitor(monitorData);
        if (raciData) setRaciMatrix(raciData);
        if (slidesData) setSlideDeck(slidesData);
        if (audioData) setAudioBriefing(audioData);
        setPhase("COMPLETED");
      }).catch((e) => {
        console.warn("[SimulationPage] Error loading post-simulation reports:", e);
        setPhase("COMPLETED");
      });
    }
  }, [currentRound, simulationStatus, phase, riskThreshold]);

  return (
    <div className="h-full w-full select-none flex flex-col space-y-6 pb-16">
          {!activeDoc ? (
            /* No Document State */
            <div className="flex-1 rounded-3xl border border-dashed border-line bg-surface p-12 flex flex-col items-center justify-center text-center space-y-5 my-auto">
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
              {/* Phase Banner */}
              <div className="rounded-3xl border border-line bg-surface p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center font-mono font-bold text-sm">
                    {simulationStatus === "RUNNING" ? "C" : phase === "A_INGESTION" ? "A" : phase === "B_CONFIG" ? "B" : "C"}
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-ink">
                      {simulationStatus === "RUNNING" && `PHASE C: 5-Cycle OASIS Simulation Executing (Round 0${currentRound} / 05)...`}
                      {simulationStatus !== "RUNNING" && phase === "A_INGESTION" && "PHASE A: Static Knowledge Graph Extracted"}
                      {simulationStatus !== "RUNNING" && phase === "B_CONFIG" && "PHASE B: Scenario & Shock Event Configuration"}
                      {simulationStatus !== "RUNNING" && phase === "COMPLETED" && "PHASE C: 200-Agent Simulation Complete"}
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

                      {phase === "COMPLETED" && (
                        <button
                          onClick={() => setPhase("B_CONFIG")}
                          className="px-3.5 py-2 rounded-xl bg-surface border border-line text-muted hover:text-ink text-xs font-mono flex items-center gap-1"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Reconfigure
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

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
                      {/* Timeline Scrubber Bar */}
                      {phase === "COMPLETED" && (
                        <div className="rounded-2xl border border-line bg-surface p-3 flex items-center justify-between gap-4 font-mono text-xs shadow-sm">
                          <div className="flex items-center gap-2 text-muted">
                            <Layers className="h-4 w-4 text-accent" />
                            <span className="font-bold text-ink">TIMELINE SCRUBBER:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((r) => (
                          <button
                            key={r}
                            onClick={() => setScrubRound(r)}
                            className={`px-3.5 py-1.5 rounded-xl border transition-all ${
                              scrubRound === r
                                ? "bg-accent text-white border-accent font-bold shadow-md shadow-accent/20"
                                : "bg-base border-line text-muted hover:text-ink"
                            }`}
                          >
                            Round {r} {r === 3 && "(Shock)"}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="flex items-center gap-1 text-emerald-400 font-bold"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Pro</span>
                        <span className="flex items-center gap-1 text-amber-400 font-bold"><span className="h-2 w-2 rounded-full bg-amber-500" /> Neutral</span>
                        <span className="flex items-center gap-1 text-rose-400 font-bold"><span className="h-2 w-2 rounded-full bg-rose-500" /> Opposed</span>
                      </div>
                    </div>
                  )}

                  {/* 200-Node Force Directed Canvas */}
                  <GraphCanvas
                    nodes={swarmNodes}
                    edges={swarmEdges}
                    onInterrogateAgent={onInterrogateAgent}
                  />

                  {/* POST-SIMULATION REPORTING SECTION */}
                  {phase === "COMPLETED" && (
                    <div className="space-y-6 pt-4 animate-in fade-in duration-500">
                      {/* FEATURE 1: RISK THRESHOLD MONITOR RED ALERT CARD */}
                      {riskMonitor?.threshold_exceeded && (
                        <div className="rounded-3xl border border-rose-500/40 bg-rose-950/20 p-6 space-y-4 shadow-2xl relative overflow-hidden">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center">
                                <AlertTriangle className="h-6 w-6 animate-pulse" />
                              </div>
                              <div>
                                <h3 className="font-display text-lg font-bold text-rose-400 uppercase tracking-tight">
                                  {riskMonitor.warning_card.title}
                                </h3>
                                <p className="text-xs text-muted font-mono">{riskMonitor.warning_card.message}</p>
                              </div>
                            </div>
                            <span className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 font-mono text-xs font-bold">
                              {riskMonitor.current_opposed_pct}% OPPOSED (THRESHOLD: {riskMonitor.configured_threshold_pct}%)
                            </span>
                          </div>

                          {/* Catalyst Bridge Nodes List */}
                          <div className="space-y-2 pt-2 border-t border-rose-500/20">
                            <span className="text-[11px] font-mono font-bold text-rose-400 uppercase">
                              Primary Catalyst Bridge Nodes:
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                              {riskMonitor.warning_card.catalyst_bridge_nodes.map((node: any, idx: number) => (
                                <div key={node.role ? `bridge-${node.role}-${idx}` : `bridge-idx-${idx}`} className="p-2.5 rounded-xl bg-surface border border-line flex items-center justify-between">
                                  <span className="font-bold text-ink">{node.role} (Tier {node.tier})</span>
                                  <span className="text-[10px] text-rose-400">Breached</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* FEATURE 2: AUTOMATED RACI MATRIX TABLE */}
                      <div className="rounded-3xl border border-line bg-surface p-6 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between border-b border-line pb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
                              <FileSpreadsheet className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="font-display text-base font-bold text-ink">Automated RACI Matrix</h3>
                              <p className="text-xs text-muted font-mono">Mapped 8 OASIS sub-cluster factions into RACI governance tiers</p>
                            </div>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs font-mono border-collapse">
                            <thead>
                              <tr className="border-b border-line text-muted">
                                <th className="p-3">RACI TIER</th>
                                <th className="p-3">ROLE DEFINITION</th>
                                <th className="p-3">MAPPED OASIS FACTIONS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {raciMatrix?.matrix?.map((item: any, idx: number) => (
                                <tr key={item.category ? `raci-${item.category}-${idx}` : `raci-row-${idx}`} className="border-b border-line/50 hover:bg-base/40">
                                  <td className="p-3 font-bold text-accent">{item.category}</td>
                                  <td className="p-3 text-muted">{item.role_definition}</td>
                                  <td className="p-3 space-y-1">
                                    {item.factions.map((f: any, fIdx: number) => (
                                      <div key={f.name ? `faction-${f.name}-${fIdx}` : `faction-idx-${fIdx}`} className="text-ink font-semibold">
                                        • {f.name}
                                      </div>
                                    ))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* FEATURE 3: MULTIMODAL SYNTHESIS (SLIDE DECK & AUDIO BRIEFING) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 5-Slide Carousel Preview */}
                        <div className="rounded-3xl border border-line bg-surface p-6 space-y-4 flex flex-col justify-between shadow-sm">
                          <div className="flex items-center justify-between border-b border-line pb-3">
                            <h3 className="font-display text-base font-bold text-ink flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-accent" /> 5-Slide Executive Deck
                            </h3>
                            <span className="text-xs font-mono text-muted">
                              Slide {activeSlide + 1} of {slideDeck.length || 5}
                            </span>
                          </div>

                          {slideDeck.length > 0 && slideDeck[activeSlide] && (
                            <div className="p-5 rounded-2xl bg-base border border-line space-y-3 min-h-[160px] flex flex-col justify-center">
                              <h4 className="font-display text-sm font-bold text-accent">
                                {slideDeck[activeSlide].title || `Slide ${activeSlide + 1}`}
                              </h4>
                              {(slideDeck[activeSlide].subtitle || slideDeck[activeSlide].severity) && (
                                <p className="text-xs text-muted font-mono">
                                  {slideDeck[activeSlide].subtitle || slideDeck[activeSlide].severity}
                                </p>
                              )}
                              <ul className="space-y-1 text-xs text-ink font-body pl-4 list-disc">
                                {((slideDeck[activeSlide].content || slideDeck[activeSlide].bullet_points || []) as string[]).map((point: string, pIdx: number) => (
                                  <li key={`slide-pt-${pIdx}`}>{point}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-2">
                            <button
                              onClick={() => setActiveSlide((prev) => Math.max(0, prev - 1))}
                              disabled={activeSlide <= 0}
                              className="px-3 py-1.5 rounded-xl bg-surface border border-line text-xs font-mono disabled:opacity-40"
                            >
                              Previous
                            </button>
                            <button
                              onClick={() => setActiveSlide((prev) => Math.min(Math.max(0, slideDeck.length - 1), prev + 1))}
                              disabled={activeSlide >= slideDeck.length - 1}
                              className="px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-mono disabled:opacity-40"
                            >
                              Next Slide
                            </button>
                          </div>
                        </div>

                        {/* Audio Briefing Player */}
                        <div className="rounded-3xl border border-line bg-surface p-6 space-y-4 flex flex-col justify-between shadow-sm">
                          <div className="flex items-center justify-between border-b border-line pb-3">
                            <h3 className="font-display text-base font-bold text-ink flex items-center gap-2">
                              <Volume2 className="h-4 w-4 text-accent" /> 60-Second Audio Briefing
                            </h3>
                            <span className="text-xs font-mono text-emerald-400 font-bold">READY</span>
                          </div>

                          <div className="p-4 rounded-2xl bg-base border border-line space-y-2">
                            <p className="text-xs text-muted italic font-body leading-relaxed">
                              "{audioBriefing?.narration_script || 'Narration script ready for playback.'}"
                            </p>
                          </div>

                          <button
                            onClick={handleToggleAudio}
                            className={`w-full py-3 rounded-2xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 shadow-lg ${
                              isPlayingAudio ? "bg-rose-500 text-white" : "bg-accent text-white"
                            }`}
                          >
                            {isPlayingAudio ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                            <span>{isPlayingAudio ? "Pause Audio Briefing" : "[Play Audio Briefing]"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
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
