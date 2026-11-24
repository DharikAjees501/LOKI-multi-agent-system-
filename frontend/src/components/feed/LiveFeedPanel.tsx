"use client";

import React, { useState, useEffect } from "react";
import { ChannelId, FeedEvent, Sentiment, Agent } from "@/types";
import { Rss, Search, MessageSquare, ShieldAlert, CheckCircle2, AlertTriangle } from "lucide-react";
import { simulationApi } from "@/lib/api/simulationApi";
import { getActiveDocName, getActiveScenarioId } from "@/lib/api/scenarioApi";

interface LiveFeedPanelProps {
  onInterrogateAgent?: (agent: Agent) => void;
  fullScreen?: boolean;
  currentRound?: number;
}

export const LiveFeedPanel: React.FC<LiveFeedPanelProps> = ({
  onInterrogateAgent,
  fullScreen = false,
  currentRound,
}) => {
  const [activeChannel, setActiveChannel] = useState<ChannelId>("BOARDROOM");
  const [searchQuery, setSearchQuery] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState<Sentiment | "ALL">("ALL");
  const [events, setEvents] = useState<FeedEvent[]>([]);

  const loadFeedEvents = async () => {
    const doc = getActiveDocName();
    if (!doc) {
      setEvents([]);
      return;
    }
    const activeId = getActiveScenarioId();
    if (!activeId) {
      setEvents([]);
      return;
    }
    const fetched = await simulationApi.getFeedEvents(activeId);
    if (fetched && fetched.length > 0) {
      // Sort newest-first (descending round, descending id)
      const sorted = [...fetched].sort((a, b) => {
        if (b.round !== a.round) return b.round - a.round;
        return (b.id || "").localeCompare(a.id || "");
      });
      setEvents(sorted);
    } else {
      setEvents([]);
    }
  };

  const [isSimRunning, setIsSimRunning] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return (
      localStorage.getItem("SWARMLENS_SIM_STATUS") === "RUNNING" ||
      localStorage.getItem("LOKI_SIM_STATUS") === "RUNNING"
    );
  });

  useEffect(() => {
    loadFeedEvents();

    const handleScenarioEvent = () => {
      loadFeedEvents();
      const running =
        typeof window !== "undefined" &&
        (localStorage.getItem("SWARMLENS_SIM_STATUS") === "RUNNING" ||
          localStorage.getItem("LOKI_SIM_STATUS") === "RUNNING");
      setIsSimRunning(running);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("scenario_changed", handleScenarioEvent);
      window.addEventListener("simulation_completed", handleScenarioEvent);
      window.addEventListener("swarmlens_start_simulation", handleScenarioEvent);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("scenario_changed", handleScenarioEvent);
        window.removeEventListener("simulation_completed", handleScenarioEvent);
        window.removeEventListener("swarmlens_start_simulation", handleScenarioEvent);
      }
    };
  }, []);

  // Poll only while a simulation is actively running
  useEffect(() => {
    if (!isSimRunning) return;

    const interval = setInterval(() => {
      loadFeedEvents();
    }, 2500);

    return () => {
      clearInterval(interval);
    };
  }, [isSimRunning]);

  const channels: { id: ChannelId; name: string; badge: string }[] = [
    { id: "BOARDROOM", name: "Executive Boardroom", badge: "Tier 1" },
    { id: "MEDIA", name: "Media & Press Room", badge: "Tier 2-3" },
    { id: "PUBLIC", name: "Public Forum Feed", badge: "Tier 4" },
  ];

  const normalizeChannel = (evt: FeedEvent): ChannelId => {
    const ch = (evt.channel || "").toUpperCase();
    if (ch === "BOARDROOM" || ch === "CH_1_EXECUTIVE" || ch.includes("BOARDROOM") || ch.includes("EXEC")) {
      return "BOARDROOM";
    }
    if (ch === "PUBLIC" || ch.startsWith("CH_8") || ch.includes("PUBLIC") || ch.includes("FORUM")) {
      return "PUBLIC";
    }
    if (ch === "MEDIA" || ch.startsWith("CH_") || ch.includes("PRESS") || ch.includes("REGULATORY") || ch.includes("COMPETITOR")) {
      return "MEDIA";
    }

    // Fallback based on agent number ID or tier
    const num = evt.agentNumberId || 1;
    if (num <= 20) return "BOARDROOM";
    if (num <= 100) return "MEDIA";
    return "PUBLIC";
  };

  const filteredEvents = events.filter((evt) => {
    const evtChannel = normalizeChannel(evt);
    if (evtChannel !== activeChannel) return false;
    if (currentRound !== undefined && evt.round > currentRound) return false;
    if (sentimentFilter !== "ALL" && evt.sentiment !== sentimentFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        evt.message.toLowerCase().includes(q) ||
        evt.role.toLowerCase().includes(q) ||
        evt.agentName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getSentimentBadge = (sentiment: Sentiment) => {
    switch (sentiment) {
      case "CRITICAL":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-accent2/20 text-accent2 border border-accent2/30">
            <AlertTriangle className="h-3 w-3" /> CRITICAL
          </span>
        );
      case "NEGATIVE":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
            <ShieldAlert className="h-3 w-3" /> NEGATIVE
          </span>
        );
      case "POSITIVE":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3" /> POSITIVE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-raised text-muted border border-line">
            NEUTRAL
          </span>
        );
    }
  };

  return (
    <div
      className={`bg-surface border border-line rounded-card flex flex-col overflow-hidden select-none ${
        fullScreen ? "h-full min-h-[700px]" : "h-full min-h-[450px]"
      }`}
    >
      {/* Feed Top Header */}
      <div className="p-4 border-b border-line space-y-3 bg-raised/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rss className="h-4 w-4 text-accent" />
            <h3 className="font-display text-sm font-bold text-ink uppercase tracking-wide">
              LIVE AGENT FEED
            </h3>
          </div>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/30 text-[10px] font-mono text-accent font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-ping" />
            STREAMING
          </span>
        </div>

        {/* Channel Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-base p-1 rounded-xl border border-line">
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch.id)}
              className={`py-1.5 px-2 rounded-lg text-center transition-all ${
                activeChannel === ch.id
                  ? "bg-accent text-white font-semibold shadow-md shadow-accent/20"
                  : "text-muted hover:text-ink hover:bg-raised"
              }`}
            >
              <span className="block text-[11px] truncate font-medium">{ch.name}</span>
              <span className="block text-[9px] font-mono opacity-80">{ch.badge}</span>
            </button>
          ))}
        </div>

        {/* Search & Sentiment Filters */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search feed events..."
              className="w-full bg-base border border-line rounded-xl pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:border-accent"
            />
          </div>

          <select
            value={sentimentFilter}
            onChange={(e) => setSentimentFilter(e.target.value as Sentiment | "ALL")}
            className="bg-base border border-line rounded-xl px-2 py-1.5 text-xs text-muted focus:outline-none focus:border-accent font-mono"
          >
            <option value="ALL">All Sentiments</option>
            <option value="CRITICAL">Critical</option>
            <option value="NEGATIVE">Negative</option>
            <option value="NEUTRAL">Neutral</option>
            <option value="POSITIVE">Positive</option>
          </select>
        </div>
      </div>

      {/* Streaming Events List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-base/30">
        {filteredEvents.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-muted space-y-2">
            <Rss className="h-8 w-8 text-line" />
            <p className="text-xs font-mono">No feed events match your current filter.</p>
          </div>
        ) : (
          filteredEvents.map((evt, eIdx) => {
            const tier = (evt.agentNumberId <= 2 ? 0 : evt.agentNumberId <= 20 ? 1 : 2) as Agent["tier"];
            const agent: Agent = {
              id: evt.agentId,
              numberId: evt.agentNumberId,
              name: evt.agentName,
              role: evt.role,
              tier,
              tierName: tier === 0 ? "TIER 0 · ORCHESTRATION & SYSTEM" : tier === 1 ? "TIER 1 · BOARDROOM & EXECUTIVE LEADERSHIP" : "TIER 2 · INSTITUTIONAL & REGULATORY WATCHDOGS",
              bias: "Operational Governance",
              riskThreshold: 30,
              currentState: "ACTIVE",
              currentPosition: evt.message,
              sentiment: evt.sentiment,
              currentChannel: evt.channel,
              confidence: 85,
              metrics: {
                postsCount: 10,
                influenceScore: 75,
                agreementRate: 60
              }
            };

            return (
              <div
                key={evt.id ? `feed-evt-${evt.id}-${eIdx}` : `feed-item-${eIdx}`}
                className="p-3.5 rounded-2xl bg-surface border border-line hover:border-accent/40 transition-all space-y-2 group"
              >
                {/* Event Header */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-lg bg-raised border border-line flex items-center justify-center font-mono text-[10px] font-bold text-accent">
                      A{String(evt.agentNumberId).padStart(2, "0")}
                    </span>
                    <span className="font-display font-bold text-ink">{evt.role}</span>
                    <span className="text-[10px] font-mono text-muted">({evt.agentName})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-raised border border-line text-[10px] font-mono text-accent font-semibold">
                      Round {evt.round || 1}
                    </span>
                    <span className="font-mono text-[10px] text-muted">{evt.timestamp}</span>
                  </div>
                </div>

                {/* Event Message */}
                <p className="text-xs text-ink/90 leading-relaxed font-body pl-8">
                  &ldquo;{evt.message}&rdquo;
                </p>

                {/* Event Footer */}
                <div className="flex items-center justify-between pt-1 border-t border-line/50 pl-8 text-[10px] font-mono">
                  <div>{getSentimentBadge(evt.sentiment)}</div>

                  {agent && onInterrogateAgent && (
                    <button
                      onClick={() => onInterrogateAgent(agent)}
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-accent hover:underline font-semibold transition-opacity"
                    >
                      <MessageSquare className="h-3 w-3" /> Interrogate
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
