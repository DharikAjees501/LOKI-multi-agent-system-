import { Scenario } from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

class ScenarioApiService {
  async getScenarios(): Promise<Scenario[]> {
    const urls = [
      `${API_BASE_URL}/scenarios`,
      "http://127.0.0.1:8000/api/scenarios",
      "http://localhost:8000/api/scenarios",
    ];
    for (const url of Array.from(new Set(urls))) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          return data.map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description || "Forecasting environment",
            documentName: item.documentName || item.document_id || "No document loaded",
            createdDate: item.createdDate || new Date().toISOString().split("T")[0],
            lastSimulation: item.lastSimulation || "Never",
            status: item.status || "READY",
            agentCount: item.agentCount || 50,
            overallRiskScore: item.overallRiskScore || 50,
          }));
        }
      } catch (err) {
        // try fallback
      }
    }
    return [];
  }

  async createScenario(payload: { name: string; description: string; documentId?: string }): Promise<Scenario | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/scenarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: payload.name,
          description: payload.description,
          document_id: payload.documentId || "",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          id: data.id,
          name: data.name,
          description: data.description,
          documentName: data.documentName || "No document loaded",
          createdDate: data.createdDate || new Date().toISOString().split("T")[0],
          lastSimulation: data.lastSimulation || "Never",
          status: "READY",
          agentCount: 50,
          overallRiskScore: 50,
        };
      }
    } catch (err) {
      console.warn("[ScenarioAPI] Failed to create scenario on backend.", err);
    }
    return null;
  }

  async deleteScenario(id: string): Promise<boolean> {
    const candidateUrls = [
      `${API_BASE_URL}/scenarios/${id}`,
      `http://127.0.0.1:8000/api/scenarios/${id}`,
      `http://localhost:8000/api/scenarios/${id}`,
    ];
    const uniqueUrls = Array.from(new Set(candidateUrls));

    for (const url of uniqueUrls) {
      try {
        const res = await fetch(url, {
          method: "DELETE",
        });
        if (res.ok) {
          return true;
        }
      } catch (err) {
        // Continue to fallback candidate
      }
    }
    return true;
  }

  async extractGraph(id: string, documentId?: string): Promise<any> {
    try {
      const url = documentId
        ? `${API_BASE_URL}/scenarios/${id}/extract?document_id=${encodeURIComponent(documentId)}`
        : `${API_BASE_URL}/scenarios/${id}/extract`;
      const res = await fetch(url, { method: "POST" });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn(`[ScenarioAPI] Failed to extract graph for scenario ${id}:`, err);
    }
    return null;
  }

  async runBaselineSimulation(id: string, payload?: { goal_prompt?: string }): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/${id}/run-baseline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal_prompt: payload?.goal_prompt || "Evaluate baseline strategy operational impact",
          is_what_if: false,
        }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn(`[ScenarioAPI] Failed to run baseline simulation for ${id}:`, err);
    }
    return null;
  }

  async runWhatIfSimulation(id: string, payload: { goal_prompt: string; shock_event?: string; risk_threshold?: number }): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/${id}/run-what-if`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal_prompt: payload.goal_prompt,
          shock_event: payload.shock_event,
          risk_threshold: payload.risk_threshold || 40.0,
        }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn(`[ScenarioAPI] Failed to run what-if simulation for ${id}:`, err);
    }
    return null;
  }

  async createAndRunScenario(payload: { name: string; description?: string; documentId?: string; isWhatIf?: boolean }): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/create-and-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: payload.name,
          description: payload.description || "Evaluate strategic risk and stakeholder alignment",
          document_id: payload.documentId || "doc-default",
          is_what_if: payload.isWhatIf || false,
        }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn(`[ScenarioAPI] Failed to create and run scenario:`, err);
    }
    return null;
  }
}

export function getActiveScenarioId(): string {
  if (typeof window === "undefined") return "";
  if (localStorage.getItem("SWARMLENS_MANUALLY_CLEARED") === "true") {
    return "";
  }
  return (
    localStorage.getItem("SWARMLENS_ACTIVE_SCENARIO_ID") ||
    localStorage.getItem("LOKI_ACTIVE_SCENARIO_ID") ||
    localStorage.getItem("active_scenario_id") ||
    ""
  );
}

export function getActiveDocName(): string | null {
  if (typeof window === "undefined") return null;
  if (localStorage.getItem("SWARMLENS_MANUALLY_CLEARED") === "true") {
    return null;
  }
  const doc =
    localStorage.getItem("SWARMLENS_ACTIVE_DOC_NAME") ||
    localStorage.getItem("LOKI_ACTIVE_DOC_NAME");
  if (doc && doc.trim().length > 0 && doc !== "No document loaded") {
    return doc;
  }
  return null;
}

export function setActiveScenarioContext(
  scenarioId: string,
  docName?: string,
  scenarioName?: string,
  scenarioDesc?: string
): void {
  if (typeof window === "undefined") return;
  const validDoc =
    docName && docName !== "No document loaded"
      ? docName
      : scenarioName
      ? `${scenarioName.replace(/\s+/g, "_")}.pdf`
      : "Strategy_Document.pdf";
  const validScenName = scenarioName || "Custom Strategy Scenario";
  const validScenDesc = scenarioDesc || "Strategy forecasting and multi-agent risk simulation";

  const prevId = localStorage.getItem("active_scenario_id") || localStorage.getItem("SWARMLENS_ACTIVE_SCENARIO_ID");
  const prevDoc = localStorage.getItem("SWARMLENS_ACTIVE_DOC_NAME");
  const isChanged = prevId !== scenarioId || prevDoc !== validDoc;

  localStorage.setItem("SWARMLENS_ACTIVE_SCENARIO_ID", scenarioId);
  localStorage.setItem("LOKI_ACTIVE_SCENARIO_ID", scenarioId);
  localStorage.setItem("active_scenario_id", scenarioId);

  localStorage.setItem("SWARMLENS_ACTIVE_DOC_NAME", validDoc);
  localStorage.setItem("LOKI_ACTIVE_DOC_NAME", validDoc);

  localStorage.setItem("SWARMLENS_ACTIVE_SCENARIO_NAME", validScenName);
  localStorage.setItem("LOKI_ACTIVE_SCENARIO_NAME", validScenName);

  localStorage.setItem("SWARMLENS_ACTIVE_SCENARIO_DESC", validScenDesc);
  localStorage.setItem("LOKI_ACTIVE_SCENARIO_DESC", validScenDesc);

  localStorage.removeItem("SWARMLENS_MANUALLY_CLEARED");

  if (isChanged) {
    setTimeout(() => {
      window.dispatchEvent(new Event("swarmlens_doc_updated"));
      window.dispatchEvent(new Event("loki_doc_updated"));
      window.dispatchEvent(new Event("scenario_changed"));
    }, 20);
  }
}

export function clearActiveScenarioContext(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("SWARMLENS_MANUALLY_CLEARED", "true");
  localStorage.removeItem("SWARMLENS_ACTIVE_DOC_NAME");
  localStorage.removeItem("LOKI_ACTIVE_DOC_NAME");
  localStorage.removeItem("SWARMLENS_ACTIVE_SCENARIO_NAME");
  localStorage.removeItem("LOKI_ACTIVE_SCENARIO_NAME");
  localStorage.removeItem("SWARMLENS_ACTIVE_SCENARIO_DESC");
  localStorage.removeItem("LOKI_ACTIVE_SCENARIO_DESC");
  localStorage.removeItem("SWARMLENS_ACTIVE_SCENARIO_ID");
  localStorage.removeItem("LOKI_ACTIVE_SCENARIO_ID");
  localStorage.removeItem("active_scenario_id");

  localStorage.setItem("SWARMLENS_CURRENT_ROUND", "1");
  localStorage.setItem("LOKI_CURRENT_ROUND", "1");
  localStorage.setItem("SWARMLENS_SIM_STATUS", "IDLE");
  localStorage.setItem("LOKI_SIM_STATUS", "IDLE");

  setTimeout(() => {
    window.dispatchEvent(new Event("swarmlens_doc_updated"));
    window.dispatchEvent(new Event("loki_doc_updated"));
    window.dispatchEvent(new Event("scenario_changed"));
  }, 0);
}

export async function deleteActiveScenarioAndDoc(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const currentScenId = getActiveScenarioId();
  const currentDoc = getActiveDocName();

  try {
    if (currentScenId) {
      await scenarioApi.deleteScenario(currentScenId);
    }
    if (currentDoc) {
      const docUrls = [
        `${API_BASE_URL}/documents/${encodeURIComponent(currentDoc)}`,
        `http://127.0.0.1:8000/api/documents/${encodeURIComponent(currentDoc)}`,
        `http://localhost:8000/api/documents/${encodeURIComponent(currentDoc)}`,
      ];
      for (const dUrl of Array.from(new Set(docUrls))) {
        try {
          const res = await fetch(dUrl, { method: "DELETE" });
          if (res.ok) break;
        } catch (_) {}
      }
    }
  } catch (e) {
    // Proceed with clean local storage reset
  }

  clearActiveScenarioContext();
  return true;
}

let activeInitPromise: Promise<Scenario | null> | null = null;

export async function autoInitializeActiveScenario(): Promise<Scenario | null> {
  if (typeof window === "undefined") return null;
  if (localStorage.getItem("SWARMLENS_MANUALLY_CLEARED") === "true") {
    return null;
  }
  if (activeInitPromise) return activeInitPromise;

  activeInitPromise = (async () => {
    try {
      const currentDoc = getActiveDocName();
      const currentScenId = getActiveScenarioId();

      const scenarios = await scenarioApi.getScenarios();
      if (!scenarios || scenarios.length === 0) return null;

      // If current scenario exists in backend list, keep it and ensure documentName is clean
      const existing = scenarios.find((s) => s.id === currentScenId);
      if (existing) {
        const resolvedDoc =
          currentDoc ||
          (existing.documentName && existing.documentName !== "No document loaded"
            ? existing.documentName
            : `${existing.name.replace(/\s+/g, "_")}.pdf`);
        
        if (["COMPLETED", "BASELINE_COMPLETED", "WHAT_IF_COMPLETED"].includes(existing.status)) {
          localStorage.setItem("SWARMLENS_CURRENT_ROUND", "5");
          localStorage.setItem("LOKI_CURRENT_ROUND", "5");
          localStorage.setItem("SWARMLENS_SIM_STATUS", "COMPLETED");
          localStorage.setItem("LOKI_SIM_STATUS", "COMPLETED");
        }
        
        if (currentScenId !== existing.id || currentDoc !== resolvedDoc) {
          setActiveScenarioContext(existing.id, resolvedDoc, existing.name, existing.description);
        }
        return { ...existing, documentName: resolvedDoc };
      }

      // Otherwise, select the latest scenario available
      const latest = scenarios[0];
      const latestDoc =
        latest.documentName && latest.documentName !== "No document loaded"
          ? latest.documentName
          : `${latest.name.replace(/\s+/g, "_")}.pdf`;

      if (["COMPLETED", "BASELINE_COMPLETED", "WHAT_IF_COMPLETED"].includes(latest.status)) {
        localStorage.setItem("SWARMLENS_CURRENT_ROUND", "5");
        localStorage.setItem("LOKI_CURRENT_ROUND", "5");
        localStorage.setItem("SWARMLENS_SIM_STATUS", "COMPLETED");
        localStorage.setItem("LOKI_SIM_STATUS", "COMPLETED");
      }

      setActiveScenarioContext(latest.id, latestDoc, latest.name, latest.description);
      return { ...latest, documentName: latestDoc };
    } catch (err) {
      console.warn("[ScenarioAPI] Auto-initialize error:", err);
      return null;
    } finally {
      activeInitPromise = null;
    }
  })();

  return activeInitPromise;
}

export const scenarioApi = new ScenarioApiService();

