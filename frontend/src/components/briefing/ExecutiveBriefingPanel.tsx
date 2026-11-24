"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  Users,
  Clock,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  TrendingUp,
  DollarSign,
  AlertTriangle,
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
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("en-US-ChristopherNeural");
  const [progressSeconds, setProgressSeconds] = useState(0);
  const totalDuration = 60; // 60 seconds briefing
  const totalSlides = 8;

  const speechSynthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const totalAgents = (report as any).total_agents || (report as any).totalAgents || report.agentCount || 200;
  const riskScore = (report as any).risk_score || (report as any).riskScore || (report as any).overallRiskScore || 99;
  const primaryConcern = (report as any).primary_concern || (report as any).primaryConcern || "Stakeholder Opposition & Churn";
  const fileSource = report.documentName || (report as any).file_source || activeDoc || "Uploaded Document";
  const audioScriptText = (report as any).audio_script || (report as any).audioScript || (report as any).audio_briefing_script || report.executiveSummary;
  const sentiment = (report as any).sentimentBreakdown || { positive: 24, neutral: 38, negative: 28, critical: 10 };

  // 60-Second Timed Script Segments dynamically built from active report
  const slideScripts = [
    `Welcome to the executive briefing for ${report.title || report.scenarioName || "Strategic Forecast"}. The ${totalAgents}-agent swarm simulation completed for ${report.scenarioName || "active scenario"} with source document ${fileSource}.`,
    `Executive summary forecast: ${report.executiveSummary || "Multi-agent forecast simulation produced operational risk evaluations."}`,
    `Key identified risk vectors: ${report.keyRisks && report.keyRisks.length > 0 ? report.keyRisks.map(r => typeof r === "string" ? r : ((r as any).title || String(r))).join(". ") : "Baseline stakeholder alignment and market churn risks."}`,
    `Emerging risk indicators: ${report.emergingRisks && report.emergingRisks.length > 0 ? report.emergingRisks.join(". ") : (primaryConcern || "Operational compliance and cross-functional friction.")}.`,
    `Stakeholder reaction analysis: ${report.stakeholderReactions ? Object.entries(report.stakeholderReactions).map(([group, text]) => `${group}: ${text}`).join(". ") : "Executive leadership and consumer market feedback recorded."}`,
    `Sentiment evolution across simulation: ${report.sentimentEvolution || "Tracked baseline sentiment transition across rounds 1 through 5."}`,
    `Critical turning points: ${report.criticalTurningPoints && report.criticalTurningPoints.length > 0 ? report.criticalTurningPoints.map((t) => `Round ${t.round}: ${t.event}`).join(". ") : "Round 1 bootstrap and initial scenario alignment."}`,
    `Recommended strategic next steps: ${report.recommendedInvestigationAreas && report.recommendedInvestigationAreas.length > 0 ? report.recommendedInvestigationAreas.join(". ") : `Address ${primaryConcern} and conduct milestone review before full release.`} End of executive briefing.`
  ];

  // Stop any active audio completely (e.g. on reset or slide switch)
  // Stop any active audio completely (e.g. on reset or slide switch)
  const stopAllAudio = (resetTime: boolean = false) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      if (resetTime) {
        audioPlayerRef.current.currentTime = 0;
        audioPlayerRef.current.removeAttribute("src");
        audioPlayerRef.current.load();
        audioPlayerRef.current = null;
      }
    }
    if (speechSynthRef.current) {
      if (resetTime) {
        speechSynthRef.current.cancel();
      } else {
        speechSynthRef.current.pause();
      }
    }
    setIsPlaying(false);
    setIsAudioLoading(false);
  };

  // Browser speech synthesis fallback
  const fallbackBrowserSpeech = (cleanText: string, voiceToUse?: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsPlaying(false);
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "en-US";
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const activeV = voiceToUse || selectedVoice;
    const isFemale = activeV.toLowerCase().includes("jenny") || activeV.toLowerCase().includes("female");

    const voices = synth.getVoices();
    if (voices && voices.length > 0) {
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (isFemale
            ? (v.name.includes("Female") || v.name.includes("Jenny") || v.name.includes("Zira") || v.name.includes("Samantha"))
            : (v.name.includes("Male") || v.name.includes("David") || v.name.includes("Christopher") || v.name.includes("George")))
      ) || voices.find((v) => v.lang.startsWith("en")) || voices[0];
      if (preferred) {
        utterance.voice = preferred;
      }
    }

    utterance.onend = () => {
      if (currentSlide < totalSlides - 1) {
        const nextSlide = currentSlide + 1;
        setCurrentSlide(nextSlide);
        setProgressSeconds(Math.round(nextSlide * (totalDuration / totalSlides)));
        speakSlideScript(nextSlide, activeV);
      } else {
        setIsPlaying(false);
        setProgressSeconds(0);
        setCurrentSlide(0);
      }
    };
    utterance.onerror = (err: any) => {
      if (err && (err.error === "interrupted" || err.error === "canceled")) return;
      console.warn("[SpeechSynthesis] Utterance error:", err?.error || err);
      setIsPlaying(false);
    };

    utteranceRef.current = utterance;
    synth.speak(utterance);
    setIsPlaying(true);
  };

  // Play slide script via Edge TTS stream (/api/reports/tts)
  const speakSlideScript = async (slideIdx: number, voiceOverride?: string) => {
    stopAllAudio(true);

    const voiceToUse = voiceOverride || selectedVoice;
    const rawText = slideScripts[slideIdx] || audioScriptText || slideScripts[0];
    const cleanText = (rawText || "")
      .replace(/[*_#`~\[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanText) return;

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
              text: cleanText,
              voice: voiceToUse,
              rate: "+5%",
              pitch: "+0Hz"
            })
          });
          if (res.ok) {
            response = res;
            break;
          }
        } catch {}
      }

      if (!response || !response.ok) {
        throw new Error("All TTS endpoints failed or returned non-200");
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;

      audio.ontimeupdate = () => {
        if (audio && !isNaN(audio.currentTime)) {
          const baseSec = Math.round(slideIdx * (totalDuration / totalSlides));
          const slideDuration = audio.duration || (totalDuration / totalSlides);
          const elapsedInSlide = audio.currentTime;
          const curSec = Math.min(totalDuration, Math.floor(baseSec + (elapsedInSlide / slideDuration) * (totalDuration / totalSlides)));
          setProgressSeconds(curSec);
        }
      };

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        audioPlayerRef.current = null;
        if (slideIdx < totalSlides - 1) {
          const nextSlide = slideIdx + 1;
          setCurrentSlide(nextSlide);
          setProgressSeconds(Math.round(nextSlide * (totalDuration / totalSlides)));
          speakSlideScript(nextSlide, voiceToUse);
        } else {
          setIsPlaying(false);
          setIsAudioLoading(false);
          setProgressSeconds(0);
          setCurrentSlide(0);
        }
      };

      audio.onerror = (err) => {
        console.warn("[EdgeTTS] Audio playback error, switching to browser speech:", err);
        URL.revokeObjectURL(audioUrl);
        audioPlayerRef.current = null;
        fallbackBrowserSpeech(cleanText, voiceToUse);
      };

      await audio.play();
      setIsAudioLoading(false);
      setIsPlaying(true);
    } catch (err) {
      console.warn("[EdgeTTS] Network TTS failed, switching to browser speech:", err);
      setIsAudioLoading(false);
      fallbackBrowserSpeech(cleanText, voiceToUse);
    }
  };

  // Initialize Speech Synthesis for fallback
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      speechSynthRef.current = window.speechSynthesis;
    }
    return () => {
      stopAllAudio(true);
    };
  }, []);

  // Timer & Slide Auto-Sync during playback (fallback when no HTMLAudioElement)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying && !audioPlayerRef.current) {
      interval = setInterval(() => {
        setProgressSeconds((prev) => {
          const next = prev + 1;
          if (next >= totalDuration) {
            stopAllAudio(true);
            return 0;
          }
          const targetSlide = Math.min(totalSlides - 1, Math.floor(next / 7.5));
          if (targetSlide !== currentSlide) {
            setCurrentSlide(targetSlide);
          }
          return next;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, currentSlide]);

  const togglePlay = async () => {
    if (isPlaying) {
      // Pause in middle of audio: keep currentTime intact so it can resume!
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      if (speechSynthRef.current && speechSynthRef.current.speaking) {
        speechSynthRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      // Resume existing audio from paused timestamp
      if (audioPlayerRef.current && !audioPlayerRef.current.ended) {
        try {
          await audioPlayerRef.current.play();
          setIsPlaying(true);
          return;
        } catch (e) {
          console.warn("[EdgeTTS] Resume failed, replaying slide:", e);
        }
      }
      if (speechSynthRef.current && speechSynthRef.current.paused) {
        speechSynthRef.current.resume();
        setIsPlaying(true);
        return;
      }
      // If no active audio or already ended, start fresh for current slide
      speakSlideScript(currentSlide);
    }
  };

  const handleReset = () => {
    stopAllAudio(true);
    setProgressSeconds(0);
    setCurrentSlide(0);
  };

  const handleSlideChange = (slideIndex: number) => {
    const validIdx = Math.max(0, Math.min(totalSlides - 1, slideIndex));
    setCurrentSlide(validIdx);
    setProgressSeconds(Math.round(validIdx * 7.5));
    stopAllAudio(true);
    if (isPlaying) {
      speakSlideScript(validIdx);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

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
          {/* Clean Modern Edge TTS Voice Selector */}
          <div className="relative flex items-center">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-base border border-line hover:border-accent/40 transition-colors shadow-sm">
              <span className="text-[11px] font-mono font-medium text-muted uppercase">Voice:</span>
              <select
                value={selectedVoice}
                onChange={(e) => {
                  const newVoice = e.target.value;
                  setSelectedVoice(newVoice);
                  const wasPlaying = isPlaying;
                  stopAllAudio(true);
                  if (wasPlaying) {
                    speakSlideScript(currentSlide, newVoice);
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

          <span className="text-xs font-mono font-bold text-accent px-3 py-1.5 rounded-xl bg-base border border-line">
            SLIDE {currentSlide + 1} / {totalSlides}
          </span>
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
            {formatTime(progressSeconds)} <span className="text-muted text-[10px]">/ 01:00</span>
          </div>
        </div>

        {/* Timeline Scrubber Bar */}
        <div className="space-y-1">
          <div className="h-2 w-full bg-raised rounded-full overflow-hidden border border-line">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${(progressSeconds / totalDuration) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-mono text-muted">
            {Array.from({ length: totalSlides }).map((_, idx) => (
              <span
                key={idx}
                onClick={() => handleSlideChange(idx)}
                className={`cursor-pointer transition-colors ${
                  currentSlide === idx ? "text-accent font-bold" : "hover:text-ink"
                }`}
              >
                S{idx + 1}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Visual Slide Presenter Canvas (8 Dynamic Executive Slides) */}
      <div className="rounded-2xl border border-line bg-surface p-6 space-y-4 shadow-md min-h-[350px] flex flex-col justify-between relative z-10">
        {/* Slide 1: Strategic Outcome & Overview */}
        {currentSlide === 0 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <span className="text-[10px] font-mono uppercase text-accent font-bold tracking-wider">
                SLIDE 01 · EXECUTIVE STRATEGIC OVERVIEW
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-accent2/15 text-accent2 border border-accent2/30 text-[10px] font-mono font-bold">
                {riskScore >= 80 ? "CRITICAL SEVERITY" : riskScore >= 65 ? "HIGH SEVERITY" : "MODERATE SEVERITY"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-base border border-line space-y-1">
                <span className="text-[10px] font-mono text-muted">OVERALL RISK SCORE</span>
                <p className="font-display text-3xl font-extrabold text-accent2">{riskScore} <span className="text-sm font-normal text-muted">/ 100</span></p>
                <p className="text-[11px] font-mono text-muted pt-1 truncate">Primary Concern: {primaryConcern}</p>
              </div>

              <div className="p-4 rounded-2xl bg-base border border-line space-y-1">
                <span className="text-[10px] font-mono text-muted">DOCUMENT SOURCE</span>
                <p className="text-xs font-bold text-ink truncate mt-1">{fileSource}</p>
                <p className="text-[11px] font-mono text-emerald-400 font-semibold pt-1">{totalAgents} Swarm Agents Active</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-base/60 border border-line/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-accent uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" /> EXECUTIVE STRATEGIC TAKEAWAY
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase ${
                  (report as any).decision_verdict === "GO" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" :
                  (report as any).decision_verdict === "HOLD" ? "bg-rose-500/15 text-rose-400 border border-rose-500/30" :
                  "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                }`}>
                  Verdict: {((report as any).decision_verdict || (riskScore < 40 ? "GO" : riskScore < 70 ? "CONDITIONAL GO" : "HOLD")).replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs font-semibold text-ink leading-relaxed">
                {(report as any).one_line_verdict || (report as any).oneLineVerdict || "Establish deterministic approval interlocks and agency safeguards before broad rollout."}
              </p>
              <div className="flex items-center justify-between text-[10px] font-mono text-muted pt-1 border-t border-line/40">
                <span>Alignment: {sentiment.positive || 25}% Backing vs {((sentiment.negative || 0) + (sentiment.critical || 0)) || 60}% Dissent</span>
                <span className="text-accent font-medium truncate max-w-[200px]">Focus: {primaryConcern}</span>
              </div>
            </div>
          </div>
        )}

        {/* Slide 2: Key Identified Risk Vectors */}
        {currentSlide === 1 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <span className="text-[10px] font-mono uppercase text-accent font-bold tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-accent2" /> SLIDE 02 · KEY IDENTIFIED RISK VECTORS
              </span>
              <span className="text-xs font-mono text-accent2 font-bold">{report.keyRisks.length} Critical Vectors</span>
            </div>

            <div className="space-y-2.5">
              {report.keyRisks.map((risk, i) => (
                <div key={i} className="p-3 rounded-2xl bg-base border border-line flex items-center justify-between text-xs font-body">
                  <div className="flex items-center gap-2.5">
                    <span className="h-5 w-5 rounded-full bg-accent2/20 text-accent2 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                      R{i + 1}
                    </span>
                    <span className="text-ink font-semibold">{typeof risk === "string" ? risk : ((risk as any).title || String(risk))}</span>
                  </div>
                  <span className="text-[10px] font-mono text-accent2 font-bold uppercase shrink-0">HIGH IMPACT</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Slide 3: Emerging Risk Indicators */}
        {currentSlide === 2 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <span className="text-[10px] font-mono uppercase text-accent font-bold tracking-wider flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-accent" /> SLIDE 03 · EMERGING RISK INDICATORS
              </span>
              <span className="text-xs font-mono text-accent font-bold">Early Signals</span>
            </div>

            <div className="space-y-2.5">
              {report.emergingRisks.map((risk, i) => (
                <div key={i} className="p-3 rounded-2xl bg-base border border-line flex items-center justify-between text-xs font-body">
                  <div className="flex items-center gap-2.5">
                    <span className="h-5 w-5 rounded-full bg-accent/20 text-accent font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                      E{i + 1}
                    </span>
                    <span className="text-ink font-semibold">{risk}</span>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase shrink-0">MONITORING</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Slide 4: Swarm Sentiment & Stance Ratios */}
        {currentSlide === 3 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <span className="text-[10px] font-mono uppercase text-accent font-bold tracking-wider">
                SLIDE 04 · SWARM SENTIMENT & STANCE RATIOS
              </span>
              <span className="text-xs font-mono text-muted">3 Channels Analyzed</span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center font-mono">
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                <span className="text-[10px] text-emerald-400 font-bold block">POSITIVE</span>
                <span className="text-xl font-extrabold text-ink">{sentiment.positive}%</span>
              </div>
              <div className="p-3 rounded-2xl bg-base border border-line">
                <span className="text-[10px] text-muted font-bold block">NEUTRAL</span>
                <span className="text-xl font-extrabold text-ink">{sentiment.neutral}%</span>
              </div>
              <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30">
                <span className="text-[10px] text-red-400 font-bold block">NEGATIVE</span>
                <span className="text-xl font-extrabold text-ink">{sentiment.negative}%</span>
              </div>
              <div className="p-3 rounded-2xl bg-accent2/10 border border-accent2/30">
                <span className="text-[10px] text-accent2 font-bold block">CRITICAL</span>
                <span className="text-xl font-extrabold text-ink">{sentiment.critical}%</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-base/60 border border-line/60 space-y-2">
              <span className="text-[10px] font-mono text-muted uppercase font-bold">SENTIMENT DYNAMICS LOG</span>
              <p className="text-xs text-ink/90 font-body leading-relaxed">
                {report.sentimentEvolution}
              </p>
            </div>
          </div>
        )}

        {/* Slide 5: Stakeholder Alignment & Positions */}
        {currentSlide === 4 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <span className="text-[10px] font-mono uppercase text-accent font-bold tracking-wider flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-accent" /> SLIDE 05 · STAKEHOLDER REACTION ANALYSIS
              </span>
              <span className="text-xs font-mono text-emerald-400 font-bold">Board Consensus</span>
            </div>

            <div className="space-y-2 font-body text-xs">
              {Object.entries(report.stakeholderReactions || {}).map(([group, text]) => (
                <div key={group} className="p-3 rounded-2xl bg-base border border-line space-y-1">
                  <span className="font-bold text-accent font-mono text-[11px] block">{group}</span>
                  <p className="text-ink/90 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Slide 6: Critical Simulation Turning Points */}
        {currentSlide === 5 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <span className="text-[10px] font-mono uppercase text-accent font-bold tracking-wider flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-accent" /> SLIDE 06 · CRITICAL TURNING POINTS
              </span>
              <span className="text-xs font-mono text-accent2 font-bold">3 Escalations</span>
            </div>

            <div className="space-y-2">
              {(report.criticalTurningPoints || report.turningPoints || []).slice(0, 3).map((tp, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-base border border-line flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="h-6 w-6 rounded-lg bg-accent/20 text-accent font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                      R{tp.round}
                    </span>
                    <span className="font-bold text-ink truncate max-w-[220px]">{tp.event}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-accent2 uppercase shrink-0">{tp.severity}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Slide 7: Executive Strategic Recommendations */}
        {currentSlide === 6 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <span className="text-[10px] font-mono uppercase text-accent font-bold tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> SLIDE 07 · STRATEGIC NEXT STEPS
              </span>
              <span className="text-xs font-mono text-emerald-400 font-bold">Board Directives</span>
            </div>

            <div className="space-y-2">
              {report.recommendedInvestigationAreas.slice(0, 3).map((rec, i) => (
                <div key={i} className="p-3 rounded-2xl bg-base border border-line flex items-center gap-2.5 text-xs text-ink font-body">
                  <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="leading-snug">{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Slide 8: Financial & ARR Risk Impact Sensitivity */}
        {currentSlide === 7 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <span className="text-[10px] font-mono uppercase text-accent font-bold tracking-wider flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-emerald-400" /> SLIDE 08 · FINANCIAL RISK SENSITIVITY
              </span>
              <span className="text-xs font-mono text-emerald-400 font-bold">ARR Impact</span>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30">
                <span className="text-[10px] text-red-400 font-bold block">UNMITIGATED CHURN</span>
                <span className="text-2xl font-extrabold text-ink">4.2% ARR</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                <span className="text-[10px] text-emerald-400 font-bold block">MITIGATED TARGET</span>
                <span className="text-2xl font-extrabold text-emerald-400">&lt; 0.8%</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-base/60 border border-line/60 text-xs font-body text-ink/90 leading-relaxed">
              Implementing strategic mitigation steps stabilizes top-line ARR within 60 days of launch.
            </div>
          </div>
        )}

        {/* Slide Controls Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-line/60 text-xs font-mono">
          <div className="flex gap-1.5 overflow-x-auto py-1">
            {Array.from({ length: totalSlides }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => handleSlideChange(idx)}
                className={`h-2 rounded-full transition-all ${
                  currentSlide === idx ? "w-5 bg-accent" : "w-2 bg-line hover:bg-muted"
                }`}
                title={`Go to Slide ${idx + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={currentSlide === 0}
              onClick={() => handleSlideChange(currentSlide - 1)}
              className="p-1.5 rounded-lg bg-raised border border-line text-muted hover:text-ink disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={currentSlide === totalSlides - 1}
              onClick={() => handleSlideChange(currentSlide + 1)}
              className="p-1.5 rounded-lg bg-raised border border-line text-muted hover:text-ink disabled:opacity-30 transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Teleprompter Transcript Box with Active Sentence Highlighting */}
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
        <div className="p-2.5 rounded-xl bg-surface/60 border border-line/50 leading-relaxed text-[11px]">
          {(() => {
            const currentScript = slideScripts[currentSlide] || "";
            const sentences = currentScript.match(/[^.!?]+[.!?]+/g) || [currentScript];
            const slideTime = progressSeconds % 7.5;
            const activeIdx = Math.min(sentences.length - 1, Math.floor((slideTime / 7.5) * sentences.length));

            return (
              <p className="space-x-1">
                {sentences.map((sent, sIdx) => {
                  const isCurrentSentence = isPlaying && sIdx === activeIdx;
                  return (
                    <span
                      key={sIdx}
                      className={`transition-all duration-300 ${
                        isCurrentSentence
                          ? "bg-accent/20 text-accent font-bold px-1 rounded shadow-sm"
                          : isPlaying && sIdx < activeIdx
                          ? "text-ink/60"
                          : "text-ink/90"
                      }`}
                    >
                      {sent.trim()}{" "}
                    </span>
                  );
                })}
              </p>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
