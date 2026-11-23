import { SimulationState } from "@/types";
import { keyService } from "./keyService";
import { authService } from "./authService";
import { API_BASE_URL } from "./baseUrl";

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
    activeScenarioId: "",
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

  private getRequestHeaders(): Record<string, string> {
    const authHeaders = authService.getAuthHeaders();
    const byokHeaders = keyService.getBYOKHeaders();
    return {
      ...authHeaders,
      ...byokHeaders,
    };
  }

  async getSimulationState(scenarioId?: string): Promise<SimulationState> {
    const targetScenId =
      scenarioId ||
      (typeof window !== "undefined"
        ? localStorage.getItem("SWARMLENS_ACTIVE_SCENARIO_ID") ||
          localStorage.getItem("LOKI_ACTIVE_SCENARIO_ID") ||
          ""
        : "");

    if (!targetScenId || targetScenId === "scen-01") {
      return { ...this.state };
    }

    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/${targetScenId}/simulation`, {
        credentials: "include",
        headers: { ...this.getRequestHeaders() },
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

  private resolveScenarioId(scenarioId?: string): string {
    const id =
      scenarioId ||
      (typeof window !== "undefined"
        ? localStorage.getItem("SWARMLENS_ACTIVE_SCENARIO_ID") ||
          localStorage.getItem("LOKI_ACTIVE_SCENARIO_ID") ||
          ""
        : "");
    return id === "scen-01" ? "" : id;
  }

  async playSimulation(scenarioId?: string): Promise<SimulationState> {
    const targetScenId = this.resolveScenarioId(scenarioId);
    if (!targetScenId) {
      this.state.status = "RUNNING";
      return { ...this.state };
    }
    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/${targetScenId}/simulation/play`, {
        method: "POST",
        credentials: "include",
        headers: { ...this.getRequestHeaders() },
      });
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        const msg = data.detail || "API Key required for unlimited simulations.";
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("loki_quota_exceeded", { detail: { message: msg } }));
        }
        throw new Error(msg);
      }
      if (res.ok) {
        const data = await res.json();
        this.state.status = data.status || "RUNNING";
        this.state.currentRound = data.currentRound || this.state.currentRound;
        authService.fetchCurrentUser().catch(() => {});
      }
    } catch (err: any) {
      this.state.status = "RUNNING";
    }
    return { ...this.state };
  }

  async pauseSimulation(scenarioId?: string): Promise<SimulationState> {
    const targetScenId = this.resolveScenarioId(scenarioId);
    this.state.status = "PAUSED";
    if (!targetScenId) {
      return { ...this.state };
    }
    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/${targetScenId}/simulation/pause`, {
        method: "POST",
        credentials: "include",
        headers: { ...this.getRequestHeaders() },
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

  async stepSimulation(scenarioId?: string): Promise<SimulationState> {
    const targetScenId = this.resolveScenarioId(scenarioId);
    if (!targetScenId) {
      if (this.state.currentRound < this.state.totalRounds) {
        this.state.currentRound += 1;
      }
      return { ...this.state };
    }
    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/${targetScenId}/simulation/step`, {
        method: "POST",
        credentials: "include",
        headers: { ...this.getRequestHeaders() },
      });
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        const msg = data.detail || "API Key required for unlimited simulations.";
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("loki_quota_exceeded", { detail: { message: msg } }));
        }
        throw new Error(msg);
      }
      if (res.ok) {
        const data = await res.json();
        this.state.status = data.status || "RUNNING";
        this.state.currentRound = data.currentRound || (this.state.currentRound + 1);
        authService.fetchCurrentUser().catch(() => {});
      }
    } catch (err) {
      if (this.state.currentRound < this.state.totalRounds) {
        this.state.currentRound += 1;
      }
    }
    return { ...this.state };
  }

  async resetSimulation(scenarioId?: string): Promise<SimulationState> {
    const targetScenId = this.resolveScenarioId(scenarioId);
    if (targetScenId) {
      try {
        await fetch(`${API_BASE_URL}/scenarios/${targetScenId}/simulation/reset`, {
          method: "POST",
          credentials: "include",
          headers: { ...this.getRequestHeaders() },
        });
      } catch (err) {
        // ignore
      }
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
    const activeId = this.resolveScenarioId(scenarioId);
    if (!activeId) return [];
    try {
      let res = await fetch(`${API_BASE_URL}/simulation/feed?scenario_id=${activeId}`, {
        credentials: "include",
        headers: { ...this.getRequestHeaders() },
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch(`${API_BASE_URL}/scenarios/${activeId}/events`, {
          credentials: "include",
          headers: { ...this.getRequestHeaders() },
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
