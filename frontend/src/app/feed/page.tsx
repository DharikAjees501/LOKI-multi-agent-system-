"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { LiveFeedPanel } from "@/components/feed/LiveFeedPanel";
import { Rss, FileUp } from "lucide-react";

import { getActiveDocName, autoInitializeActiveScenario } from "@/lib/api/scenarioApi";
import { ScenarioStatusBanner } from "@/components/layout/ScenarioStatusBanner";
import { GeneratingSimulationCard } from "@/components/layout/GeneratingSimulationCard";

export default function LiveFeedPage() {
  const [activeDoc, setActiveDoc] = useState<string | null>(null);

  const syncDoc = async () => {
    if (typeof window !== "undefined") {
      let doc = getActiveDocName();
      if (!doc || doc === "No document loaded") {
        if (localStorage.getItem("SWARMLENS_MANUALLY_CLEARED") !== "true") {
          const initialized = await autoInitializeActiveScenario();
          if (initialized) {
            doc = initialized.documentName;
          }
        }
      }
      setActiveDoc(doc);
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

  return (
    <AppShell title="LIVE SWARM FEED" subtitle="REAL-TIME MULTI-AGENT CHANNEL ACTIVITY">
      {({ currentRound, simulationStatus, onInterrogateAgent }) => {
        const isRunning = ["GENERATING_GRAPH", "RUNNING_BASELINE", "RUNNING_WHAT_IF", "RUNNING"].includes(simulationStatus);
        return (
          <div className="h-full max-w-6xl mx-auto select-none space-y-4">
            <ScenarioStatusBanner onScenarioCompleted={syncDoc} />
            {!activeDoc ? (
              <div className="rounded-3xl border border-dashed border-line bg-surface p-12 flex flex-col items-center justify-center text-center space-y-5 my-12">
                <div className="h-16 w-16 rounded-2xl bg-accent/10 border border-accent/30 text-accent flex items-center justify-center shadow-lg shadow-accent/10">
                  <Rss className="h-8 w-8" />
                </div>
                <div className="space-y-2 max-w-md">
                  <h3 className="font-display text-xl font-extrabold text-ink">No Active Swarm Feed Stream</h3>
                  <p className="text-xs text-muted leading-relaxed font-body">
                    Upload your strategy memo, pricing document, or policy file (.PDF, .DOCX, .TXT) to stream real-time agent dialogues across Executive Boardroom, Media, and Public channels.
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
                  <span>Upload PDF & Start Stream</span>
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
              <LiveFeedPanel onInterrogateAgent={onInterrogateAgent} fullScreen />
            )}
          </div>
        );
      }}
    </AppShell>
  );
}
