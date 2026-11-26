"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronDown,
  Volume2,
  Loader2,
} from "lucide-react";
import { ExecutiveReport } from "@/types";

interface ExecutiveBriefingPanelProps {
  report: ExecutiveReport;
  activeDoc: string;
}

const EDGE_TTS_VOICES = [
  { id: "en-US-ChristopherNeural", label: "Christopher", badge: "Executive Male" },
  { id: "en-US-JennyNeural", label: "Jenny", badge: "Executive Female" },
];

export const ExecutiveBriefingPanel: React.FC<ExecutiveBriefingPanelProps> = ({
  report,
  activeDoc,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("en-US-ChristopherNeural");
  const [progressSeconds, setProgressSeconds] = useState(0);
  const [duration, setDuration] = useState(60);

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Single unified continuous executive broadcast script synthesized by live LLM
  const scriptText = (
    report.audio_script ||
    (report as any).audioScript ||
    (report as any).audio_briefing_script ||
    (report as any).narration_script ||
    report.executiveSummary ||
    ""
  ).trim();

  // Clean script text for TTS engine
  const cleanScript = scriptText
    .replace(/[*_#`~\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Stop active audio completely
  const stopAudio = (resetTime: boolean = false) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      if (resetTime) {
        audioPlayerRef.current.currentTime = 0;
        audioPlayerRef.current.removeAttribute("src");
        audioPlayerRef.current.load();
        audioPlayerRef.current = null;
        setProgressSeconds(0);
      }
    }
    setIsPlaying(false);
    setIsAudioLoading(false);
  };

  // Play audio using Microsoft Edge TTS neural stream
  const playEdgeTTS = async (voiceOverride?: string) => {
    if (!cleanScript) return;

    stopAudio(true);
    const voiceToUse = voiceOverride || selectedVoice;
    setIsAudioLoading(true);

    try {
      const endpoints = [
        "/api/reports/tts",
        "http://127.0.0.1:8000/api/reports/tts",
        "http://localhost:8000/api/reports/tts",
      ];
      let response: Response | null = null;
      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: cleanScript,
              voice: voiceToUse,
              rate: "+3%",
              pitch: "+0Hz",
            }),
          });
          if (res.ok) {
            response = res;
            break;
          }
        } catch {
          // Try next endpoint
        }
      }

      if (!response || !response.ok) {
        throw new Error("Edge TTS endpoint returned non-200");
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;

      audio.onloadedmetadata = () => {
        if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
          setDuration(Math.round(audio.duration));
        }
      };

      audio.ontimeupdate = () => {
        if (audio && !isNaN(audio.currentTime)) {
          setProgressSeconds(Math.floor(audio.currentTime));
          if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
            setDuration(Math.round(audio.duration));
          }
        }
      };

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        audioPlayerRef.current = null;
        setIsPlaying(false);
        setIsAudioLoading(false);
        setProgressSeconds(0);
      };

      audio.onerror = (err) => {
        console.error("[EdgeTTS] Audio playback error:", err);
        URL.revokeObjectURL(audioUrl);
        audioPlayerRef.current = null;
        setIsPlaying(false);
        setIsAudioLoading(false);
      };

      await audio.play();
      setIsAudioLoading(false);
      setIsPlaying(true);
    } catch (err) {
      console.error("[EdgeTTS] Failed to stream Edge TTS audio:", err);
      setIsAudioLoading(false);
      setIsPlaying(false);
    }
  };

  const togglePlay = async () => {
    if (isPlaying) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      // Resume existing audio if paused
      if (audioPlayerRef.current && !audioPlayerRef.current.ended && audioPlayerRef.current.src) {
        try {
          await audioPlayerRef.current.play();
          setIsPlaying(true);
          return;
        } catch (e) {
          console.warn("[EdgeTTS] Resume failed, reloading stream:", e);
        }
      }
      // Start fresh playback with Edge TTS
      playEdgeTTS();
    }
  };

  const handleReset = () => {
    stopAudio(true);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio(true);
    };
  }, []);

  // Split narrative script into sentences for the live teleprompter
  const sentences: string[] = scriptText
    ? (scriptText.match(/[^.!?]+[.!?]+|\S+/g) || [scriptText])
    : [];
  const activeRatio = duration > 0 ? progressSeconds / duration : 0;
  const activeSentenceIdx = isPlaying
    ? Math.min(sentences.length - 1, Math.floor(activeRatio * sentences.length))
    : -1;

  return (
    <div className="rounded-3xl border border-line bg-surface p-6 space-y-6 shadow-2xl relative overflow-hidden select-none">
      {/* Decorative Glow */}
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-line pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center font-mono shadow-sm shrink-0">
            <Volume2 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-ink tracking-tight">
              60-Sec Executive Audio Briefing
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Edge TTS Neural Voice Selector */}
          <div className="relative flex items-center">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-base border border-line hover:border-accent/40 transition-colors shadow-sm">
              <span className="text-[11px] font-mono font-medium text-muted uppercase">Voice:</span>
              <select
                value={selectedVoice}
                onChange={(e) => {
                  const newVoice = e.target.value;
                  setSelectedVoice(newVoice);
                  if (isPlaying) {
                    playEdgeTTS(newVoice);
                  }
                }}
                className="appearance-none bg-transparent pr-5 text-xs font-mono font-semibold text-ink focus:outline-none cursor-pointer"
              >
                {EDGE_TTS_VOICES.map((v) => (
                  <option key={v.id} value={v.id} className="bg-surface text-ink">
                    {v.label} ({v.badge})
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-muted pointer-events-none absolute right-3" />
            </div>
          </div>
        </div>
      </div>

      {/* Audio Player Controls & Waveform Bar */}
      <div className="p-4 rounded-2xl bg-base border border-line space-y-3 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              disabled={isAudioLoading}
              className={`h-11 w-11 rounded-2xl flex items-center justify-center font-semibold text-white shadow-lg transition-all ${
                isPlaying ? "bg-accent2 shadow-accent2/25" : "bg-accent shadow-accent/25 hover:opacity-90"
              } ${isAudioLoading ? "opacity-75 cursor-not-allowed" : ""}`}
              title={isPlaying ? "Pause Briefing" : "Play Executive Briefing"}
            >
              {isAudioLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="h-5 w-5 fill-current ml-0.5" />
              )}
            </button>
            <button
              onClick={handleReset}
              className="p-2.5 rounded-xl bg-raised border border-line text-muted hover:text-ink transition-all"
              title="Reset Briefing"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          {/* Animated Waveform Visualizer */}
          <div className="flex items-center gap-1.5 h-6 px-3 rounded-xl bg-surface border border-line">
            {[40, 75, 100, 60, 90, 45, 80, 50, 95, 30].map((h, i) => (
              <span
                key={i}
                className={`w-1 rounded-full transition-all duration-300 ${
                  isPlaying ? "bg-accent animate-pulse" : "bg-muted/40"
                }`}
                style={{
                  height: isPlaying ? `${Math.max(20, (h * ((progressSeconds % 5) + 1)) / 5)}%` : "30%",
                }}
              />
            ))}
          </div>

          <div className="font-mono text-xs font-bold text-ink">
            {formatTime(progressSeconds)} <span className="text-muted text-[10px]">/ {formatTime(duration)}</span>
          </div>
        </div>

        {/* Timeline Scrubber Bar */}
        <div className="h-2 w-full bg-raised rounded-full overflow-hidden border border-line">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, (progressSeconds / Math.max(1, duration)) * 100)}%` }}
          />
        </div>
      </div>

      {/* Teleprompter Transcript Box with Real-Time Active Sentence Highlighting */}
      <div className="p-3.5 rounded-2xl bg-base border border-line space-y-2 relative z-10 font-mono text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted font-bold uppercase flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${isPlaying ? "bg-accent animate-ping" : "bg-muted"}`} />
            LIVE TELEPROMPTER TRANSCRIPT
          </span>
          {isPlaying && (
            <span className="text-[9px] font-mono font-bold text-accent px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30 animate-pulse">
              LIVE NARRATION ACTIVE
            </span>
          )}
        </div>
        <div className="p-3.5 rounded-xl bg-surface/60 border border-line/50 leading-relaxed text-xs max-h-48 overflow-y-auto">
          {scriptText && sentences.length > 0 ? (
            <p className="space-x-1.5">
              {sentences.map((sent: string, sIdx: number) => {
                const isCurrent = isPlaying && sIdx === activeSentenceIdx;
                const isPast = isPlaying && sIdx < activeSentenceIdx;
                return (
                  <span
                    key={sIdx}
                    className={`transition-all duration-300 ${
                      isCurrent
                        ? "bg-accent/20 text-accent font-bold px-1.5 py-0.5 rounded shadow-sm inline-block"
                        : isPast
                        ? "text-ink/60"
                        : "text-ink/90"
                    }`}
                  >
                    {sent.trim()}{" "}
                  </span>
                );
              })}
            </p>
          ) : (
            <p className="text-muted italic">Executive audio script generating from simulation telemetry...</p>
          )}
        </div>
      </div>
    </div>
  );
};
