"use client";

import React, { useState, useEffect } from "react";
import { X, Send, Bot, Shield, Cpu, MessageSquare } from "lucide-react";
import { Agent } from "@/types";
import { agentApi, AgentChatMessage } from "@/lib/api/agentApi";

interface AgentInterrogationModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AgentInterrogationModal: React.FC<AgentInterrogationModalProps> = ({
  agent,
  isOpen,
  onClose,
}) => {
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (agent) {
      setMessages([
        {
          id: "init",
          sender: "AGENT",
          message: `I am ${agent.name} (${agent.role}). My risk threshold is ${agent.riskThreshold}%, and my current position is: "${agent.currentPosition}". Ask me why I took this stance or how I evaluate current simulation rounds.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, [agent]);

  if (!isOpen || !agent) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input;
    setInput("");

    const userMsg: AgentChatMessage = {
      id: `user-${Date.now()}`,
      sender: "USER",
      message: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await agentApi.interrogateAgent(agent.id, userText, messages);
      setMessages((prev) => [...prev, response]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "AGENT",
          message: `⚠️ ${err?.message || "API key required for live interrogation."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-base/80 backdrop-blur-md flex items-center justify-end sm:p-4">
      <div className="w-full sm:max-w-xl h-full sm:h-[90vh] bg-surface border border-line rounded-none sm:rounded-card shadow-2xl flex flex-col select-none animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 border-b border-line flex items-start justify-between bg-raised/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent font-mono font-bold text-sm">
              A{String(agent.numberId).padStart(2, "0")}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-ink">{agent.role}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/10 border border-accent/30 text-accent font-semibold">
                  TIER {agent.tier}
                </span>
              </div>
              <p className="text-xs text-muted font-mono">{agent.tierName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-raised border border-line flex items-center justify-center text-muted hover:text-ink transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Agent Metadata Clean Header */}
        <div className="grid grid-cols-3 gap-2 p-3 border-b border-line bg-base/40 text-[11px] font-mono">
          <div className="p-2 rounded-xl bg-surface border border-line">
            <span className="text-muted block text-[9px] uppercase">FACTION</span>
            <span className="text-accent font-semibold truncate block">{agent.currentChannel}</span>
          </div>
          <div className="p-2 rounded-xl bg-surface border border-line">
            <span className="text-muted block text-[9px] uppercase">POSTURE / ALIGNMENT</span>
            <div className="mt-0.5">
              {(() => {
                const s = agent.stanceAxis !== undefined ? agent.stanceAxis : -0.5;
                if (s < -0.4) {
                  return <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-semibold text-[10px]">Strong Opposition</span>;
                }
                if (s < 0.0) {
                  return <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold text-[10px]">Skeptical</span>;
                }
                if (s <= 0.3) {
                  return <span className="px-2 py-0.5 rounded-full bg-raised text-muted border border-line font-semibold text-[10px]">Neutral / Observing</span>;
                }
                return <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold text-[10px]">Aligned Champion</span>;
              })()}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-surface border border-line">
            <span className="text-muted block text-[9px] uppercase">ROLE</span>
            <span className="text-ink font-semibold truncate block">{agent.role}</span>
          </div>
        </div>

        {/* Priority Banner */}
        <div className="px-4 py-2 bg-raised/30 border-b border-line flex items-center gap-2 text-xs font-mono text-muted">
          <Shield className="h-3.5 w-3.5 text-accent shrink-0" />
          <span className="truncate"><strong className="text-ink">KEY PRIORITY:</strong> {agent.bias}</span>
        </div>

        {/* Chat Log */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-base/20">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === "USER" ? "flex-row-reverse" : "flex-row"}`}
            >

              <div
                className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                  msg.sender === "USER"
                    ? "bg-accent text-white"
                    : "bg-raised border border-line text-accent"
                }`}
              >
                {msg.sender === "USER" ? "U" : <Bot className="h-4 w-4" />}
              </div>
              <div
                className={`max-w-[80%] p-3 rounded-2xl text-xs ${
                  msg.sender === "USER"
                    ? "bg-accent text-white rounded-tr-none"
                    : "bg-surface border border-line text-ink rounded-tl-none space-y-1"
                }`}
              >
                <div className="flex items-center justify-between gap-4 text-[10px] opacity-70 font-mono">
                  <span>{msg.sender === "USER" ? "You" : agent.role}</span>
                  <span>{msg.timestamp}</span>
                </div>
                <p className="leading-relaxed">{msg.message}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs font-mono text-muted py-2">
              <Bot className="h-4 w-4 text-accent animate-pulse" />
              <span>{agent.role} is thinking...</span>
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-3 py-2 border-t border-line bg-base/60 flex items-center gap-1.5 overflow-x-auto text-[11px] font-mono no-scrollbar">
          {[
            "Why did you adopt this stance?",
            "What is your risk threshold?",
            "How do you evaluate our strategy?",
            "What are your main concerns?",
          ].map((promptText, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setInput(promptText);
              }}
              className="px-2.5 py-1 rounded-lg bg-surface border border-line hover:border-accent/50 text-muted hover:text-accent whitespace-nowrap transition-all"
            >
              {promptText}
            </button>
          ))}
        </div>

        {/* Message Input */}
        <form onSubmit={handleSend} className="p-3 border-t border-line bg-surface flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask ${agent.role} why it made this decision...`}
            className="flex-1 bg-base border border-line rounded-xl px-4 py-2 text-xs text-ink placeholder:text-muted focus:outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="h-9 w-9 rounded-xl bg-accent text-white flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-all shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
