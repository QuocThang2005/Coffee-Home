# Coffee Home — API backend (FastAPI, cổng 8010)
import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from time import time
from collections import defaultdict

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .db import init_db
from .routes import _active_ws, _ws_lock, router

logging.basicConfig(level=logging.INFO)

IS_PROD = os.environ.get("COFFEE_ENV", "").lower() in ("prod", "production")


# ---------- in-memory rate limiter (no external deps) ----------

class _RateLimiter:
    """Simple sliding-window rate limiter. {key: [timestamp, ...]}."""

    def __init__(self):
        self._hits: dict[str, list[float]] = defaultdict(list)

    def is_limited(self, key: str, limit: int, window: int) -> bool:
        now = time()
        cutoff = now - window
        hits = self._hits[key]
        self._hits[key] = [t for t in hits if t > cutoff]
        if len(self._hits[key]) >= limit:
            return True
        self._hits[key].append(now)
        return False

    def retry_after(self, key: str, window: int) -> int:
        hits = self._hits.get(key, [])
        if hits:
            return max(1, int(window - (time() - hits[0]) + 1))
        return 1


_limiter = _RateLimiter()


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@asynccontextmanager
async def lifespan(_: FastAPI):
    import asyncio
    from .routes import _set_main_loop
    _set_main_loop(asyncio.get_event_loop())
    init_db()
    yield

    logging.getLogger("uvicorn.access").info("Coffee Home API shut down.")


app = FastAPI(
    title="Coffee Home API",
    version="1.0.0",
    description="Backend cho website Coffee Home — phục vụ frontend tại cổng 5174",
    lifespan=lifespan,
    docs_url="/docs" if os.environ.get("COFFEE_ENV", "").lower() not in ("prod", "production") else None,
    redoc_url=None,
)

# ---------- CORS ----------
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "").strip()
if ALLOWED_ORIGINS:
    _origins = [o.strip() for o in ALLOWED_ORIGINS.split(",") if o.strip()]
else:
    _origins = [
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
    max_age=600,
)

# ---------- Security headers ----------

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if os.environ.get("COFFEE_ENV", "").lower() in ("prod", "production"):
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# ---------- Rate limiting middleware ----------

RATE_LIMITS = {
    "/api/auth/login":    (5, 60),    # 5 req / 60s
    "/api/auth/register": (3, 60),    # 3 req / 60s
    "/api/orders":        (10, 60),   # 10 req / 60s
    "/api/bookings":      (5, 60),    # 5 req / 60s
    "/api/feedbacks":     (3, 60),    # 3 req / 60s
    "/api/applications":  (3, 60),    # 3 req / 60s
}


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.method not in ("POST", "PATCH", "DELETE"):
        return await call_next(request)
    path = request.url.path
    for pattern, (limit, window) in RATE_LIMITS.items():
        if path == pattern or (pattern.endswith("/") and path.startswith(pattern)):
            key = f"{_client_ip(request)}:{pattern}"
            if _limiter.is_limited(key, limit, window):
                retry = _limiter.retry_after(key, window)
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Quá nhiều yêu cầu. Thử lại sau vài giây."},
                    headers={"Retry-After": str(retry)},
                )
            break
    return await call_next(request)


app.include_router(router)

# WebSocket: màn hình Admin/Bếp nhận sự kiện real-time
@app.websocket("/ws/admin")
async def ws_admin(ws: WebSocket):
    await ws.accept()
    async with _ws_lock:
        _active_ws.add(ws)
    try:
        while True:
            await ws.receive_text()  # giữ kết nối; client không gửi gì
    except WebSocketDisconnect:
        pass
    finally:
        async with _ws_lock:
            _active_ws.discard(ws)

# thư mục ảnh người dùng tải lên (đơn hàng, avatar…)
UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.exception_handler(ValueError)
async def value_error_handler(_: Request, exc: ValueError):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.get("/")
def root():
    return {"service": "Coffee Home API", "docs": "/docs", "health": "/api/health"}


# ---------- Serve frontend dist in production ----------

if os.environ.get("COFFEE_ENV", "").lower() in ("prod", "production"):
    from fastapi.staticfiles import StaticFiles

    dist_dir = Path(__file__).resolve().parents[2] / "dist"
    if dist_dir.is_dir():
        # Mount static assets (JS, CSS, images) with cache headers
        _static = StaticFiles(directory=str(dist_dir))
        # SPA fallback: serve index.html for unmatched routes
        from starlette.responses import FileResponse

        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str):
            file = dist_dir / full_path
            if file.is_file():
                return FileResponse(str(file))
            return FileResponse(str(dist_dir / "index.html"))

        logging.getLogger("uvicorn.access").info(
            f"Serving frontend from {dist_dir}"
        )
    else:
        logging.getLogger("uvicorn.access").warning(
            f"dist/ not found at {dist_dir} — frontend not served"
        )
