"use client";

import React from "react";
import Link from "next/link";
import { Activity, Loader2, Play, ArrowRight } from "lucide-react";

interface GeneratingSimulationCardProps {
  currentRound: number;
  simulationStatus: string;
  onForceComplete?: () => void;
}

export const GeneratingSimulationCard: React.FC<GeneratingSimulationCardProps> = ({
  currentRound,
  simulationStatus,
  onForceComplete,
}) => {
  const roundNum = Math.min(5, Math.max(1, currentRound || 1));
  const progressPercentage = Math.min(100, Math.round((roundNum / 5) * 100));

  return (
    <div className="rounded-3xl border border-line bg-surface p-10 flex flex-col items-center justify-center text-center space-y-6 my-8 shadow-2xl relative overflow-hidden select-none animate-in fade-in duration-300">
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

      <div className="h-16 w-16 rounded-2xl bg-accent/10 border border-accent/30 text-accent flex items-center justify-center shadow-lg shadow-accent/10">
        <Activity className="h-8 w-8 animate-pulse" />
      </div>

      <div className="space-y-3 max-w-xl">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono text-[11px] font-bold">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> SIMULATION IN PROGRESS · ROUND 0{roundNum} / 05 ({progressPercentage}%)
        </div>
        <h3 className="font-display text-xl md:text-2xl font-extrabold text-ink pt-1 leading-snug">
          Generating Simulation: Rounds 1 to 5 are currently in progress. Please wait until the autonomous swarm deliberation and Stage 4 synthesis complete...
        </h3>
        <p className="text-xs text-muted leading-relaxed font-body">
          Executing multi-agent consensus vectors across 200 autonomous agent nodes. Live telemetry, risk synthesis, feed events, and executive briefing decks generate dynamically upon completion.
        </p>
      </div>

      {/* Progress Bar Indicator */}
      <div className="w-full max-w-md space-y-1.5 font-mono text-xs">
        <div className="flex justify-between text-[11px]">
          <span className="text-muted">Deliberation Progress</span>
          <span className="text-accent font-bold">Round 0{roundNum} / 05 ({progressPercentage}%)</span>
        </div>
        <div className="h-3 w-full bg-raised rounded-full overflow-hidden border border-line p-0.5">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Link
          href="/simulation"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-accent text-white text-xs font-semibold hover:opacity-90 transition-all shadow-md shadow-accent/20"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>Open Simulation Workspace</span>
        </Link>

        {onForceComplete && (
          <button
            onClick={onForceComplete}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-raised border border-line text-ink text-xs font-semibold hover:bg-line transition-all"
          >
            <span>Bypass & View Available Real Telemetry</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};
