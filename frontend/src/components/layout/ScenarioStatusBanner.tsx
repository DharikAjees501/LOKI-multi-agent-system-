"use client";

import React, { useEffect, useState } from "react";
import { Activity, Sparkles, RefreshCw, CheckCircle2 } from "lucide-react";
import { getActiveScenarioId, scenarioApi } from "@/lib/api/scenarioApi";

interface ScenarioStatusBannerProps {
  onScenarioCompleted?: () => void;
}

export function ScenarioStatusBanner({ onScenarioCompleted }: ScenarioStatusBannerProps) {
  const [status, setStatus] = useState<string>("READY");
  const [scenarioName, setScenarioName] = useState<string>("");
  const [activeId, setActiveId] = useState<string>("");

  const checkStatus = async () => {
    if (typeof window === "undefined") return;
    const currentId = getActiveScenarioId();
    setActiveId(currentId);
    if (!currentId) {
      setStatus("READY");
      return;
    }

    try {
      const scenarios = await scenarioApi.getScenarios();
      const currentScen = scenarios.find((s) => s.id === currentId);
      if (currentScen) {
        setScenarioName(currentScen.name);
        const prevStatus = status;
        const newStatus = currentScen.status || "READY";
        setStatus(newStatus);

        const isRunningPrev = prevStatus === "GENERATING_GRAPH" || prevStatus === "SIMULATING" || prevStatus.startsWith("RUNNING");
        const isDoneNew = ["COMPLETED", "BASELINE_COMPLETED", "WHAT_IF_COMPLETED", "READY", "CONFIGURED"].includes(newStatus);

        if (isRunningPrev && isDoneNew && onScenarioCompleted) {
          onScenarioCompleted();
        }
      }
    } catch (err) {
      console.warn("[ScenarioStatusBanner] Failed to check status:", err);
    }
  };

  useEffect(() => {
    checkStatus();

    const handleUpdate = () => {
      setTimeout(() => {
        checkStatus();
      }, 50);
    };

    window.addEventListener("scenario_changed", handleUpdate);
    window.addEventListener("swarmlens_doc_updated", handleUpdate);
    window.addEventListener("swarmlens_start_simulation", handleUpdate);

    return () => {
      window.removeEventListener("scenario_changed", handleUpdate);
      window.removeEventListener("swarmlens_doc_updated", handleUpdate);
      window.removeEventListener("swarmlens_start_simulation", handleUpdate);
    };
  }, []);

  // Poll only while actively running a simulation or graph generation
  useEffect(() => {
    const isRunning = status === "GENERATING_GRAPH" || status === "SIMULATING" || status.startsWith("RUNNING");
    if (!isRunning) return;

    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, [status]);

  const isPending = status === "GENERATING_GRAPH" || status === "SIMULATING" || status.startsWith("RUNNING");

  if (!isPending) {
    return null;
  }

  const getStatusLabel = () => {
    if (status === "GENERATING_GRAPH") {
      return "Extracting Grounded GraphRAG Entities & Generating 200 Heavy Agent Personas...";
    }
    if (status.includes("ROUND_")) {
      const match = status.match(/ROUND_(\d+)/);
      const rNum = match ? match[1] : "1";
      return `Executing 5-Round OASIS Swarm Simulation (Round 0${rNum} / 05)...`;
    }
    if (status === "RUNNING_BASELINE") {
      return "Executing Baseline 5-Round OASIS Swarm Simulation across 200 Personas...";
    }
    if (status === "RUNNING_WHAT_IF") {
      return "Executing Phase B What-If Shock Simulation across 200 Agents...";
    }
    return "Running Autonomous Swarm Simulation Pipeline...";
  };

  return (
    <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 shadow-lg backdrop-blur-md animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-accent text-white flex items-center justify-center shrink-0 shadow-md">
            <RefreshCw className="h-4 w-4 animate-spin" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-accent uppercase tracking-wider">
                SCENARIO PIPELINE RUNNING [{activeId}]
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/20 text-accent font-semibold">
                <Sparkles className="h-3 w-3" /> OASIS Swarm
              </span>
            </div>
            <p className="text-xs text-ink font-semibold mt-0.5">{getStatusLabel()}</p>
          </div>
        </div>

        <div className="w-full sm:w-48 space-y-1">
          <div className="h-2 w-full bg-base/80 rounded-full overflow-hidden border border-accent/20">
            <div className="h-full bg-accent animate-pulse w-3/4 rounded-full" />
          </div>
          <p className="text-[10px] font-mono text-muted text-right">Processing Round Data...</p>
        </div>
      </div>
    </div>
  );
}
