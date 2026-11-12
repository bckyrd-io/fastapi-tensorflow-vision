"""AquaMonitor FastAPI backend - converted from green-matrix/app/api (Next.js).

Run with:
    .venv\\Scripts\\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000

The Next.js dev server proxies every /api/* request here via a rewrite in
green-matrix/next.config.ts, so the frontend never talks to port 8000 directly.
"""

from __future__ import annotations

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api import (
    alerts,
    auth,
    feeding,
    ponds,
    pond_configs,
    reports,
    sensors,
    users,
)
from api import db

app = FastAPI(
    title="AquaMonitor API",
    description="FastAPI port of the Next.js API routes in green-matrix/app/api",
    version="1.0.0",
)

# Same permissive CORS the Next.js dev server effectively had (same-origin via
# the rewrite in production, but keep the simulator/scripts working too).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers - each mounts the exact same /api/... paths Next.js served.
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(ponds.router)
app.include_router(pond_configs.router)
app.include_router(sensors.router)
app.include_router(feeding.router)
app.include_router(alerts.router)
app.include_router(reports.router)


@app.on_event("startup")
def on_startup() -> None:
    db.test_connection()


@app.on_event("shutdown")
def on_shutdown() -> None:
    db.close_pool()


@app.get("/")
async def root():
    return {
        "service": "AquaMonitor FastAPI",
        "status": "running",
        "api_prefix": "/api",
    }


@app.get("/api/health")
async def health():
    """Lightweight health probe for the dev script / simulator startup checks."""
    connected = db.test_connection()
    return {"success": connected, "database": "up" if connected else "down"}


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def fallback(path: str, request: Request):
    """404 for anything unmapped, shaped like the Next.js API's error body."""
    return JSONResponse(
        status_code=404,
        content={"error": f"Not found: /{path}"},
    )


if __name__ == "__main__":
    import uvicorn

    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=False)
