"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { graphApi } from "@/lib/api/graphApi";
import { GraphNode, GraphEdge, Agent } from "@/types";
import { Network, FileUp, ShieldAlert, Sparkles, Layers, RefreshCw } from "lucide-react";

import { scenarioApi, getActiveScenarioId, getActiveDocName, autoInitializeActiveScenario } from "@/lib/api/scenarioApi";
import { ScenarioStatusBanner } from "@/components/layout/ScenarioStatusBanner";
import { GeneratingSimulationCard } from "@/components/layout/GeneratingSimulationCard";

function KnowledgeGraphContent({
  currentRound,
  simulationStatus,
  onInterrogateAgent,
}: {
  currentRound: number;
  simulationStatus: string;
  onInterrogateAgent: (agent: Agent) => void;
}) {
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [scenarioTitle, setScenarioTitle] = useState<string | null>(null);
  const [scenarioDesc, setScenarioDesc] = useState<string | null>(null);

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const syncAndLoadGraph = async (roundNum: number = 1) => {
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

      if (!doc || !activeId) {
        setActiveDoc(null);
        setScenarioTitle(null);
        setScenarioDesc(null);
        setNodes([]);
        setEdges([]);
        return;
      }

      const title = localStorage.getItem("SWARMLENS_ACTIVE_SCENARIO_NAME") || localStorage.getItem("LOKI_ACTIVE_SCENARIO_NAME");
      const desc = localStorage.getItem("SWARMLENS_ACTIVE_SCENARIO_DESC") || localStorage.getItem("LOKI_ACTIVE_SCENARIO_DESC");

      setActiveDoc(doc);
      setScenarioTitle(title || doc.replace(/\.[^/.]+$/, "") + " Scenario");
      setScenarioDesc(desc || "Strategy framework and risk vector analysis");

      setIsLoading(true);
      try {
        const graphData = await graphApi.getKnowledgeGraph(activeId, roundNum);
        setNodes(graphData.nodes || []);
        setEdges(graphData.edges || []);
      } catch (err) {
        console.warn("[KnowledgeGraphPage] Error fetching graph data:", err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    syncAndLoadGraph(currentRound);
    const handleDocUpdated = () => {
      setTimeout(() => {
        syncAndLoadGraph(currentRound);
      }, 50);
    };
    window.addEventListener("swarmlens_doc_updated", handleDocUpdated);
    window.addEventListener("scenario_changed", handleDocUpdated);
    return () => {
      window.removeEventListener("swarmlens_doc_updated", handleDocUpdated);
      window.removeEventListener("scenario_changed", handleDocUpdated);
    };
  }, [currentRound]);

  const riskNodesCount = nodes.filter(
    (n) => n.entityCategory === "Risk" || n.state === "ALERT" || n.label.toLowerCase().includes("risk")
  ).length;

  const isRunning = ["GENERATING_GRAPH", "RUNNING_BASELINE", "RUNNING_WHAT_IF", "RUNNING"].includes(simulationStatus);

  return (
    <div className="h-full flex flex-col space-y-4 max-w-7xl mx-auto select-none">
      <ScenarioStatusBanner onScenarioCompleted={() => syncAndLoadGraph(currentRound)} />
      {!activeDoc ? (
        <div className="flex-1 rounded-3xl border border-dashed border-line bg-surface p-12 flex flex-col items-center justify-center text-center space-y-5 my-auto">
          <div className="h-16 w-16 rounded-2xl bg-accent/10 border border-accent/30 text-accent flex items-center justify-center shadow-lg shadow-accent/10">
            <Network className="h-8 w-8" />
          </div>
          <div className="space-y-2 max-w-md">
            <h3 className="font-display text-xl font-extrabold text-ink">No Strategy Graph Extracted</h3>
            <p className="text-xs text-muted leading-relaxed font-body">
              Upload your strategy document (.PDF, .DOCX, .TXT) along with a scenario description to extract the GraphRAG entity network and relationship graph.
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
            <span>Upload Strategy Document</span>
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
          {/* Executive Strategy Info Banner */}
          <div className="rounded-card border border-line bg-surface p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg animate-in fade-in duration-200">
            <div className="flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shrink-0 shadow-md">
                <Network className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-sm font-bold text-ink">{scenarioTitle || "Extracted Strategy Graph"}</h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent font-semibold">
                    <Sparkles className="h-3 w-3" /> Grounded GraphRAG · Round {String(currentRound).padStart(2, "0")}
                  </span>
                </div>
                <p className="text-xs text-muted mt-0.5 line-clamp-1 max-w-2xl font-body">
                  {scenarioDesc} <span className="text-muted/60 font-mono">({activeDoc})</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono shrink-0 flex-wrap">
              <span className="px-3 py-1.5 rounded-xl bg-base border border-line text-ink font-semibold flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-accent" />
                Entities: <span className="text-accent font-bold">{nodes.length}</span>
              </span>

              <span className="px-3 py-1.5 rounded-xl bg-base border border-line text-ink font-semibold flex items-center gap-1.5">
                <Network className="h-3.5 w-3.5 text-emerald-500" />
                Relationships: <span className="text-emerald-500 font-bold">{edges.length}</span>
              </span>

              {riskNodesCount > 0 && (
                <span className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Risk Vectors: <span className="font-bold">{riskNodesCount}</span>
                </span>
              )}

              <button
                onClick={() => syncAndLoadGraph(currentRound)}
                disabled={isLoading}
                className="p-1.5 rounded-xl bg-raised border border-line text-muted hover:text-ink transition-all"
                title="Refresh Graph"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Main Graph Visualization Canvas */}
          <div className="flex-1 min-h-[600px]">
            <GraphCanvas
              nodes={nodes}
              edges={edges}
              onInterrogateAgent={onInterrogateAgent}
              title="STRATEGY KNOWLEDGE NETWORK"
              subtitle={`Entities & Relationships: AFFECTS, REGULATES, COMPETES_WITH, TARGETS (${activeDoc})`}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default function KnowledgeGraphPage() {
  return (
    <AppShell title="KNOWLEDGE GRAPH" subtitle="EXTRACTED STRATEGY ENTITIES & RELATIONSHIPS">
      {({ currentRound, simulationStatus, onInterrogateAgent }) => (
        <KnowledgeGraphContent currentRound={currentRound} simulationStatus={simulationStatus} onInterrogateAgent={onInterrogateAgent} />
      )}
    </AppShell>
  );
}
