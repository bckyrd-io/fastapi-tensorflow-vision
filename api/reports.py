"""Report statistics route for ZoneMatrix."""

from __future__ import annotations

from fastapi import APIRouter, Request

from api import db
from api.errors import api_error

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _value(row: dict, key: str):
    """Replicates JS ``stats.key || 0`` (pg returned NUMERIC as a string)."""
    value = row.get(key)
    return value if value is not None else 0


def _as_number(value) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _temp_status(avg: float) -> str:
    if 24 <= avg <= 28:
        return "Optimal"
    if 22 <= avg < 24:
        return "Normal"
    if 28 < avg <= 30:
        return "Normal"
    return "Warning"


def _ph_status(avg: float) -> str:
    if 6.8 <= avg <= 7.5:
        return "Optimal"
    if 6.5 <= avg < 6.8:
        return "Normal"
    if 7.5 < avg <= 8.0:
        return "Normal"
    return "Warning"


def _humidity_status(avg: float) -> str:
    if 60 <= avg <= 80:
        return "Optimal"
    if 50 <= avg < 60:
        return "Normal"
    if 80 < avg <= 90:
        return "Normal"
    return "Warning"


def _water_level_status(avg: float) -> str:
    if 1.4 <= avg <= 1.8:
        return "Optimal"
    if 1.2 <= avg < 1.4:
        return "Normal"
    if 1.8 < avg <= 2.0:
        return "Normal"
    return "Warning"


@router.get("/stats")
async def report_stats(request: Request):
    """GET /api/reports/stats - aggregated sensor statistics for the reports page."""
    try:
        hours = int(request.query_params.get("hours") or 168)

        rows = db.query(
            """
            SELECT
              ROUND(AVG(temperature), 1) as avg_temp,
              ROUND(MIN(temperature), 1) as min_temp,
              ROUND(MAX(temperature), 1) as max_temp,
              ROUND(AVG(ph), 2) as avg_ph,
              ROUND(MIN(ph), 2) as min_ph,
              ROUND(MAX(ph), 2) as max_ph,
              ROUND(AVG(humidity)) as avg_humidity,
              MIN(humidity) as min_humidity,
              MAX(humidity) as max_humidity,
              ROUND(AVG(water_level), 2) as avg_water_level,
              ROUND(MIN(water_level), 2) as min_water_level,
              ROUND(MAX(water_level), 2) as max_water_level,
              COUNT(*) as total_readings,
              COUNT(DISTINCT zone_id) as zone_count
            FROM sensor_readings
            WHERE reading_time > NOW() - (? * INTERVAL '1 hour')
              AND temperature IS NOT NULL
              AND ph IS NOT NULL
            """,
            [hours],
        )
        stats = rows[0] if rows else {}

        avg_temp = _as_number(_value(stats, "avg_temp"))
        avg_ph = _as_number(_value(stats, "avg_ph"))
        avg_humidity = _as_number(_value(stats, "avg_humidity"))
        avg_water_level = _as_number(_value(stats, "avg_water_level"))

        return {
            "temperature": {
                "avg": _value(stats, "avg_temp"),
                "min": _value(stats, "min_temp"),
                "max": _value(stats, "max_temp"),
                "status": _temp_status(avg_temp),
            },
            "ph": {
                "avg": _value(stats, "avg_ph"),
                "min": _value(stats, "min_ph"),
                "max": _value(stats, "max_ph"),
                "status": _ph_status(avg_ph),
            },
            "humidity": {
                "avg": _value(stats, "avg_humidity"),
                "min": _value(stats, "min_humidity"),
                "max": _value(stats, "max_humidity"),
                "status": _humidity_status(avg_humidity),
            },
            "waterLevel": {
                "avg": _value(stats, "avg_water_level"),
                "min": _value(stats, "min_water_level"),
                "max": _value(stats, "max_water_level"),
                "status": _water_level_status(avg_water_level),
            },
            "summary": {
                "totalReadings": _value(stats, "total_readings"),
                "zoneCount": _value(stats, "zone_count"),
                "hours": hours,
            },
            "generatedAt": _now_iso(),
        }
    except Exception as exc:
        print(f"Reports stats GET error: {exc}")
        return api_error(500, "Failed to fetch reports statistics")


def _now_iso() -> str:
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    return "{}.{:03d}Z".format(now.strftime("%Y-%m-%dT%H:%M:%S"), now.microsecond // 1000)
