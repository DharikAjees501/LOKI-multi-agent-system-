"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  Bot,
  RotateCcw,
  Loader2,
  Users,
  ShieldAlert,
  CheckCircle2,
  HelpCircle,
  CornerDownLeft,
} from "lucide-react";
import { reportApi } from "@/lib/api/reportApi";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: string[];
}

interface ReportAgentChatProps {
  scenarioId?: string;
  scenarioName?: string;
  documentName?: string;
}

const STARTER_PROMPTS = [
  "Why did stakeholders push back in Round 3?",
  "What single change will reduce our risk score the most?",
  "Which user group supports this proposal the strongest?",
];

export const ReportAgentChat: React.FC<ReportAgentChatProps> = ({
  scenarioId = "",
  scenarioName = "Active Scenario",
  documentName = "Uploaded Strategy Document",
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of chat on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText || input).trim();
    if (!textToSend || isLoading) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: textToSend,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // Build conversation history for context
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await reportApi.chatWithReportAgent(scenarioId, textToSend, history);

      const assistantMsg: Message = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: res.reply,
        citations: res.citations || [],
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("[ReportAgentChat] Failed to get response:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content:
            "The ReportAgent encountered an issue reading simulation telemetry. Please verify network connectivity or rephrase your question.",
          citations: ["System Monitor"],
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = () => {
    setMessages([]);
    setInput("");
  };

  return (
    <div className="rounded-3xl border border-line bg-surface p-6 space-y-4 shadow-2xl relative overflow-hidden flex flex-col justify-between">
      {/* Ambient background glow */}
      <div className="absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-line pb-3.5 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center font-mono shadow-sm">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-ink">Ask ReportAgent</h3>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono text-emerald-400 font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Grounded Telemetry
              </span>
            </div>
            <p className="text-[10px] font-mono text-muted">
              Interactive deep inquiry into 200-agent OASIS simulation & source doc
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="p-1.5 rounded-lg bg-base border border-line text-muted hover:text-ink transition-colors"
            title="Reset Conversation"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Chat Messages / Starters View */}
      <div
        ref={scrollRef}
        className="max-h-[380px] min-h-[220px] overflow-y-auto space-y-3.5 pr-1 relative z-10 scrollbar-thin scrollbar-thumb-line"
      >
        {messages.length === 0 ? (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-300">
            <div className="h-12 w-12 rounded-2xl bg-base border border-line flex items-center justify-center text-accent shadow-sm">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="max-w-sm space-y-1">
              <p className="text-xs font-bold text-ink">Have a question about the simulation?</p>
              <p className="text-[11px] text-muted font-body">
                ReportAgent cross-references the 200-agent debate transcripts and source document in real-time.
              </p>
            </div>

            {/* One-Click Executive Starter Chips */}
            <div className="space-y-2 w-full pt-1">
              <span className="text-[10px] font-mono text-muted uppercase font-bold tracking-wider block">
                Executive Starter Questions
              </span>
              <div className="flex flex-col gap-2">
                {STARTER_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(prompt)}
                    className="w-full text-left p-2.5 rounded-xl bg-base border border-line hover:border-accent/50 hover:bg-raised text-xs text-ink/90 font-medium transition-all flex items-center justify-between group shadow-sm"
                  >
                    <span>&ldquo;{prompt}&rdquo;</span>
                    <CornerDownLeft className="h-3.5 w-3.5 text-muted group-hover:text-accent transition-colors shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl p-3.5 text-xs font-body leading-relaxed shadow-sm ${
                    msg.role === "user"
                      ? "bg-accent/15 border border-accent/30 text-ink rounded-tr-sm font-medium"
                      : "bg-base border border-line text-ink rounded-tl-sm space-y-2.5"
                  }`}
                >
                  {/* Clean text with line break / bullet support */}
                  <div className="space-y-1 whitespace-pre-line">
                    {msg.content.split("\n").map((line, lIdx) => {
                      const trimmed = line.trim();
                      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                        return (
                          <div key={lIdx} className="flex items-start gap-2 pl-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                            <span>{trimmed.substring(2)}</span>
                          </div>
                        );
                      }
                      return <p key={lIdx}>{line}</p>;
                    })}
                  </div>

                  {/* Grounded Citation Badges */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-line/50">
                      <span className="text-[10px] font-mono text-muted uppercase font-semibold">
                        Cited:
                      </span>
                      {msg.citations.map((cite, cIdx) => (
                        <span
                          key={cIdx}
                          className="px-2 py-0.5 rounded-md bg-accent/10 border border-accent/25 text-accent font-mono text-[10px] font-bold"
                        >
                          {cite}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* In-Flight Typing Indicator */}
            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="rounded-2xl rounded-tl-sm p-3.5 bg-base border border-line text-xs font-mono text-muted flex items-center gap-2 shadow-sm animate-pulse">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                  <span>ReportAgent is analyzing simulation logs & source telemetry...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Box & Action Bar */}
      <div className="pt-2 border-t border-line/60 relative z-10 space-y-2">
        <div className="flex items-center gap-2 bg-base p-1.5 rounded-2xl border border-line focus-within:border-accent/60 transition-colors shadow-inner">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about simulation risks, agent pushback, or mitigations..."
            disabled={isLoading}
            className="flex-1 bg-transparent px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-none"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="h-8 w-8 rounded-xl bg-accent text-white flex items-center justify-center hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-accent/20 shrink-0"
            title="Send Question"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>

        <p className="text-[10px] font-mono text-muted text-center flex items-center justify-center gap-1.5">
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
          Strict Grounding: Answers generated exclusively from 200-agent debate logs & uploaded source document.
        </p>
      </div>
    </div>
  );
};

