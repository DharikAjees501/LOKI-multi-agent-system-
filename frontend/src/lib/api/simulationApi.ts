import { SimulationState } from "@/types";
import { keyService } from "./keyService";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export interface SimulationControlParams {
  speed?: "SLOW" | "NORMAL" | "FAST";
  temperature?: number;
  round?: number;
}

class SimulationApiService {
  private state: SimulationState = {
    currentRound: 1,
    totalRounds: 5,
    status: "IDLE",
    speed: "NORMAL",
    temperature: 0.7,
    activeAgentsCount: 50,
    totalAgentsCount: 50,
    model: "Gemini 3.5 Flash",
    activeScenarioId: "scen-01",
    loadedDocument: {
      name: typeof window !== "undefined" ? localStorage.getItem("LOKI_ACTIVE_DOC_NAME") || localStorage.getItem("SWARMLENS_ACTIVE_DOC_NAME") || "No document loaded" : "No document loaded",
      pages: 12,
      status: "PARSED",
      lastExtracted: new Date().toLocaleDateString(),
    },
  };

  public setLoadedDocumentName(docName: string, scenarioName?: string): void {
    if (this.state.loadedDocument) {
      this.state.loadedDocument.name = docName;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("LOKI_ACTIVE_DOC_NAME", docName);
      localStorage.setItem("SWARMLENS_ACTIVE_DOC_NAME", docName);
      if (scenarioName) {
        localStorage.setItem("LOKI_ACTIVE_SCENARIO_NAME", scenarioName);
        localStorage.setItem("SWARMLENS_ACTIVE_SCENARIO_NAME", scenarioName);
      }
      window.dispatchEvent(new Event("loki_doc_updated"));
      window.dispatchEvent(new Event("swarmlens_doc_updated"));
    }
  }

  private getApiKeyHeader(): Record<string, string> {
    const keysHeader = keyService.getPrimaryOrFallbackKeysHeader();
    return keysHeader ? { "x-api-key": keysHeader } : {};
  }

  async getSimulationState(scenarioId: string = "scen-01"): Promise<SimulationState> {
    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/${scenarioId}/simulation`, {
        headers: { ...this.getApiKeyHeader() },
      });
      if (res.ok) {
        const data = await res.json();
        return {
          ...this.state,
          currentRound: data.currentRound ?? 3,
          totalRounds: data.totalRounds ?? 5,
          status: data.status ?? "IDLE",
        };
      }
    } catch (err) {
      console.warn("[SimulationAPI] Real backend status unavailable, using current state.");
    }
    return { ...this.state };
  }

  async playSimulation(scenarioId: string = "scen-01"): Promise<SimulationState> {
    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/${scenarioId}/simulation/play`, {
        method: "POST",
        headers: { ...this.getApiKeyHeader() },
      });
      if (res.ok) {
        const data = await res.json();
        this.state.status = data.status || "RUNNING";
        this.state.currentRound = data.currentRound || this.state.currentRound;
      }
    } catch (err) {
      this.state.status = "RUNNING";
    }
    return { ...this.state };
  }

  async pauseSimulation(scenarioId: string = "scen-01"): Promise<SimulationState> {
    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/${scenarioId}/simulation/pause`, {
        method: "POST",
        headers: { ...this.getApiKeyHeader() },
      });
      if (res.ok) {
        const data = await res.json();
        this.state.status = data.status || "PAUSED";
      }
    } catch (err) {
      this.state.status = "PAUSED";
    }
    return { ...this.state };
  }

  async stepSimulation(scenarioId: string = "scen-01"): Promise<SimulationState> {
    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/${scenarioId}/simulation/step`, {
        method: "POST",
        headers: { ...this.getApiKeyHeader() },
      });
      if (res.ok) {
        const data = await res.json();
        this.state.currentRound = data.currentRound;
        this.state.status = data.status;
      }
    } catch (err) {
      if (this.state.currentRound < this.state.totalRounds) {
        this.state.currentRound += 1;
      }
    }
    return { ...this.state };
  }

  async resetSimulation(scenarioId: string = "scen-01"): Promise<SimulationState> {
    try {
      await fetch(`${API_BASE_URL}/scenarios/${scenarioId}/simulation/reset`, {
        method: "POST",
        headers: { ...this.getApiKeyHeader() },
      });
    } catch (err) {
      // ignore
    }
    this.state.currentRound = 0;
    this.state.status = "IDLE";
    return { ...this.state };
  }

  async updateControls(params: SimulationControlParams): Promise<SimulationState> {
    if (params.speed) this.state.speed = params.speed;
    if (params.temperature !== undefined) this.state.temperature = params.temperature;
    if (params.round !== undefined) this.state.currentRound = params.round;
    return { ...this.state };
  }

  async getFeedEvents(scenarioId?: string): Promise<any[]> {
    const activeId =
      scenarioId ||
      (typeof window !== "undefined"
        ? localStorage.getItem("active_scenario_id") ||
          localStorage.getItem("SWARMLENS_ACTIVE_SCENARIO_ID") ||
          localStorage.getItem("LOKI_ACTIVE_SCENARIO_ID") ||
          "scen-01"
        : "scen-01");
    try {
      let res = await fetch(`${API_BASE_URL}/simulation/feed?scenario_id=${activeId}`, {
        headers: { ...this.getApiKeyHeader() },
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch(`${API_BASE_URL}/scenarios/${activeId}/events`, {
          headers: { ...this.getApiKeyHeader() },
        }).catch(() => null);
      }

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch (err) {
      console.warn("[SimulationAPI] Failed fetching live feed events:", err);
    }
    return [];
  }
}

export const simulationApi = new SimulationApiService();
