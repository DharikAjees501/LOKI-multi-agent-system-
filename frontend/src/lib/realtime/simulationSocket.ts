import { FeedEvent } from "@/types";

type EventCallback = (event: FeedEvent | any) => void;

function getWsBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  if (typeof window !== "undefined") {
    if (window.location.hostname.includes("onrender.com")) {
      return "wss://swarmlens-backend.onrender.com/ws/simulation";
    }
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.hostname}:8000/ws/simulation`;
  }
  return "ws://localhost:8000/ws/simulation";
}

const WS_BASE_URL = getWsBaseUrl();

class SimulationSocketService {
  private listeners: EventCallback[] = [];
  private socket: WebSocket | null = null;
  public isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private pingIntervalId: any = null;
  private activeScenarioId: string = "";

  connect(scenarioId?: string) {
    const targetId =
      scenarioId ||
      (typeof window !== "undefined"
        ? localStorage.getItem("SWARMLENS_ACTIVE_SCENARIO_ID") ||
          localStorage.getItem("LOKI_ACTIVE_SCENARIO_ID") ||
          ""
        : "");

    if (!targetId || targetId === "scen-01") {
      return;
    }
    this.activeScenarioId = targetId;

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.socket = new WebSocket(`${WS_BASE_URL}/${targetId}`);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log(`[SimulationSocket] Connected to FastAPI WebSocket endpoint /ws/simulation/${targetId}`);
        this.startHeartbeat();
      };

      this.socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          this.listeners.forEach((cb) => cb(parsed));
        } catch (e) {
          console.error("[SimulationSocket] Error parsing WebSocket message:", e);
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.stopHeartbeat();
        console.log("[SimulationSocket] Connection closed.");
        this.scheduleReconnect();
      };

      this.socket.onerror = (err) => {
        console.warn("[SimulationSocket] WebSocket error occurred:", err);
      };
    } catch (err) {
      console.warn("[SimulationSocket] Initialization failed:", err);
      this.scheduleReconnect();
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingIntervalId = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ action: "ping" }));
      }
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
      console.log(`[SimulationSocket] Reconnecting in ${(delay / 1000).toFixed(1)}s (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => {
        this.connect(this.activeScenarioId);
      }, delay);
    }
  }

  disconnect() {
    this.isConnected = false;
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  subscribe(callback: EventCallback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  send(data: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  emitMockEvent(event: FeedEvent) {
    this.listeners.forEach((cb) => cb(event));
  }
}

export const simulationSocket = new SimulationSocketService();
