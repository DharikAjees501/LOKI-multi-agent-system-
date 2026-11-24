import { ExecutiveReport } from "@/types";
import { API_BASE_URL } from "./baseUrl";
import { authService } from "./authService";
import { keyService } from "./keyService";

class ReportApiService {
  private getHeaders(): Record<string, string> {
    return {
      ...authService.getAuthHeaders(),
      ...keyService.getBYOKHeaders(),
    };
  }

  private resolveScenarioId(scenarioId?: string): string {
    const id =
      scenarioId ||
      (typeof window !== "undefined"
        ? localStorage.getItem("active_scenario_id") ||
          localStorage.getItem("SWARMLENS_ACTIVE_SCENARIO_ID") ||
          localStorage.getItem("LOKI_ACTIVE_SCENARIO_ID") ||
          ""
        : "");
    if (!id || typeof id !== "string") return "";
    const clean = id.trim().toLowerCase();
    if (clean === "none" || clean === "undefined" || clean === "null" || clean === "scen-01" || clean === "") {
      return "";
    }
    return id.trim();
  }

  async getExecutiveReport(scenarioId?: string, roundNum?: number): Promise<ExecutiveReport | null> {
    const targetId = this.resolveScenarioId(scenarioId);
    if (!targetId) return null;

    try {
      const url = roundNum
        ? `${API_BASE_URL}/scenarios/${targetId}/report?round=${roundNum}`
        : `${API_BASE_URL}/scenarios/${targetId}/report`;
      const res = await fetch(url, {
        credentials: "include",
        headers: this.getHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error("[ReportApi] Failed to fetch live executive report:", err);
    }

    return null;
  }

  async getRisks(scenarioId?: string, round?: number): Promise<any> {
    const targetId = this.resolveScenarioId(scenarioId);
    if (!targetId) {
      return {
        overallRiskScore: 0,
        severityThreshold: "LOW",
        primaryConcern: "",
        keyRisks: [],
      };
    }

    try {
      const url = round
        ? `${API_BASE_URL}/scenarios/${targetId}/risks?round=${round}`
        : `${API_BASE_URL}/scenarios/${targetId}/risks`;
      const res = await fetch(url, {
        credentials: "include",
        headers: this.getHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error("[ReportApi] Failed to fetch live risks:", err);
    }

    return {
      overallRiskScore: 0,
      severityThreshold: "LOW",
      primaryConcern: "",
      keyRisks: [],
    };
  }

  async getSentimentTimeSeries(scenarioId?: string): Promise<any> {
    const targetId = this.resolveScenarioId(scenarioId);
    if (!targetId) {
      return {
        breakdown: { positive: 0, neutral: 0, negative: 0, critical: 0 },
        timeseries: [],
      };
    }

    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/${targetId}/sentiment`, {
        credentials: "include",
        headers: this.getHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error("[ReportApi] Failed to fetch live sentiment time series:", err);
    }

    return {
      breakdown: { positive: 0, neutral: 0, negative: 0, critical: 0 },
      timeseries: [],
    };
  }

  async getConsensusMatrix(scenarioId?: string, round?: number): Promise<any> {
    const targetId = this.resolveScenarioId(scenarioId);
    if (!targetId) {
      return { items: [] };
    }

    try {
      const url = round
        ? `${API_BASE_URL}/scenarios/${targetId}/consensus?round=${round}`
        : `${API_BASE_URL}/scenarios/${targetId}/consensus`;
      const res = await fetch(url, {
        credentials: "include",
        headers: this.getHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error("[ReportApi] Failed to fetch live consensus matrix:", err);
    }

    return { items: [] };
  }

  async getTurningPoints(scenarioId?: string): Promise<any[]> {
    const targetId = this.resolveScenarioId(scenarioId);
    if (!targetId) return [];

    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/${targetId}/turning-points`, {
        credentials: "include",
        headers: this.getHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error("[ReportApi] Failed to fetch live turning points:", err);
    }

    return [];
  }

  async exportReport(scenarioId?: string, format: "pdf" | "json" = "pdf"): Promise<void> {
    const targetId = this.resolveScenarioId(scenarioId);
    if (!targetId) return;

    if (format === "pdf") {
      try {
        const res = await fetch(`${API_BASE_URL}/scenarios/${targetId}/report/export?format=pdf`, {
          credentials: "include",
          headers: this.getHeaders(),
        });
        if (res.ok) {
          const html = await res.text();
          const printWindow = window.open("", "_blank");
          if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            setTimeout(() => {
              printWindow.print();
            }, 500);
            return;
          }
        }
      } catch (err) {
        console.error("[ReportApi] PDF export failed:", err);
      }
    }

    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/${targetId}/report`, {
        credentials: "include",
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `report_${targetId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("[ReportApi] JSON export failed:", err);
    }
  }

  async getRiskThresholdMonitor(scenarioId?: string, threshold: number = 35): Promise<any> {
    const targetId = this.resolveScenarioId(scenarioId);
    if (!targetId) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/${targetId}/risk-threshold-monitor?threshold=${threshold}`, {
        credentials: "include",
        headers: this.getHeaders(),
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.error("[ReportApi] Failed to fetch live risk threshold monitor:", err);
    }

    return null;
  }

  async getSlideDeck(scenarioId?: string): Promise<any[]> {
    const targetId = this.resolveScenarioId(scenarioId);
    if (!targetId) return [];

    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/${targetId}/slides`, {
        credentials: "include",
        headers: this.getHeaders(),
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.error("[ReportApi] Failed to fetch live slide deck:", err);
    }

    return [];
  }

  async getAudioBriefing(scenarioId?: string): Promise<any> {
    const targetId = this.resolveScenarioId(scenarioId);
    if (!targetId) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/${targetId}/audio-briefing`, {
        credentials: "include",
        headers: this.getHeaders(),
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.error("[ReportApi] Failed to fetch live audio briefing:", err);
    }

    return null;
  }

  async getReportSummary(scenarioId?: string): Promise<any> {
    const activeId = this.resolveScenarioId(scenarioId);
    if (!activeId) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/reports/summary?scenario_id=${activeId}`, {
        credentials: "include",
        headers: this.getHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error("[ReportApi] Failed to fetch live report summary:", err);
    }

    return null;
  }

  async chatWithReportAgent(
    scenarioId?: string,
    message: string = "",
    history: Array<{ role: "user" | "assistant"; content: string }> = []
  ): Promise<{ reply: string; citations: string[] }> {
    const targetId = this.resolveScenarioId(scenarioId);
    if (!targetId) {
      return { reply: "No active simulation scenario loaded.", citations: [] };
    }
    const endpoints = [
      `/api/reports/${targetId}/chat`,
      `http://127.0.0.1:8000/api/reports/${targetId}/chat`,
      `http://localhost:8000/api/reports/${targetId}/chat`,
    ];

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...this.getHeaders(),
          },
          body: JSON.stringify({ message, history }),
        });
        if (res.ok) {
          return await res.json();
        }
      } catch {}
    }

    return {
      reply: "The ReportAgent is temporarily synchronizing simulation telemetry. Please retry in a moment.",
      citations: ["Telemetry Monitor"],
    };
  }
}

export const reportApi = new ReportApiService();
