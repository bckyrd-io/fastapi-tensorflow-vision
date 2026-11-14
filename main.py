"""ZoneMatrix FastAPI backend - converted from green-matrix/app/api (Next.js).

Run with:
    .venv\\Scripts\\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000

The Expo web dev server talks to this API directly; native clients use the
EXPO_PUBLIC_API_URL value from green-matrix/.env.
"""

from __future__ import annotations

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from api import (
    alerts,
    auth,
    reports,
    sensors,
    triggers,
    users,
    vision,
    zone_configs,
    zones,
)
from api import db

os.makedirs("uploads/frames", exist_ok=True)

app = FastAPI(
    title="ZoneMatrix API",
    description="Multi-Zone Smart Farm Automation & AI Vision Backend",
    version="3.0.0",
)

# Same permissive CORS the Next.js dev server effectively had
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for captured camera frames
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(zones.router)
app.include_router(zone_configs.router)
app.include_router(vision.router)
app.include_router(sensors.router)
app.include_router(triggers.router)
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
        "service": "ZoneMatrix API",
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
