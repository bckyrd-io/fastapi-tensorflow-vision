"""Zone configuration routes - per-zone thresholds and device metadata."""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

from api import db
from api.errors import api_error, js_number

router = APIRouter(prefix="/api/zone-configs", tags=["zone-configs"])


class ZoneConfigBody(BaseModel):
    zone_id: str | None = None
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


def create_zone_alert(zone_id: str, message: str, source: str = "config") -> None:
    try:
        db.execute(
            "INSERT INTO alerts (zone_id, type, message, source, status, created_at) "
            "VALUES (?, ?, ?, ?, 'active', NOW())",
            [zone_id, "info", message, source],
        )
    except Exception as exc:
        print(f"Failed to create alert: {exc}")


@router.get("")
async def get_zone_configs(request: Request):
    """GET /api/zone-configs - one config, all configs, or aggregated thresholds."""
    zone_id = request.query_params.get("zone_id")
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
                FROM zone_configs
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

        if zone_id:
            configs = db.query("SELECT * FROM zone_configs WHERE zone_id = ?", [zone_id])
            if not configs:
                return api_error(404, "Configuration not found")
            return {"config": configs[0]}

        configs = db.query("SELECT * FROM zone_configs")
        return {"configs": configs}
    except Exception as exc:
        print(f"Zone configs GET error: {exc}")
        return api_error(500, "Failed to fetch zone configurations")


@router.put("")
async def upsert_zone_config(body: ZoneConfigBody):
    """PUT /api/zone-configs - create or update the thresholds for a zone."""
    try:
        zone_id = body.zone_id
        if not zone_id:
            return api_error(400, "Missing zone_id")

        existing = db.query(
            "SELECT zone_id FROM zone_configs WHERE zone_id = ?", [zone_id]
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
                f"UPDATE zone_configs SET {assignments} WHERE zone_id = ?",
                [*values, zone_id],
            )
        else:
            placeholders = ", ".join("?" for _ in fields)
            columns = ", ".join(fields)
            db.execute(
                f"INSERT INTO zone_configs (zone_id, {columns}) VALUES (?, {placeholders})",
                [zone_id, *values],
            )

        create_zone_alert(
            zone_id,
            "Zone configuration updated" if existing else "New zone configuration created",
            "config",
        )

        return {"success": True, "message": "Zone configuration saved successfully"}
    except Exception as exc:
        print(f"Zone config PUT error: {exc}")
        return api_error(500, "Failed to save zone configuration")

