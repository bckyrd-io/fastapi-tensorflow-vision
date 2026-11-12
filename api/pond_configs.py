"""Pond configuration routes - port of green-matrix/app/api/pond-configs/route.ts."""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

from api import db
from api.errors import api_error, js_number

router = APIRouter(prefix="/api/pond-configs", tags=["pond-configs"])


class PondConfigBody(BaseModel):
    pond_id: str | None = None
    temp_min: float | str | None = None
    temp_optimal: float | str | None = None
    temp_max: float | str | None = None
    ph_min: float | str | None = None
    ph_optimal: float | str | None = None
    ph_max: float | str | None = None
    humidity_min: float | str | None = None
    humidity_optimal: float | str | None = None
    humidity_max: float | str | None = None
    water_level_min: float | str | None = None
    water_level_optimal: float | str | None = None
    water_level_max: float | str | None = None
    device_id: str | None = None
    device_name: str | None = None
    device_mac: str | None = None


def create_alert(pond_id: str, message: str, source: str = "config") -> None:
    try:
        db.execute(
            "INSERT INTO alerts (pond_id, type, message, source, status, created_at) "
            "VALUES (?, ?, ?, ?, 'active', NOW())",
            [pond_id, "info", message, source],
        )
    except Exception as exc:
        print(f"Failed to create alert: {exc}")


@router.get("")
async def get_configs(request: Request):
    """GET /api/pond-configs - one config, all configs, or aggregated thresholds."""
    pond_id = request.query_params.get("pond_id")
    aggregate = request.query_params.get("aggregate")

    try:
        if aggregate == "true":
            configs = db.query(
                """
                SELECT
                  MIN(temp_min) as temp_min,
                  AVG(temp_optimal) as temp_optimal,
                  MAX(temp_max) as temp_max,
                  MIN(ph_min) as ph_min,
                  AVG(ph_optimal) as ph_optimal,
                  MAX(ph_max) as ph_max,
                  MIN(humidity_min) as humidity_min,
                  AVG(humidity_optimal) as humidity_optimal,
                  MAX(humidity_max) as humidity_max,
                  MIN(water_level_min) as water_level_min,
                  AVG(water_level_optimal) as water_level_optimal,
                  MAX(water_level_max) as water_level_max
                FROM pond_configs
                """
            )
            data = configs[0] if configs else None

            if not data or data.get("temp_min") in (None, ""):
                return {"thresholds": None}

            return {
                "thresholds": {
                    "temperature": {
                        "min": js_number(data["temp_min"]),
                        "optimal": js_number(data["temp_optimal"]),
                        "max": js_number(data["temp_max"]),
                    },
                    "ph": {
                        "min": js_number(data["ph_min"]),
                        "optimal": js_number(data["ph_optimal"]),
                        "max": js_number(data["ph_max"]),
                    },
                    "humidity": {
                        "min": js_number(data["humidity_min"]),
                        "optimal": js_number(data["humidity_optimal"]),
                        "max": js_number(data["humidity_max"]),
                    },
                    "waterLevel": {
                        "min": js_number(data["water_level_min"]),
                        "optimal": js_number(data["water_level_optimal"]),
                        "max": js_number(data["water_level_max"]),
                    },
                }
            }

        if pond_id:
            configs = db.query("SELECT * FROM pond_configs WHERE pond_id = ?", [pond_id])
            if not configs:
                return api_error(404, "Configuration not found")
            return {"config": configs[0]}

        configs = db.query("SELECT * FROM pond_configs")
        return {"configs": configs}
    except Exception as exc:
        print(f"Pond configs GET error: {exc}")
        return api_error(500, "Failed to fetch pond configurations")


@router.put("")
async def upsert_config(body: PondConfigBody):
    """PUT /api/pond-configs - create or update the thresholds for a pond."""
    try:
        if not body.pond_id:
            return api_error(400, "Missing pond_id")

        existing = db.query(
            "SELECT pond_id FROM pond_configs WHERE pond_id = ?", [body.pond_id]
        )

        fields = [
            "temp_min", "temp_optimal", "temp_max",
            "ph_min", "ph_optimal", "ph_max",
            "humidity_min", "humidity_optimal", "humidity_max",
            "water_level_min", "water_level_optimal", "water_level_max",
            "device_id", "device_name", "device_mac",
        ]
        values = [getattr(body, field) for field in fields]

        if existing:
            assignments = ", ".join(f"{field} = ?" for field in fields)
            db.execute(
                f"UPDATE pond_configs SET {assignments} WHERE pond_id = ?",
                [*values, body.pond_id],
            )
        else:
            placeholders = ", ".join("?" for _ in fields)
            columns = ", ".join(fields)
            db.execute(
                f"INSERT INTO pond_configs (pond_id, {columns}) VALUES (?, {placeholders})",
                [body.pond_id, *values],
            )

        create_alert(
            body.pond_id,
            "Pond configuration updated" if existing else "New pond configuration created",
            "config",
        )

        return {"success": True, "message": "Pond configuration saved successfully"}
    except Exception as exc:
        print(f"Pond config PUT error: {exc}")
        return api_error(500, "Failed to save pond configuration")
