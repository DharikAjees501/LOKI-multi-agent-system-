"use client";

import React from "react";
import { Play, Pause, SkipBack, SkipForward, Clock } from "lucide-react";

interface TimelineScrubberProps {
  currentRound: number;
  totalRounds: number;
  simulationStatus: "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED";
  onSelectRound: (round: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  currentRound,
  totalRounds,
  simulationStatus,
  onSelectRound,
  onPlay,
  onPause,
  onStepForward,
  onStepBackward,
}) => {
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1);

  return (
    <div className="bg-surface/90 backdrop-blur-xl border border-line/80 shadow-md shadow-orange-950/5 rounded-full px-6 py-2.5 flex items-center gap-5 select-none min-w-[360px] sm:min-w-[480px] max-w-xl transition-all duration-300 mx-auto" suppressHydrationWarning>
      {/* Compact Controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          disabled={currentRound <= 1}
          onClick={onStepBackward}
          className="h-8 w-8 rounded-full bg-white/80 border border-line/60 flex items-center justify-center text-muted hover:text-ink hover:bg-white transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
          title={currentRound <= 1 ? "Already at Round 1" : "Step Backward"}
        >
          <SkipBack className="h-3.5 w-3.5" />
        </button>

        {simulationStatus === "RUNNING" ? (
          <button
            onClick={onPause}
            className="h-9 w-9 rounded-full bg-accent2 text-white flex items-center justify-center hover:opacity-90 transition-all shadow-md shadow-accent2/30"
            title="Pause Simulation"
          >
            <Pause className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button
            disabled={currentRound >= totalRounds && simulationStatus === "COMPLETED"}
            onClick={onPlay}
            className="h-9 w-9 rounded-full bg-accent text-white flex items-center justify-center hover:opacity-90 transition-all shadow-md shadow-accent/30 disabled:opacity-40 disabled:cursor-not-allowed"
            title={currentRound >= totalRounds ? "Simulation Completed" : "Play Simulation"}
          >
            <Play className="h-4 w-4 fill-current ml-0.5" />
          </button>
        )}

        <button
          disabled={currentRound >= totalRounds}
          onClick={onStepForward}
          className="h-8 w-8 rounded-full bg-white/80 border border-line/60 flex items-center justify-center text-muted hover:text-ink hover:bg-white transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
          title={currentRound >= totalRounds ? "Final Round Reached" : "Step Forward & Execute Next Round"}
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Vertical Divider */}
      <div className="h-6 w-[1px] bg-line/80 shrink-0" />

      {/* Timeline Scrubber Track */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div className="flex items-center justify-between text-[11px] font-mono text-muted">
          <span className="flex items-center gap-1.5 font-bold text-accent truncate" suppressHydrationWarning>
            <Clock className="h-3.5 w-3.5 shrink-0" /> ROUND {String(currentRound).padStart(2, "0")} / {String(totalRounds).padStart(2, "0")}
          </span>
          <span className="text-[10px] text-muted/80 uppercase font-bold tracking-wider hidden sm:inline">
            TIMELINE
          </span>
        </div>

        <div className="relative flex items-center justify-between py-1">
          {/* Background Track Line */}
          <div className="absolute left-2 right-2 h-1 bg-black/5 rounded-full top-1/2 -translate-y-1/2 z-0" />
          {/* Active Progress Line */}
          <div
            className="absolute left-2 h-1 bg-accent rounded-full top-1/2 -translate-y-1/2 z-0 transition-all duration-300"
            style={{
              width: `calc(${((currentRound - 1) / (totalRounds - 1)) * 100}% - 4px)`,
            }}
          />

          {/* Compact Round Nodes */}
          {rounds.map((round) => {
            const isActive = round === currentRound;
            const isPassed = round <= currentRound;
            const isLocked = round > currentRound;

            return (
              <button
                key={round}
                disabled={isLocked}
                onClick={() => {
                  if (!isLocked) onSelectRound(round);
                }}
                className={`relative z-10 flex flex-col items-center group focus:outline-none ${
                  isLocked ? "cursor-not-allowed opacity-40" : "cursor-pointer"
                }`}
                title={
                  isLocked
                    ? `Round ${round} Locked (Execute Round ${round - 1} first)`
                    : `Switch to Round ${round}`
                }
              >
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center font-mono text-[10px] font-bold transition-all border ${
                    isActive
                      ? "bg-accent border-white text-white shadow-md shadow-accent/40 scale-110"
                      : isPassed
                      ? "bg-white border-accent text-accent shadow-xs hover:scale-105"
                      : "bg-raised border-line text-muted/50"
                  }`}
                >
                  {round}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
