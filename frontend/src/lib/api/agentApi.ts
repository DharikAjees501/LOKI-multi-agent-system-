import { Agent } from "@/types";
import { keyService } from "./keyService";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export interface AgentChatMessage {
  id: string;
  sender: "USER" | "AGENT";
  message: string;
  timestamp: string;
}

class AgentApiService {
  private getApiKeyHeaders(): Record<string, string> {
    const keys = keyService.getKeys();
    const primaryKey = keys.find((k) => k.isPrimary) || keys[0];
    const keysHeader = keyService.getPrimaryOrFallbackKeysHeader();
    const activeProvider = primaryKey?.provider || "gemini";

    const headers: Record<string, string> = {};
    if (primaryKey?.key) {
      headers["Authorization"] = `Bearer ${primaryKey.key}`;
    }
    if (keysHeader) {
      headers["x-api-key"] = keysHeader;
    }
    headers["X-LLM-Provider"] = activeProvider;
    return headers;
  }

  async getAllAgents(scenarioId: string = "scen-01"): Promise<Agent[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/${scenarioId}/agents`, {
        headers: {
          ...this.getApiKeyHeaders(),
        },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Quiet fallback when backend API is offline
    }
    return Array.from({ length: 200 }, (_, i) => {
      const num = i + 1;
      const tier = (i < 2 ? 0 : i < 20 ? 1 : i < 45 ? 2 : i < 100 ? 3 : 4) as Agent["tier"];
      const tierName = (
        tier === 0
          ? "TIER 0 · ORCHESTRATION & SYSTEM"
          : tier === 1
          ? "TIER 1 · BOARDROOM & EXECUTIVE LEADERSHIP"
          : tier === 2
          ? "TIER 2 · INSTITUTIONAL & REGULATORY WATCHDOGS"
          : tier === 3
          ? "TIER 3 · MEDIA, AMPLIFIERS & PUBLIC CRITICS"
          : "TIER 4 · BROAD MARKET & CONSUMER POPULATION"
      ) as Agent["tierName"];

      return {
        id: `agent-scen-01-${num}`,
        numberId: num,
        name: `Agent A${String(num).padStart(2, "0")}`,
        role: `Stakeholder Role ${num}`,
        tier,
        tierName,
        bias: "Operational Governance",
        riskThreshold: 30,
        currentState: "ACTIVE" as Agent["currentState"],
        currentPosition: "Auditing strategy parameters.",
        sentiment: "NEUTRAL" as Agent["sentiment"],
        currentChannel: (tier <= 1 ? "BOARDROOM" : tier <= 3 ? "MEDIA" : "PUBLIC") as Agent["currentChannel"],
        confidence: 85,
        metrics: {
          postsCount: 12,
          influenceScore: 78,
          agreementRate: 65,
        },
      };
    });
  }

  async getAgentsForScenario(scenarioId: string = "scen-01"): Promise<Agent[]> {
    return this.getAllAgents(scenarioId);
  }

  async getAgentById(id: string, scenarioId: string = "scen-01"): Promise<Agent | undefined> {
    const agents = await this.getAllAgents(scenarioId);
    const nums = id.match(/\d+/g);
    const targetNum = nums && nums.length > 0 ? Number(nums[nums.length - 1]) : null;
    return agents.find((a) => a.id === id || (targetNum !== null && a.numberId === targetNum));
  }

  async interrogateAgent(agentId: string, userQuestion: string, conversationHistory: AgentChatMessage[] = []): Promise<AgentChatMessage> {
    const keys = keyService.getKeys();
    if (keys.length === 0) {
      throw new Error("API key required for live interrogation.");
    }

    const formattedHistory = conversationHistory.map((msg) => ({
      sender: msg.sender,
      message: msg.message,
    }));

    const res = await fetch(`${API_BASE_URL}/agents/${agentId}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.getApiKeyHeaders(),
      },
      body: JSON.stringify({
        agent_id: agentId,
        message: userQuestion,
        user_question: userQuestion,
        conversation_history: formattedHistory,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      const errMsg = errData?.detail || errData?.message || "API key required for live interrogation.";
      throw new Error(errMsg);
    }

    const data = await res.json();
    const replyText = data.reply || data.message || "No response generated.";
    return {
      id: `msg-${Date.now()}`,
      sender: "AGENT",
      message: replyText,
      timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
  }
}

export const agentApi = new AgentApiService();
