import time
from typing import Dict, List, Tuple, Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

try:
    from app.core.config import settings
    from app.core.logging import logger
except ImportError:
    from backend.app.core.config import settings
    from backend.app.core.logging import logger

class SlidingWindowRateLimiter:
    def __init__(self, requests_per_minute: int = settings.RATE_LIMIT_PER_MINUTE):
        self.requests_per_minute = requests_per_minute
        self.window_seconds = 60
        # Map client_ip -> list of timestamps
        self.requests: Dict[str, List[float]] = {}

    def is_allowed(self, client_ip: str, limit_override: Optional[int] = None) -> Tuple[bool, int]:
        now = time.time()
        limit = limit_override or self.requests_per_minute

        if client_ip not in self.requests:
            self.requests[client_ip] = []

        # Remove timestamps older than window
        cutoff = now - self.window_seconds
        self.requests[client_ip] = [ts for ts in self.requests[client_ip] if ts > cutoff]

        if len(self.requests[client_ip]) >= limit:
            remaining = 0
            return False, remaining

        self.requests[client_ip].append(now)
        remaining = limit - len(self.requests[client_ip])
        return True, remaining

rate_limiter = SlidingWindowRateLimiter()

class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Exclude CORS OPTIONS preflight, static routes, docs, and health checks
        path = request.url.path
        if request.method == "OPTIONS" or path in ("/", "/api/docs", "/api/openapi.json", "/api/health", "/api/metrics") or path.startswith("/ws/"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "127.0.0.1"
        is_local = client_ip in ("127.0.0.1", "::1", "localhost", "testclient")
        limit = 5000 if is_local else (settings.UPLOAD_RATE_LIMIT_PER_MINUTE if "/upload" in path else settings.RATE_LIMIT_PER_MINUTE)

        allowed, remaining = rate_limiter.is_allowed(client_ip, limit_override=limit)

        if not allowed:
            logger.warning(f"Rate limit exceeded for IP {client_ip} on path {path}")
            return Response(
                content='{"error": true, "detail": "Rate limit exceeded. Too many requests. Please wait before retrying."}',
                status_code=429,
                media_type="application/json",
                headers={
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                    "Retry-After": "60",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                    "Access-Control-Allow-Headers": "*"
                }
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
