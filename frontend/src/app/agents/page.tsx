"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Users, Search, MessageSquare, Cpu, ShieldAlert, CheckCircle2, AlertTriangle, Sparkles, Filter, FileUp } from "lucide-react";
import { agentApi } from "@/lib/api/agentApi";
import { Agent, AgentState } from "@/types";

import { getActiveScenarioId, getActiveDocName, autoInitializeActiveScenario } from "@/lib/api/scenarioApi";
import { ScenarioStatusBanner } from "@/components/layout/ScenarioStatusBanner";
import { GeneratingSimulationCard } from "@/components/layout/GeneratingSimulationCard";

export default function AgentsDirectoryPage() {
  const [agentsList, setAgentsList] = useState<Agent[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTier, setSelectedTier] = useState<number | "ALL">("ALL");
  const [stateFilter, setStateFilter] = useState<AgentState | "ALL">("ALL");
  const [activeDoc, setActiveDoc] = useState<string | null>(null);

  const loadAgents = async () => {
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
      setActiveDoc(doc);
      if (doc && activeId) {
        agentApi.getAllAgents(activeId).then(setAgentsList).catch(() => {});
      } else {
        setAgentsList([]);
      }
    }
  };

  useEffect(() => {
    loadAgents();
    const handleSync = () => {
      setTimeout(() => {
        loadAgents();
      }, 50);
    };
    window.addEventListener("swarmlens_doc_updated", handleSync);
    window.addEventListener("scenario_changed", handleSync);
    return () => {
      window.removeEventListener("swarmlens_doc_updated", handleSync);
      window.removeEventListener("scenario_changed", handleSync);
    };
  }, []);

  const filteredAgents = agentsList.filter((agent) => {
    if (selectedTier !== "ALL" && agent.tier !== selectedTier) return false;
    if (stateFilter !== "ALL" && agent.currentState !== stateFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        agent.name.toLowerCase().includes(q) ||
        agent.role.toLowerCase().includes(q) ||
        agent.bias.toLowerCase().includes(q) ||
        agent.currentPosition.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const tiers = [
    { tier: 0, title: "TIER 0 · ORCHESTRATION & SYSTEM" },
    { tier: 1, title: "TIER 1 · BOARDROOM & EXECUTIVE LEADERSHIP" },
    { tier: 2, title: "TIER 2 · INSTITUTIONAL & REGULATORY WATCHDOGS" },
    { tier: 3, title: "TIER 3 · MEDIA, AMPLIFIERS & PUBLIC CRITICS" },
    { tier: 4, title: "TIER 4 · BROAD MARKET & CONSUMER POPULATION" },
  ];

  const getChannelBadge = (channel: string) => {
    switch (channel) {
      case "BOARDROOM":
        return <span className="px-2.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30 text-[10px] font-mono font-bold">BOARDROOM</span>;
      case "MEDIA":
        return <span className="px-2.5 py-0.5 rounded-full bg-accent2/15 text-accent2 border border-accent2/30 text-[10px] font-mono font-bold">MEDIA ROOM</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">PUBLIC FEED</span>;
    }
  };

  return (
    <AppShell title="AGENTS DIRECTORY" subtitle="200 AUTONOMOUS SIMULATION PERSONAS">
      {({ currentRound, simulationStatus, onInterrogateAgent }) => {
        const isRunning = ["GENERATING_GRAPH", "RUNNING_BASELINE", "RUNNING_WHAT_IF", "RUNNING"].includes(simulationStatus);
        return (
          <div className="space-y-8 max-w-7xl mx-auto pb-16 select-none">
            <ScenarioStatusBanner onScenarioCompleted={loadAgents} />
            {!activeDoc ? (
              <div className="rounded-3xl border border-dashed border-line bg-surface p-12 flex flex-col items-center justify-center text-center space-y-5 my-12">
                <div className="h-16 w-16 rounded-2xl bg-accent/10 border border-accent/30 text-accent flex items-center justify-center shadow-lg shadow-accent/10">
                  <Users className="h-8 w-8" />
                </div>
                <div className="space-y-2 max-w-md">
                  <h3 className="font-display text-xl font-extrabold text-ink">No Active Agent Swarm</h3>
                  <p className="text-xs text-muted leading-relaxed font-body">
                    Upload your strategy memo, pricing document, or policy file (.PDF, .DOCX, .TXT) to generate 200 autonomous agent personas across 5 tiers.
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
                  <span>Upload PDF & Generate Agents</span>
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
          {/* Top Filter & Search Header Card */}
          <div className="rounded-3xl border border-line/80 bg-surface/90 p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl backdrop-blur-md">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search personas by role, bias, or position..."
                className="w-full bg-base/80 border border-line/80 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:border-accent font-mono transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto font-mono text-xs">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted" />
                <select
                  value={selectedTier}
                  onChange={(e) =>
                    setSelectedTier(e.target.value === "ALL" ? "ALL" : Number(e.target.value))
                  }
                  className="bg-base/80 border border-line/80 rounded-2xl px-4 py-2.5 text-ink focus:outline-none focus:border-accent cursor-pointer"
                >
                  <option value="ALL">All Tiers (0-4)</option>
                  <option value="0">Tier 0: System & Orchestration</option>
                  <option value="1">Tier 1: Boardroom & Executives</option>
                  <option value="2">Tier 2: Regulatory & Watchdogs</option>
                  <option value="3">Tier 3: Media & Critics</option>
                  <option value="4">Tier 4: Market & Consumers</option>
                </select>
              </div>

              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value as AgentState | "ALL")}
                className="bg-base/80 border border-line/80 rounded-2xl px-4 py-2.5 text-ink focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="ALL">All States</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="THINKING">THINKING</option>
                <option value="RESPONDING">RESPONDING</option>
                <option value="ALERT">ALERT</option>
                <option value="IDLE">IDLE</option>
              </select>
            </div>
          </div>

          {/* Grouped Tiers List */}
          <div className="space-y-10">
            {tiers.map(({ tier, title }) => {
              const tierAgents = filteredAgents.filter((a) => a.tier === tier);
              if (tierAgents.length === 0) return null;

              return (
                <div key={tier} className="space-y-4">
                  {/* Tier Title Header */}
                  <div className="flex items-center justify-between border-b border-line/60 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-xl bg-accent/15 text-accent flex items-center justify-center border border-accent/20">
                        <Cpu className="h-4 w-4" />
                      </div>
                      <h3 className="font-display text-sm font-bold text-ink tracking-tight">
                        {title}
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-muted bg-base px-3 py-1 rounded-full border border-line/60 font-semibold">
                      {tierAgents.length} Agents Active
                    </span>
                  </div>

                  {/* Agent Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {tierAgents.map((agent, aIdx) => (
                      <div
                        key={agent.id ? `agent-${agent.id}-${aIdx}` : `agent-${agent.numberId || aIdx}-${aIdx}`}
                        className="rounded-3xl border border-line/80 bg-surface/90 p-5 flex flex-col justify-between hover:border-accent/50 transition-all space-y-4 group shadow-xl hover:shadow-accent/5"
                      >
                        <div className="space-y-3">
                          {/* Card Header: Avatar, Role, Name, State Badge */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-2xl bg-raised border border-line/80 flex items-center justify-center font-mono font-bold text-accent text-xs shrink-0 shadow-inner">
                                A{String(agent.numberId).padStart(2, "0")}
                              </div>
                              <div>
                                <h4 className="font-display text-sm font-bold text-ink leading-snug group-hover:text-accent transition-colors">
                                  {agent.role}
                                </h4>
                                <p className="text-[11px] font-mono text-muted">{agent.name}</p>
                              </div>
                            </div>

                            <span
                              className={`text-[9px] font-mono px-2.5 py-1 rounded-full font-bold uppercase shrink-0 border ${
                                agent.currentState === "ALERT"
                                  ? "bg-accent2/20 text-accent2 border-accent2/30"
                                  : agent.currentState === "ACTIVE"
                                  ? "bg-accent/20 text-accent border-accent/30"
                                  : agent.currentState === "THINKING"
                                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                  : "bg-raised text-muted border-line"
                              }`}
                            >
                              {agent.currentState}
                            </span>
                          </div>

                          {/* Risk Threshold & Bias Section */}
                          <div className="p-3 rounded-2xl bg-base/80 border border-line/60 text-xs space-y-2">
                            <div className="flex items-center justify-between text-[10px] font-mono">
                              <span className="text-muted font-semibold uppercase">RISK THRESHOLD</span>
                              <span className="text-accent2 font-bold">{agent.riskThreshold}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden border border-line/40">
                              <div
                                className="h-full bg-accent2 rounded-full"
                                style={{ width: `${agent.riskThreshold}%` }}
                              />
                            </div>
                            <p className="text-[11px] text-muted font-mono leading-relaxed pt-0.5">
                              <span className="text-ink font-semibold">Bias:</span> {agent.bias}
                            </p>
                          </div>

                          {/* Agent Position Statement */}
                          <p className="text-xs text-ink/90 leading-relaxed font-body italic pl-2 border-l-2 border-accent/40">
                            &ldquo;{agent.currentPosition}&rdquo;
                          </p>
                        </div>

                        {/* Card Footer: Channel Tag + Interrogate Trigger */}
                        <div className="pt-3 border-t border-line/60 flex items-center justify-between text-[11px] font-mono">
                          <div>{getChannelBadge(agent.currentChannel)}</div>

                          {onInterrogateAgent && (
                            <button
                              onClick={() => onInterrogateAgent(agent)}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-accent text-white font-semibold text-xs hover:opacity-90 transition-all shadow-md shadow-accent/20"
                            >
                              <MessageSquare className="h-3.5 w-3.5" /> Interrogate
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          </>
          )}
        </div>
        );
      }}
    </AppShell>
  );
}
