"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { Header } from "@/components/layout/Header";
import { DocumentUploadModal } from "@/components/upload/DocumentUploadModal";
import { AgentInterrogationModal } from "@/components/interrogation/AgentInterrogationModal";
import { ApiKeyGateModal } from "@/components/auth/ApiKeyGateModal";
import { NewUserOnboarding } from "@/components/onboarding/NewUserOnboarding";
import { keyService } from "@/lib/api/keyService";
import { Agent } from "@/types";
import { autoInitializeActiveScenario, getActiveScenarioId, scenarioApi } from "@/lib/api/scenarioApi";

interface AppShellProps {
  title: string;
  subtitle?: string;
  children: (props: {
    currentRound: number;
    simulationStatus: "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED";
    onInterrogateAgent: (agent: Agent) => void;
  }) => React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ title, subtitle, children }) => {
  const [mounted, setMounted] = useState(false);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const totalRounds = 5;
  const [simulationStatus, setSimulationStatus] = useState<"IDLE" | "RUNNING" | "PAUSED" | "COMPLETED">("IDLE");

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  // API Key Gate state
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTimeout(() => {
      autoInitializeActiveScenario();
    }, 0);
    if (typeof window !== "undefined") {
      const savedRound = localStorage.getItem("LOKI_CURRENT_ROUND") || localStorage.getItem("SWARMLENS_CURRENT_ROUND");
      if (savedRound) {
        const val = parseInt(savedRound, 10);
        if (!isNaN(val) && val >= 1 && val <= 5) {
          setCurrentRound(val);
        }
      }
      const savedStatus = localStorage.getItem("LOKI_SIM_STATUS") || localStorage.getItem("SWARMLENS_SIM_STATUS");
      if (savedStatus && ["IDLE", "RUNNING", "PAUSED", "COMPLETED"].includes(savedStatus)) {
        setSimulationStatus(savedStatus as any);
      }
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (typeof window !== "undefined") {
      localStorage.setItem("LOKI_CURRENT_ROUND", String(currentRound));
      localStorage.setItem("LOKI_SIM_STATUS", simulationStatus);
      localStorage.setItem("SWARMLENS_CURRENT_ROUND", String(currentRound));
      localStorage.setItem("SWARMLENS_SIM_STATUS", simulationStatus);
    }
  }, [currentRound, simulationStatus, mounted]);

  useEffect(() => {
    const handleOpenUpload = () => setIsUploadOpen(true);
    const handleOpenKeyModal = () => setIsKeyModalOpen(true);
    const handleDocUpdated = () => {
      if (typeof window !== "undefined") {
        const savedDoc = localStorage.getItem("SWARMLENS_ACTIVE_DOC_NAME") || localStorage.getItem("LOKI_ACTIVE_DOC_NAME");
        if (!savedDoc || savedDoc === "No document loaded" || localStorage.getItem("SWARMLENS_MANUALLY_CLEARED") === "true") {
          setCurrentRound(1);
          setSimulationStatus("IDLE");
          localStorage.setItem("LOKI_CURRENT_ROUND", "1");
          localStorage.setItem("LOKI_SIM_STATUS", "IDLE");
          localStorage.setItem("SWARMLENS_CURRENT_ROUND", "1");
          localStorage.setItem("SWARMLENS_SIM_STATUS", "IDLE");
          return;
        }

        const savedStatus = localStorage.getItem("SWARMLENS_SIM_STATUS") || localStorage.getItem("LOKI_SIM_STATUS");
        const savedRound = localStorage.getItem("SWARMLENS_CURRENT_ROUND") || localStorage.getItem("LOKI_CURRENT_ROUND");
        if (savedStatus === "COMPLETED" || (savedRound && parseInt(savedRound, 10) >= 5)) {
          setCurrentRound(5);
          setSimulationStatus("COMPLETED");
          return;
        }
        if (savedStatus === "RUNNING") {
          setSimulationStatus("RUNNING");
          if (savedRound) setCurrentRound(parseInt(savedRound, 10));
          return;
        }
      }
      setCurrentRound(1);
      setSimulationStatus("IDLE");
    };

    const handleStartSimulationEvent = () => {
      setCurrentRound(1);
      setSimulationStatus("RUNNING");
      if (typeof window !== "undefined") {
        localStorage.setItem("LOKI_CURRENT_ROUND", "1");
        localStorage.setItem("LOKI_SIM_STATUS", "RUNNING");
        localStorage.setItem("SWARMLENS_CURRENT_ROUND", "1");
        localStorage.setItem("SWARMLENS_SIM_STATUS", "RUNNING");
      }
    };

    const handleForceComplete = () => {
      setCurrentRound(totalRounds);
      setSimulationStatus("COMPLETED");
      if (typeof window !== "undefined") {
        localStorage.setItem("LOKI_CURRENT_ROUND", totalRounds.toString());
        localStorage.setItem("LOKI_SIM_STATUS", "COMPLETED");
        localStorage.setItem("SWARMLENS_CURRENT_ROUND", totalRounds.toString());
        localStorage.setItem("SWARMLENS_SIM_STATUS", "COMPLETED");
        setTimeout(() => {
          window.dispatchEvent(new Event("simulation_completed"));
          window.dispatchEvent(new Event("scenario_changed"));
        }, 0);
      }
    };

    window.addEventListener("loki_quota_exceeded", handleOpenKeyModal);
    window.addEventListener("loki_open_keys", handleOpenKeyModal);
    window.addEventListener("loki_open_upload", handleOpenUpload);
    window.addEventListener("swarmlens_open_upload", handleOpenUpload);
    window.addEventListener("loki_doc_updated", handleDocUpdated);
    window.addEventListener("swarmlens_doc_updated", handleDocUpdated);
    window.addEventListener("loki_start_simulation", handleStartSimulationEvent);
    window.addEventListener("swarmlens_start_simulation", handleStartSimulationEvent);
    window.addEventListener("swarmlens_force_complete", handleForceComplete);
    return () => {
      window.removeEventListener("loki_quota_exceeded", handleOpenKeyModal);
      window.removeEventListener("loki_open_keys", handleOpenKeyModal);
      window.removeEventListener("loki_open_upload", handleOpenUpload);
      window.removeEventListener("swarmlens_open_upload", handleOpenUpload);
      window.removeEventListener("loki_doc_updated", handleDocUpdated);
      window.removeEventListener("swarmlens_doc_updated", handleDocUpdated);
      window.removeEventListener("loki_start_simulation", handleStartSimulationEvent);
      window.removeEventListener("swarmlens_start_simulation", handleStartSimulationEvent);
      window.removeEventListener("swarmlens_force_complete", handleForceComplete);
    };
  }, [totalRounds]);

  // Progressive simulation round sync with real backend execution
  useEffect(() => {
    let interval: any = null;

    const syncWithBackend = async () => {
      try {
        const currentId = getActiveScenarioId();
        if (!currentId) return;

        const scens = await scenarioApi.getScenarios();
        const currentScen = scens.find((s: any) => s.id === currentId);
        if (!currentScen) return;

        const st = (currentScen.status || "").trim();
        const isRunning = st === "GENERATING_GRAPH" || st === "SIMULATING" || st.startsWith("RUNNING");

        if (st.includes("ROUND_")) {
          const match = st.match(/ROUND_(\d+)/);
          if (match) {
            const rNum = parseInt(match[1], 10);
            if (!isNaN(rNum) && rNum >= 1 && rNum <= 5) {
              setCurrentRound(rNum);
              setSimulationStatus("RUNNING");
              if (typeof window !== "undefined") {
                localStorage.setItem("SWARMLENS_CURRENT_ROUND", rNum.toString());
                localStorage.setItem("LOKI_CURRENT_ROUND", rNum.toString());
                localStorage.setItem("SWARMLENS_SIM_STATUS", "RUNNING");
                localStorage.setItem("LOKI_SIM_STATUS", "RUNNING");
              }
            }
          }
        } else if (isRunning) {
          setSimulationStatus("RUNNING");
          if (typeof window !== "undefined") {
            localStorage.setItem("SWARMLENS_SIM_STATUS", "RUNNING");
            localStorage.setItem("LOKI_SIM_STATUS", "RUNNING");
          }
        }

        if (["COMPLETED", "BASELINE_COMPLETED", "WHAT_IF_COMPLETED"].includes(st)) {
          setCurrentRound(totalRounds);
          const wasCompleted = typeof window !== "undefined" && localStorage.getItem("SWARMLENS_SIM_STATUS") === "COMPLETED";
          setSimulationStatus("COMPLETED");
          if (typeof window !== "undefined") {
            localStorage.setItem("LOKI_CURRENT_ROUND", totalRounds.toString());
            localStorage.setItem("LOKI_SIM_STATUS", "COMPLETED");
            localStorage.setItem("SWARMLENS_CURRENT_ROUND", totalRounds.toString());
            localStorage.setItem("SWARMLENS_SIM_STATUS", "COMPLETED");
            // Only fire the completion event ONCE!
            if (!wasCompleted) {
              window.dispatchEvent(new Event("simulation_completed"));
              window.dispatchEvent(new Event("scenario_changed"));
            }
          }
          // Stop polling once finished!
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
        } else if (st === "FAILED" || st === "READY" || st === "CONFIGURED") {
          setSimulationStatus("IDLE");
          if (typeof window !== "undefined") {
            localStorage.setItem("SWARMLENS_SIM_STATUS", "IDLE");
            localStorage.setItem("LOKI_SIM_STATUS", "IDLE");
          }
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
        }
      } catch (err) {
        console.warn("[AppShell] Simulation status polling notice:", err);
      }
    };

    syncWithBackend().then(() => {
      // Start polling only if running
      const currentStatus = typeof window !== "undefined" ? localStorage.getItem("SWARMLENS_SIM_STATUS") : null;
      if (currentStatus === "RUNNING") {
        interval = setInterval(syncWithBackend, 2500);
      }
    });

    const handleSimulationTrigger = () => {
      if (interval) clearInterval(interval);
      syncWithBackend();
      interval = setInterval(syncWithBackend, 2500);
    };

    window.addEventListener("swarmlens_start_simulation", handleSimulationTrigger);
    window.addEventListener("loki_start_simulation", handleSimulationTrigger);

    return () => {
      if (interval) clearInterval(interval);
      window.removeEventListener("swarmlens_start_simulation", handleSimulationTrigger);
      window.removeEventListener("loki_start_simulation", handleSimulationTrigger);
    };
  }, [totalRounds]);

  const hasUploadedDoc = () => {
    if (typeof window === "undefined") return false;
    if (localStorage.getItem("SWARMLENS_MANUALLY_CLEARED") === "true") return false;
    const doc = localStorage.getItem("SWARMLENS_ACTIVE_DOC_NAME");
    return Boolean(doc && doc.trim().length > 0 && doc !== "No document loaded");
  };

  const handlePlay = () => {
    if (!hasUploadedDoc()) {
      setIsUploadOpen(true);
      return;
    }
    if (simulationStatus === "COMPLETED" || currentRound >= totalRounds) {
      setCurrentRound(1);
    }
    setSimulationStatus("RUNNING");
    if (typeof window !== "undefined") {
      localStorage.setItem("LOKI_SIM_STATUS", "RUNNING");
      localStorage.setItem("SWARMLENS_SIM_STATUS", "RUNNING");
      window.dispatchEvent(new Event("swarmlens_start_simulation"));
      window.dispatchEvent(new Event("loki_start_simulation"));
    }
  };

  const handlePause = () => setSimulationStatus("PAUSED");

  const handleStep = () => {
    if (!hasUploadedDoc()) {
      setIsUploadOpen(true);
      return;
    }
    setCurrentRound((prev) => Math.min(totalRounds, prev + 1));
  };

  const handleReset = () => {
    setCurrentRound(1);
    setSimulationStatus("IDLE");
  };

  const handleInterrogate = (agent: Agent) => {
    setSelectedAgent(agent);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-base text-ink font-body relative">
      {/* Left Sidebar */}
      <Sidebar
        currentRound={currentRound}
        totalRounds={totalRounds}
        simulationStatus={simulationStatus}
        onPlay={handlePlay}
        onPause={handlePause}
        onStep={handleStep}
        onReset={handleReset}
        onOpenUpload={() => setIsUploadOpen(true)}
      />

      {/* Central + Right Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <Header
          title={title}
          subtitle={subtitle}
          currentRound={currentRound}
          totalRounds={totalRounds}
          activeAgentsCount={200}
          onOpenUpload={() => setIsUploadOpen(true)}
        />

        {/* Main Work Area */}
        <main className="flex-1 overflow-y-auto p-6 bg-base">
          <NewUserOnboarding
            onOpenKeyModal={() => setIsKeyModalOpen(true)}
            onOpenUploadModal={() => setIsUploadOpen(true)}
          />
          {children({
            currentRound,
            simulationStatus,
            onInterrogateAgent: handleInterrogate,
          })}
        </main>
      </div>

      {/* API Key Modal on Quota Exceeded or Manual Open */}
      <ApiKeyGateModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        isRequired={false}
        onKeySubmitted={() => setIsKeyModalOpen(false)}
      />

      {/* Document Ingestion Modal */}
      <DocumentUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onComplete={(docName) => console.log("Loaded document:", docName)}
      />

      {/* Agent Interrogation Chat Drawer */}
      <AgentInterrogationModal
        agent={selectedAgent}
        isOpen={!!selectedAgent}
        onClose={() => setSelectedAgent(null)}
      />
    </div>
  );
};
