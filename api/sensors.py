"""Sensor routes - port of green-matrix/app/api/sensors/* (latest, history, ingest)."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Request
from pydantic import BaseModel

from api import db
from api.errors import api_error, js_number, js_round, to_fixed

router = APIRouter(prefix="/api/sensors", tags=["sensors"])

READING_SQL = """
    SELECT sr.pond_id, sr.temperature, sr.ph, sr.humidity, sr.water_level,
           sr.device_id, sr.reading_time, p.name as pond_name
    FROM sensor_readings sr
    INNER JOIN ponds p ON sr.pond_id = p.id
    {join}
    {where}
"""


def now_iso() -> str:
    """``new Date().toISOString()`` equivalent (UTC, millisecond precision)."""
    now = datetime.now(timezone.utc)
    return "{}.{:03d}Z".format(
        now.strftime("%Y-%m-%dT%H:%M:%S"), now.microsecond // 1000
    )


def parse_iso(value) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


class SensorBody(BaseModel):
    device_id: str | None = None
    deviceId: str | None = None
    pondId: str | None = None
    temp: float | str | None = None
    ph: float | str | None = None
    humidity: float | str | None = None
    level: float | str | None = None
    name: str | None = None
    location: str | None = None
    size: float | str | None = None
    depth: float | str | None = None
    species: str | None = None


# --------------------------------------------------------------------------- #
# GET /api/sensors
# --------------------------------------------------------------------------- #
@router.get("")
async def get_sensors(request: Request):
    """GET /api/sensors - latest reading for one pond, or for every pond."""
    pond_id = request.query_params.get("pondId")

    try:
        if pond_id:
            rows = db.query(
                READING_SQL.format(
                    join=(
                        "INNER JOIN ("
                        "  SELECT pond_id, MAX(reading_time) as max_time"
                        "  FROM sensor_readings WHERE pond_id = ? GROUP BY pond_id"
                        ") latest ON sr.pond_id = latest.pond_id AND sr.reading_time = latest.max_time"
                    ),
                    where="",
                ),
                [pond_id],
            )
            if not rows:
                return api_error(404, "No readings found for pond")

            reading = rows[0]
            return {
                "pondId": reading["pond_id"],
                "temperature": reading["temperature"],
                "ph": reading["ph"],
                "humidity": reading["humidity"],
                "level": reading["water_level"],
                "lastUpdate": reading["reading_time"],
                "deviceId": reading["device_id"],
                "pondName": reading["pond_name"],
            }

        rows = db.query(
            READING_SQL.format(
                join=(
                    "INNER JOIN ("
                    "  SELECT pond_id, MAX(reading_time) as max_time"
                    "  FROM sensor_readings GROUP BY pond_id"
                    ") latest ON sr.pond_id = latest.pond_id AND sr.reading_time = latest.max_time"
                ),
                where="WHERE p.status = 'active'",
            )
        )

        now = datetime.now(timezone.utc)
        ponds = []
        for reading in rows:
            item = dict(reading)
            diff_minutes = (now - parse_iso(reading["reading_time"])).total_seconds() / 60
            item["is_online"] = diff_minutes <= 5
            ponds.append(item)

        return {"ponds": ponds, "timestamp": now_iso()}
    except Exception as exc:
        print(f"Sensors GET error: {exc}")
        return api_error(500, "Failed to fetch sensor data")


# --------------------------------------------------------------------------- #
# POST /api/sensors  (ESP32 / simulator ingestion)
# --------------------------------------------------------------------------- #
@router.post("")
async def ingest_sensor_data(body: SensorBody):
    """POST /api/sensors - store a reading and raise threshold alerts."""
    pond_id = body.pondId
    temp, ph, humidity, level = body.temp, body.ph, body.humidity, body.level
    # The ESP32 firmware and the hardware simulator both send `device_id`;
    # `deviceId` is accepted as an alias for backwards compatibility.
    resolved_device_id = body.deviceId or body.device_id

    # humidity is stored as an INTEGER column - round fractional readings
    # (the simulator drifts continuously, DHT11 reports whole percentages).
    normalized_humidity = None
    if humidity is not None and humidity != "":
        try:
            value = float(humidity)
            if value == value:  # not NaN
                normalized_humidity = int(value + 0.5) if value >= 0 else -int(-value + 0.5)
        except (TypeError, ValueError):
            normalized_humidity = None

    print(
        f"[SENSORS RECEIVED] Device: {resolved_device_id}, Pond: {pond_id}, Data: "
        f'{{"temp": {temp!r}, "ph": {ph!r}, "humidity": {normalized_humidity!r}, "level": {level!r}}}'
    )

    if not pond_id or temp is None or ph is None:
        return api_error(400, "Missing required fields: pondId, temp, ph")

    try:
        with db.transaction() as tx:
            existing_pond = tx.query("SELECT id FROM ponds WHERE id = ?", [pond_id])

            if not existing_pond:
                print(f"[SENSORS] Creating new pond {pond_id} from hardware registration")
                tx.execute(
                    "INSERT INTO ponds (id, name, location, size_sqm, depth_m, species, status) "
                    "VALUES (?, ?, ?, ?, ?, ?, 'active')",
                    [
                        pond_id,
                        body.name or f"Pond {pond_id}",
                        body.location or "Auto-registered from hardware",
                        body.size or 500,
                        body.depth or 1.5,
                        body.species or "Tilapia",
                    ],
                )
                tx.execute(
                    "INSERT INTO pond_configs (pond_id, device_id, temp_min, temp_optimal, temp_max, "
                    "ph_min, ph_optimal, ph_max, humidity_min, humidity_optimal, humidity_max, "
                    "water_level_min, water_level_optimal, water_level_max) "
                    "VALUES (?, ?, 20, 25, 30, 6.5, 7.0, 8.5, 60, 70, 80, 1.0, 1.5, 2.0)",
                    [pond_id, resolved_device_id or "unknown"],
                )

            # mirrors JS `level || null`
            level_value = level if level else None
            tx.execute(
                "INSERT INTO sensor_readings "
                "(pond_id, temperature, ph, humidity, water_level, device_id, reading_time) "
                "VALUES (?, ?, ?, ?, ?, ?, NOW())",
                [
                    pond_id,
                    temp,
                    ph,
                    normalized_humidity,
                    level_value,
                    resolved_device_id or "unknown",
                ],
            )

            alerts = check_thresholds(
                tx,
                pond_id,
                {"temp": temp, "ph": ph, "humidity": normalized_humidity, "level": level_value},
            )

            for alert in alerts:
                tx.execute(
                    "INSERT INTO alerts (pond_id, type, parameter, message, value, source, status, created_at) "
                    "VALUES (?, ?, ?, ?, ?, 'sensor', 'active', NOW())",
                    [
                        pond_id,
                        alert["type"],
                        alert["parameter"],
                        alert["message"],
                        alert["value"],
                    ],
                )

        response = {
            "success": True,
            "pondId": pond_id,
            "received": {"temp": temp, "ph": ph, "humidity": humidity, "level": level},
            "alerts": alerts,
            "timestamp": now_iso(),
        }
        print(f"[SENSORS RESPONSE] Sent to client: {response}")
        return response
    except Exception as exc:
        print(f"Sensor webhook error: {exc}")
        return api_error(500, "Failed to process sensor data")


# --------------------------------------------------------------------------- #
# GET /api/sensors/latest
# --------------------------------------------------------------------------- #
@router.get("/latest")
async def latest_readings(request: Request):
    """GET /api/sensors/latest - newest reading per pond (dashboard feed)."""
    pond_id = request.query_params.get("pondId")

    try:
        if pond_id:
            rows = db.query(
                READING_SQL.format(
                    join=(
                        "INNER JOIN ("
                        "  SELECT pond_id, MAX(reading_time) as max_time"
                        "  FROM sensor_readings WHERE pond_id = ? GROUP BY pond_id"
                        ") latest ON sr.pond_id = latest.pond_id AND sr.reading_time = latest.max_time"
                    ),
                    where="",
                ),
                [pond_id],
            )
            if not rows:
                return api_error(404, "No readings found for pond")

            reading = rows[0]
            response = {
                "pondId": reading["pond_id"],
                "temperature": reading["temperature"],
                "ph": reading["ph"],
                "humidity": reading["humidity"],
                "level": reading["water_level"],
                "lastUpdate": reading["reading_time"],
                "deviceId": reading["device_id"],
                "pondName": reading["pond_name"],
            }
            print(f"[SENSORS LATEST] Pond {pond_id} response: {response}")
            return response

        rows = db.query(
            READING_SQL.format(
                join=(
                    "INNER JOIN ("
                    "  SELECT pond_id, MAX(reading_time) as max_time"
                    "  FROM sensor_readings GROUP BY pond_id"
                    ") latest ON sr.pond_id = latest.pond_id AND sr.reading_time = latest.max_time"
                ),
                where="WHERE p.status = 'active'",
            )
        )
        response = {"ponds": rows, "timestamp": now_iso()}
        print(f"[SENSORS LATEST ALL] Response with {len(rows)} ponds")
        return response
    except Exception as exc:
        print(f"Sensors latest GET error: {exc}")
        return api_error(500, "Failed to fetch sensor data")


# --------------------------------------------------------------------------- #
# GET /api/sensors/history
# --------------------------------------------------------------------------- #
@router.get("/history")
async def sensor_history(request: Request):
    """GET /api/sensors/history - recent readings for the charts."""
    try:
        hours = int(request.query_params.get("hours") or 24)
        limit = int(request.query_params.get("limit") or 200)

        rows = db.query(
            """
            SELECT reading_time as time, temperature, ph, humidity, water_level
            FROM sensor_readings
            WHERE reading_time > NOW() - (? * INTERVAL '1 hour')
            ORDER BY reading_time DESC
            LIMIT ?
            """,
            [hours, limit],
        )

        readings = list(reversed(rows))
        transformed = [
            {
                "time": reading["time"],
                "temp": js_number(to_fixed(reading["temperature"] or 0, 1)),
                "ph": js_number(to_fixed(reading["ph"] or 0, 2)),
                "humidity": js_round(reading["humidity"] or 0),
                "waterLevel": js_number(to_fixed(reading["water_level"] or 0, 2)),
            }
            for reading in readings
        ]

        print(f"[SENSORS HISTORY] Returning {len(transformed)} readings for last {hours} hours")
        return {
            "readings": transformed,
            "totalReadings": len(readings),
            "hours": hours,
            "generatedAt": now_iso(),
        }
    except Exception as exc:
        print(f"Sensors history GET error: {exc}")
        return api_error(500, "Failed to fetch sensor history")


# --------------------------------------------------------------------------- #
# threshold evaluation (port of checkThresholds)
# --------------------------------------------------------------------------- #
def _number(value, default=None):
    if value is None or value == "":
        return default
    try:
        return js_number(float(value))
    except (TypeError, ValueError):
        return default


def check_thresholds(tx, pond_id: str, data: dict) -> list[dict]:
    alerts: list[dict] = []
    try:
        configs = tx.query(
            "SELECT temp_min, temp_optimal, temp_max, ph_min, ph_optimal, ph_max, "
            "humidity_min, humidity_optimal, humidity_max, "
            "water_level_min, water_level_optimal, water_level_max "
            "FROM pond_configs WHERE pond_id = ?",
            [pond_id],
        )
        if not configs:
            return alerts

        # PostgreSQL NUMERIC columns arrive as Decimal/str - coerce to numbers
        # before arithmetic (optimal + 1.5 would otherwise fail / concatenate).
        # Missing values become NaN so comparisons simply yield "no alert".
        raw = configs[0]
        config = {
            key: (float("nan") if value in (None, "") else float(value))
            for key, value in raw.items()
        }

        temp = _number(data.get("temp"))
        ph = _number(data.get("ph"))
        humidity = _number(data.get("humidity"))
        level = _number(data.get("level"))

        # Temperature thresholds
        if temp is not None:
            if temp > config["temp_max"]:
                alerts.append({
                    "type": "critical",
                    "parameter": "temperature",
                    "message": f"Temperature critically high ({temp}°C, max: {config['temp_max']}°C)",
                    "value": temp,
                })
            elif temp < config["temp_min"]:
                alerts.append({
                    "type": "critical",
                    "parameter": "temperature",
                    "message": f"Temperature critically low ({temp}°C, min: {config['temp_min']}°C)",
                    "value": temp,
                })
            elif temp > config["temp_optimal"] + 1.5:
                alerts.append({
                    "type": "warning",
                    "parameter": "temperature",
                    "message": f"Temperature elevated ({temp}°C)",
                    "value": temp,
                })

        # pH thresholds
        if ph is not None:
            if ph < config["ph_min"]:
                alerts.append({
                    "type": "critical",
                    "parameter": "ph",
                    "message": f"pH too low ({ph}, min: {config['ph_min']})",
                    "value": ph,
                })
            elif ph > config["ph_max"]:
                alerts.append({
                    "type": "critical",
                    "parameter": "ph",
                    "message": f"pH too high ({ph}, max: {config['ph_max']})",
                    "value": ph,
                })
            elif ph < config["ph_optimal"] - 0.3 or ph > config["ph_optimal"] + 0.3:
                alerts.append({
                    "type": "warning",
                    "parameter": "ph",
                    "message": f"pH outside optimal range ({ph})",
                    "value": ph,
                })

        # Humidity thresholds (optional reading - skipped when not reported)
        if humidity is not None:
            if humidity < config["humidity_min"]:
                alerts.append({
                    "type": "critical",
                    "parameter": "humidity",
                    "message": (
                        f"Humidity critically low ({humidity}%, min: {config['humidity_min']}%)"
                    ),
                    "value": humidity,
                })
            elif humidity > config["humidity_max"]:
                alerts.append({
                    "type": "warning",
                    "parameter": "humidity",
                    "message": f"Humidity high ({humidity}%, max: {config['humidity_max']}%)",
                    "value": humidity,
                })

        # Water level thresholds (optional reading - skipped when not reported)
        if level is not None:
            if level < config["water_level_min"]:
                alerts.append({
                    "type": "critical",
                    "parameter": "water_level",
                    "message": (
                        f"Water level critically low ({level}m, min: {config['water_level_min']}m)"
                    ),
                    "value": level,
                })
            elif level < config["water_level_optimal"] - 0.3:
                alerts.append({
                    "type": "warning",
                    "parameter": "water_level",
                    "message": f"Water level below optimal ({level}m)",
                    "value": level,
                })

        return alerts
    except Exception as exc:
        print(f"Threshold check error: {exc}")
        return []
