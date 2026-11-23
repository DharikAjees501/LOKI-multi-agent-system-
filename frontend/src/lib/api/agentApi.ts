import { Agent } from "@/types";
import { keyService } from "./keyService";
import { authService } from "./authService";
import { API_BASE_URL } from "./baseUrl";

export interface AgentChatMessage {
  id: string;
  sender: "USER" | "AGENT";
  message: string;
  timestamp: string;
}

class AgentApiService {
  private getHeaders(): Record<string, string> {
    const keys = keyService.getKeys();
    const primaryKey = keys.find((k) => k.isPrimary) || keys[0];
    const keysHeader = keyService.getPrimaryOrFallbackKeysHeader();
    const activeProvider = primaryKey?.provider || "gemini";

    const headers: Record<string, string> = {
      ...authService.getAuthHeaders(),
      ...keyService.getBYOKHeaders(),
    };

    if (keysHeader) {
      headers["x-api-key"] = keysHeader;
    }
    headers["X-LLM-Provider"] = activeProvider;
    return headers;
  }

  async getAllAgents(scenarioId?: string): Promise<Agent[]> {
    const targetScenId =
      scenarioId ||
      (typeof window !== "undefined"
        ? localStorage.getItem("SWARMLENS_ACTIVE_SCENARIO_ID") ||
          localStorage.getItem("LOKI_ACTIVE_SCENARIO_ID") ||
          ""
        : "");

    if (!targetScenId || targetScenId === "scen-01") {
      return [];
    }

    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/${targetScenId}/agents`, {
        credentials: "include",
        headers: this.getHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Quiet fallback when backend API is offline
    }
    return [];
  }

  async getAgentsForScenario(scenarioId?: string): Promise<Agent[]> {
    return this.getAllAgents(scenarioId);
  }

  async getAgentById(id: string, scenarioId?: string): Promise<Agent | undefined> {
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
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...this.getHeaders(),
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
