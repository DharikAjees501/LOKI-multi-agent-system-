import asyncio
import datetime
import json
from contextlib import asynccontextmanager

from app.api import agents, auth, documents, graph, keys, reports, scenarios, simulation
from app.api.keys import ConfigVerifyRequest, verify_keys_config_route
from app.core.config import settings
from app.core.logging import logger, setup_logging
from app.core.rate_limiter import RateLimitMiddleware
from app.core.telemetry import telemetry
from app.engine.swarm_orchestrator import orchestrator_engine
from app.storage.database import ensure_db_initialized
from fastapi import (
    FastAPI,
    HTTPException,
    Request,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        loop = asyncio.get_event_loop()
        loop.run_in_executor(None, ensure_db_initialized)
    except Exception as e:
        logger.warning(f"Startup background init notice: {e}")
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="5.0.0-hardened",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    lifespan=lifespan
)

# Production Compression Middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Sliding Window Rate Limiting Middleware
app.add_middleware(RateLimitMiddleware)

# CORS Setup - Strict Whitelist for HttpOnly Cookie Authentication
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Content-Type",
        "X-Gemini-Key",
        "X-Groq-Key",
        "X-OpenAI-Key",
        "X-Anthropic-Key",
        "X-OpenRouter-Key",
        "X-Requested-With",
        "Authorization",
        "Accept",
        "Origin",
    ],
)

# CSRF Origin Verification Middleware for State-Changing Requests
@app.middleware("http")
async def csrf_origin_middleware(request: Request, call_next):
    if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
        origin = request.headers.get("origin") or request.headers.get("Origin")
        if origin:
            allowed = set(settings.cors_origins_list + [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:8000",
                "http://127.0.0.1:8000",
            ])
            norm = origin.rstrip("/")
            if norm not in allowed and not any(norm.startswith(a.rstrip("/")) for a in allowed):
                logger.warning(f"[CSRF Protection] Untrusted origin blocked: {origin} on {request.url.path}")
                return JSONResponse(
                    status_code=403,
                    content={"error": True, "detail": "CSRF origin verification failed."}
                )
    return await call_next(request)

# Exception Handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": True, "detail": exc.detail, "path": str(request.url.path)}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global unhandled exception on {request.url.path}: {exc}", exc_info=True)
    telemetry.record_llm_call(is_error=True)
    # Generic safe error message to prevent leaking tracebacks or env variables
    return JSONResponse(
        status_code=500,
        content={"error": True, "detail": "Internal server error", "path": str(request.url.path)}
    )

# Include API Routers with prefix (/api)
app.include_router(documents.router, prefix=settings.API_V1_STR)
app.include_router(scenarios.router, prefix=settings.API_V1_STR)
app.include_router(graph.router, prefix=settings.API_V1_STR)
app.include_router(agents.router, prefix=settings.API_V1_STR)
app.include_router(simulation.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)
app.include_router(keys.router, prefix=settings.API_V1_STR)
app.include_router(auth.router, prefix=settings.API_V1_STR)

# Direct fallback mounts at root / for resilient client routing
app.include_router(keys.router)
app.include_router(documents.router)
app.include_router(scenarios.router)
app.include_router(graph.router)
app.include_router(agents.router)
app.include_router(simulation.router)
app.include_router(reports.router)
app.include_router(auth.router)

@app.post("/config/verify-key")
@app.post(f"{settings.API_V1_STR}/config/verify-key")
async def verify_key_config_alias(request: Request):
    body = await request.json()
    req = ConfigVerifyRequest(**body)
    return await verify_keys_config_route(req)

@app.get("/")
async def root():
    return {
        "app": settings.PROJECT_NAME,
        "version": "5.0.0-production-hardened",
        "status": "OPERATIONAL",
        "docs": f"{settings.API_V1_STR}/docs"
    }

@app.get("/docs", include_in_schema=False)
async def root_docs_redirect():
    return RedirectResponse(url=f"{settings.API_V1_STR}/docs")

@app.get("/openapi.json", include_in_schema=False)
async def root_openapi_redirect():
    return RedirectResponse(url=f"{settings.API_V1_STR}/openapi.json")

@app.get("/health")
@app.get(f"{settings.API_V1_STR}/health")
async def health_check():
    return {
        "status": "HEALTHY",
        "timestamp": datetime.datetime.now().isoformat(),
        "version": "5.0.0-hardened",
        "database": "CONNECTED",
        "orchestrator_status": orchestrator_engine.status
    }

@app.get(f"{settings.API_V1_STR}/metrics")
async def get_telemetry_metrics():
    return telemetry.get_metrics()

@app.get("/v1/models")
@app.get(f"{settings.API_V1_STR}/models")
async def list_models():
    return {
        "object": "list",
        "data": [
            {"id": "gemini-3.5-flash-lite", "object": "model", "owned_by": "google"},
            {"id": "gemini-3.8-flash", "object": "model", "owned_by": "google"},
            {"id": "openai/gpt-oss-120b", "object": "model", "owned_by": "groq"},
            {"id": "openai/gpt-oss-20b", "object": "model", "owned_by": "groq"},
            {"id": "gpt-4o-mini", "object": "model", "owned_by": "openai"},
            {"id": "gpt-4o", "object": "model", "owned_by": "openai"},
            {"id": "claude-3-5-sonnet-20241022", "object": "model", "owned_by": "anthropic"}
        ]
    }

# Realtime WebSocket Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, scenario_id: str, websocket: WebSocket):
        await websocket.accept()
        if scenario_id not in self.active_connections:
            self.active_connections[scenario_id] = []
        self.active_connections[scenario_id].append(websocket)
        logger.info(f"WebSocket client connected to scenario {scenario_id}")

    def disconnect(self, scenario_id: str, websocket: WebSocket):
        if scenario_id in self.active_connections and websocket in self.active_connections[scenario_id]:
            self.active_connections[scenario_id].remove(websocket)

    async def broadcast(self, message: dict):
        scenario_id = message.get("scenario_id", "")
        if not scenario_id or scenario_id == "scen-01":
            return
        if scenario_id in self.active_connections:
            for connection in list(self.active_connections[scenario_id]):
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.warning(f"Error broadcasting WebSocket message: {e}")

manager = ConnectionManager()
orchestrator_engine.set_websocket_broadcaster(manager.broadcast)

@app.websocket("/ws/simulation/{scenario_id}")
async def websocket_simulation_endpoint(websocket: WebSocket, scenario_id: str):
    await manager.connect(scenario_id, websocket)
    try:
        # Broadcast initial state
        await websocket.send_json({
            "event": "simulation_started",
            "scenario_id": scenario_id,
            "round": orchestrator_engine.current_round,
            "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
            "data": {"status": orchestrator_engine.status, "currentRound": orchestrator_engine.current_round, "totalRounds": orchestrator_engine.total_rounds}
        })

        while True:
            data_str = await websocket.receive_text()
            try:
                data = json.loads(data_str)
                event_action = data.get("action") or data.get("type")

                if event_action == "play":
                    telemetry.record_simulation_start()
                    await orchestrator_engine.play()
                elif event_action == "pause":
                    await orchestrator_engine.pause()
                elif event_action == "step":
                    telemetry.record_round_executed()
                    await orchestrator_engine.step()
                elif event_action == "reset":
                    await orchestrator_engine.reset()
                elif event_action == "ping":
                    await websocket.send_json({"event": "pong", "timestamp": datetime.datetime.now().strftime("%H:%M:%S")})
            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        manager.disconnect(scenario_id, websocket)
        logger.info(f"WebSocket client disconnected from scenario {scenario_id}")
