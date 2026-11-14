"""Actuator trigger routes.

This feature previously drove a single fixed dispenser. It now drives arbitrary
zone actuators — fans, doors, valves, pumps, aerators — so the resource is a
trigger. It is intentionally decoupled from any subject type.

Endpoints:
    GET/POST   /api/triggers                  history + manual trigger / disable
    GET/POST   /api/triggers/pending          device work queue + completion ACK
    GET/PUT/POST /api/triggers/presets        named actuator presets
    GET/PUT/POST /api/triggers/schedules      interval schedules
    GET/PUT/POST /api/triggers/states         saved preset states
"""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

from api import db
from api.errors import api_error

router = APIRouter(prefix="/api/triggers", tags=["triggers"])

DEFAULT_INTERVALS = [1, 3, 10]

# Named actuator presets. They reference real seeded zones so a manual preset
# run can never violate the trigger_logs.zone_id foreign key.
PRESETS = [
    {
        "id": "gh01-fan-am",
        "zone": "Greenhouse Alpha",
        "zoneId": "GH-01",
        "actuatorName": "Exhaust Fan",
        "time": "08:00",
        "duration": 300,
        "days": "Daily",
    },
    {
        "id": "gh01-vent-pm",
        "zone": "Greenhouse Alpha",
        "zoneId": "GH-01",
        "actuatorName": "Vent Door",
        "time": "16:00",
        "duration": 180,
        "days": "Daily",
    },
    {
        "id": "gh02-fan-pm",
        "zone": "Greenhouse Beta",
        "zoneId": "GH-02",
        "actuatorName": "Circulation Fan",
        "time": "12:00",
        "duration": 240,
        "days": "Daily",
    },
    {
        "id": "pen01-valve-pm",
        "zone": "Dairy Pen 1",
        "zoneId": "PEN-01",
        "actuatorName": "Water Valve",
        "time": "09:00",
        "duration": 240,
        "days": "Mon, Wed, Fri",
    },
]


def create_alert(
    zone_id: str,
    message: str,
    alert_type: str = "info",
    source: str = "trigger",
) -> None:
    try:
        db.execute(
            "INSERT INTO alerts (zone_id, type, message, source, status, created_at) "
            "VALUES (?, ?, ?, ?, 'active', NOW())",
            [zone_id, alert_type, message, source],
        )
        print(f"[ALERT CREATED] {alert_type}: {message} for zone {zone_id}")
    except Exception as exc:
        print(f"Failed to create alert: {exc}")


# --------------------------------------------------------------------------- #
# /api/triggers
# --------------------------------------------------------------------------- #
class TriggerBody(BaseModel):
    action: str | None = None
    zoneId: str | None = None
    zone_id: str | None = None
    actuatorName: str | None = None
    durationSeconds: int | str | None = None


@router.get("")
async def get_triggers(request: Request):
    """GET /api/triggers?type=history|schedules - trigger history or schedules."""
    type_ = request.query_params.get("type")
    zone_id = (
        request.query_params.get("zoneId")
        or request.query_params.get("zone_id")
        or "GH-01"
    )

    try:
        if type_ == "history":
            history = db.query(
                "SELECT id, zone_id, schedule_id, actuator_name, duration_seconds, "
                "triggered_by, triggered_at, device_id, status FROM trigger_logs "
                "WHERE zone_id = ? ORDER BY triggered_at DESC NULLS LAST, id DESC LIMIT 50",
                [zone_id],
            )
            return {"history": history}

        schedules = db.query(
            "SELECT id, zone_id, actuator_name, interval_minutes, duration_seconds, "
            "active, last_executed FROM trigger_schedules "
            "WHERE zone_id = ? AND interval_minutes IS NOT NULL "
            "ORDER BY interval_minutes",
            [zone_id],
        )
        return {"zoneId": zone_id, "schedules": schedules}
    except Exception as exc:
        print(f"Triggers GET error: {exc}")
        return api_error(500, "Failed to fetch trigger data")


@router.post("")
async def post_trigger(body: TriggerBody):
    """POST /api/triggers - queue a manual actuator run or disable schedules."""
    action = body.action
    zone_id = body.zoneId or body.zone_id

    try:
        if action == "trigger":
            if not zone_id:
                return api_error(400, "Missing required field: zoneId")

            # Pending entry the ESP32/simulator picks up from /api/triggers/pending
            result = db.execute(
                "INSERT INTO trigger_logs "
                "(zone_id, actuator_name, duration_seconds, triggered_by, "
                "triggered_by_user, status) "
                "VALUES (?, ?, ?, 'manual', 'web_user', 'pending')",
                [
                    zone_id,
                    body.actuatorName or "Actuator",
                    _as_int(body.durationSeconds, 0),
                ],
            )
            log_id = result["insertId"]

            create_alert(
                zone_id,
                f"Manual {body.actuatorName or 'actuator'} trigger queued - "
                "pending execution by device",
            )

            return {
                "success": True,
                "message": f"Trigger queued for zone {zone_id}. Device will execute shortly.",
                "triggerId": log_id,
            }

        if action == "disable":
            if not zone_id:
                return api_error(400, "Missing required field: zoneId")
            db.execute(
                "UPDATE trigger_schedules SET active = FALSE WHERE zone_id = ?", [zone_id]
            )
            create_alert(zone_id, "All actuator trigger schedules disabled")
            return {
                "success": True,
                "message": f"Trigger schedules disabled for zone {zone_id}",
            }

        return api_error(400, "Invalid action")
    except Exception as exc:
        print(f"Triggers POST error: {exc}")
        return api_error(500, "Failed to process trigger action", details=str(exc))


# --------------------------------------------------------------------------- #
# /api/triggers/pending  (device polling)
# --------------------------------------------------------------------------- #
class PendingBody(BaseModel):
    scheduleId: int | str | None = None
    logId: int | str | None = None
    zoneId: str | None = None
    zone_id: str | None = None
    status: str | None = None
    deviceId: str | None = None
    triggeredAt: str | None = None


@router.get("/pending")
async def get_pending(request: Request):
    """GET /api/triggers/pending - work queue for the ESP32/simulator."""
    zone_id = request.query_params.get("zoneId") or request.query_params.get("zone_id")
    device_id = request.query_params.get("deviceId")

    if not zone_id:
        return api_error(400, "Missing zoneId parameter")

    try:
        schedules = db.query(
            """
            SELECT id, zone_id, actuator_name, interval_minutes, duration_seconds
            FROM trigger_schedules
            WHERE zone_id = ?
              AND active = TRUE
              AND interval_minutes IS NOT NULL
              AND (last_executed IS NULL
                   OR last_executed < NOW() - (interval_minutes * INTERVAL '1 minute'))
            """,
            [zone_id],
        )

        # Update immediately so a schedule is never handed out twice.
        for schedule in schedules:
            db.execute(
                "UPDATE trigger_schedules SET last_executed = NOW() WHERE id = ?",
                [schedule["id"]],
            )
            print(
                f"[TRIGGER PENDING] Updated last_executed for schedule {schedule['id']} "
                f"(every {schedule['interval_minutes']}min)"
            )

        pending_manual = db.query(
            "SELECT id, zone_id, actuator_name, duration_seconds, device_id "
            "FROM trigger_logs "
            "WHERE zone_id = ? AND status = 'pending' AND triggered_by = 'manual'",
            [zone_id],
        )

        for manual in pending_manual:
            db.execute(
                "UPDATE trigger_logs SET status = 'in_progress' WHERE id = ?",
                [manual["id"]],
            )
            print(f"[TRIGGER PENDING] Marked manual trigger {manual['id']} as in_progress")

        response = {
            "zoneId": zone_id,
            "scheduledTriggers": schedules,
            "manualTriggers": pending_manual,
            "deviceId": device_id or None,
        }

        if schedules or pending_manual:
            print(f"[TRIGGER PENDING] Device {device_id} polled for zone {zone_id}: {response}")

        return response
    except Exception as exc:
        print(f"Trigger pending GET error: {exc}")
        return api_error(500, "Failed to fetch pending triggers")


@router.post("/pending")
async def ack_pending(body: PendingBody):
    """POST /api/triggers/pending - device reports an actuator run completed."""
    try:
        if body.logId:
            db.execute(
                "UPDATE trigger_logs SET status = ?, triggered_at = ?, device_id = ? "
                "WHERE id = ?",
                [
                    body.status or "completed",
                    body.triggeredAt or _now(),
                    body.deviceId,
                    body.logId,
                ],
            )
            print(
                f"[TRIGGER COMPLETED] Manual trigger {body.logId} completed by device "
                f"{body.deviceId}"
            )
            return {
                "success": True,
                "message": f"Manual trigger {body.logId} marked as {body.status}",
            }

        if body.scheduleId:
            db.execute(
                "UPDATE trigger_schedules SET last_executed = NOW() WHERE id = ?",
                [body.scheduleId],
            )
            db.execute(
                "INSERT INTO trigger_logs "
                "(zone_id, schedule_id, actuator_name, duration_seconds, triggered_by, "
                "device_id, status, triggered_at) "
                "VALUES (?, ?, 'Scheduled Actuator', 0, 'schedule', ?, 'completed', NOW())",
                [body.zoneId or body.zone_id, body.scheduleId, body.deviceId],
            )
            print(
                f"[TRIGGER COMPLETED] Interval schedule {body.scheduleId} completed by device "
                f"{body.deviceId}"
            )
            return {
                "success": True,
                "message": f"Interval schedule {body.scheduleId} completed",
            }

        return api_error(400, "Missing scheduleId or logId")
    except Exception as exc:
        print(f"Trigger pending POST error: {exc}")
        return api_error(500, "Failed to update trigger status")


def _now():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc)


def _as_int(value, default: int = 0) -> int:
    if value is None or value == "":
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


# --------------------------------------------------------------------------- #
# /api/triggers/presets
# --------------------------------------------------------------------------- #
class PresetStateBody(BaseModel):
    presetId: str | None = None
    active: bool | None = None


class PresetTriggerBody(BaseModel):
    action: str | None = None
    presetId: str | None = None
    zoneId: str | None = None
    actuatorName: str | None = None
    duration: int | None = None


@router.get("/presets")
async def get_presets():
    """GET /api/triggers/presets - named actuator presets merged with saved states."""
    try:
        states = db.query("SELECT preset_id, active FROM trigger_presets")
        active_map = {
            state["preset_id"]: (state["active"] is True or state["active"] == 1)
            for state in states
        }
        return {
            "presets": [
                {
                    **preset,
                    "active": active_map[preset["id"]] if preset["id"] in active_map else True,
                }
                for preset in PRESETS
            ]
        }
    except Exception as exc:
        print(f"Trigger presets GET error: {exc}")
        return {"presets": [{**preset, "active": True} for preset in PRESETS]}


@router.put("/presets")
async def put_preset_state(body: PresetStateBody):
    """PUT /api/triggers/presets - toggle a preset on/off."""
    try:
        if not body.presetId or body.active is None:
            return api_error(400, "Missing required fields: presetId, active (boolean)")

        if not any(preset["id"] == body.presetId for preset in PRESETS):
            return api_error(400, "Invalid presetId")

        db.execute(
            """
            INSERT INTO trigger_presets (preset_id, active, updated_at)
            VALUES (?, ?, NOW())
            ON CONFLICT (preset_id) DO UPDATE SET
              active = EXCLUDED.active,
              updated_at = NOW()
            """,
            [body.presetId, body.active],
        )
        return {"success": True, "presetId": body.presetId, "active": body.active}
    except Exception as exc:
        print(f"Trigger presets PUT error: {exc}")
        return api_error(500, "Failed to update preset state")


@router.post("/presets")
async def trigger_preset(body: PresetTriggerBody):
    """POST /api/triggers/presets - run an actuator preset now."""
    try:
        if body.action == "trigger" and body.presetId:
            preset = next((p for p in PRESETS if p["id"] == body.presetId), None)
            if not preset:
                return api_error(400, "Invalid presetId")

            result = db.execute(
                "INSERT INTO trigger_logs "
                "(zone_id, actuator_name, duration_seconds, triggered_by, "
                "triggered_by_user, device_id, status) "
                "VALUES (?, ?, ?, 'manual', 'web_user', 'esp32_actuator', 'pending')",
                [preset["zoneId"], preset["actuatorName"], preset["duration"]],
            )
            log_id = result["insertId"]

            print(
                f"[ESP32 COMMAND] Run {preset['actuatorName']} in zone "
                f"{preset['zoneId']} for {preset['duration']}s"
            )

            db.execute(
                "UPDATE trigger_logs SET status = 'completed', triggered_at = NOW() "
                "WHERE id = ?",
                [log_id],
            )
            create_alert(
                preset["zoneId"],
                f"{preset['actuatorName']} triggered successfully "
                f"({preset['duration']}s)",
            )

            return {
                "success": True,
                "message": f"Trigger sent for {preset['zone']}",
                "preset": preset,
                "logId": log_id,
            }

        return api_error(400, "Invalid action")
    except Exception as exc:
        print(f"Trigger presets POST error: {exc}")
        return api_error(500, "Failed to run trigger preset")


# --------------------------------------------------------------------------- #
# /api/triggers/schedules
# --------------------------------------------------------------------------- #
class ScheduleBody(BaseModel):
    id: int | str | None = None
    active: bool | None = None
    zone_id: str | None = None
    zoneId: str | None = None
    actuatorName: str | None = None
    durationSeconds: int | str | None = None
    reset: bool | None = None


def ensure_default_schedules(zone_id: str) -> list[dict]:
    existing = db.query(
        "SELECT id, interval_minutes, active, actuator_name, duration_seconds "
        "FROM trigger_schedules "
        "WHERE zone_id = ? AND interval_minutes IS NOT NULL "
        "ORDER BY interval_minutes",
        [zone_id],
    )

    if len(existing) == 3:
        return existing

    created: list[dict] = []
    for interval in DEFAULT_INTERVALS:
        match = next(
            (item for item in existing if item["interval_minutes"] == interval), None
        )
        if match is None:
            result = db.execute(
                "INSERT INTO trigger_schedules "
                "(zone_id, interval_minutes, active, actuator_name) "
                "VALUES (?, ?, FALSE, 'Actuator')",
                [zone_id, interval],
            )
            created.append(
                {
                    "id": result["insertId"],
                    "interval_minutes": interval,
                    "active": False,
                    "actuator_name": "Actuator",
                    "duration_seconds": 0,
                }
            )
        else:
            created.append(match)

    return created


@router.get("/schedules")
async def get_schedules(request: Request):
    """GET /api/triggers/schedules?zoneId=&init=true - interval schedules."""
    zone_id = request.query_params.get("zoneId") or request.query_params.get("zone_id")
    init = request.query_params.get("init") == "true"

    if not zone_id:
        return api_error(400, "Missing zoneId parameter")

    try:
        if init:
            schedules = ensure_default_schedules(zone_id)
        else:
            schedules = db.query(
                "SELECT id, zone_id, actuator_name, interval_minutes, duration_seconds, active "
                "FROM trigger_schedules "
                "WHERE zone_id = ? AND interval_minutes IS NOT NULL "
                "ORDER BY interval_minutes",
                [zone_id],
            )
        return {"zoneId": zone_id, "schedules": schedules}
    except Exception as exc:
        print(f"Trigger schedules GET error: {exc}")
        return api_error(500, "Failed to fetch schedules")


@router.put("/schedules")
async def put_schedule(body: ScheduleBody):
    """PUT /api/triggers/schedules - enable/disable one schedule."""
    try:
        if not body.id:
            return api_error(400, "Missing schedule id")

        db.execute(
            "UPDATE trigger_schedules SET active = ? WHERE id = ?", [body.active, body.id]
        )
        state = "activated" if body.active else "disabled"
        return {"success": True, "message": f"Schedule {body.id} {state}"}
    except Exception as exc:
        print(f"Trigger schedules PUT error: {exc}")
        return api_error(500, "Failed to update schedule")


@router.post("/schedules")
async def post_schedules(body: ScheduleBody):
    """POST /api/triggers/schedules - (re)create the default interval schedules."""
    try:
        zone_id = body.zone_id or body.zoneId
        if not zone_id:
            return api_error(400, "Missing zone_id")

        if body.reset:
            db.execute(
                "DELETE FROM trigger_schedules WHERE zone_id = ? "
                "AND interval_minutes IS NOT NULL",
                [zone_id],
            )

        schedules = ensure_default_schedules(zone_id)
        return {
            "success": True,
            "message": f"Created {len(schedules)} interval schedules for zone {zone_id}",
            "schedules": schedules,
        }
    except Exception as exc:
        print(f"Trigger schedules POST error: {exc}")
        return api_error(500, "Failed to create schedules")


# --------------------------------------------------------------------------- #
# /api/triggers/states
# --------------------------------------------------------------------------- #
class StateBody(BaseModel):
    presetId: str | None = None
    active: bool | None = None


class StatesBody(BaseModel):
    states: list[StateBody] | None = None


def upsert_state(preset_id: str, active: bool) -> None:
    db.execute(
        """
        INSERT INTO trigger_presets (preset_id, active, updated_at)
        VALUES (?, ?, NOW())
        ON CONFLICT (preset_id) DO UPDATE SET
          active = EXCLUDED.active,
          updated_at = NOW()
        """,
        [preset_id, active],
    )


@router.get("/states")
async def get_states():
    """GET /api/triggers/states - saved preset states."""
    try:
        states = db.query(
            'SELECT preset_id AS "presetId", active FROM trigger_presets '
            "ORDER BY preset_id"
        )
        return {"states": states or []}
    except Exception as exc:
        print(f"Trigger states GET error: {exc}")
        return {"states": []}


@router.put("/states")
async def put_state(body: StateBody):
    """PUT /api/triggers/states - save one preset state."""
    try:
        if not body.presetId or body.active is None:
            return api_error(400, "Missing required fields: presetId, active")

        upsert_state(body.presetId, body.active)
        return {"success": True, "presetId": body.presetId, "active": body.active}
    except Exception as exc:
        print(f"Trigger states PUT error: {exc}")
        return api_error(500, "Failed to save schedule state")


@router.post("/states")
async def post_states(body: StatesBody):
    """POST /api/triggers/states - bulk save preset states."""
    try:
        if body.states is None:
            return api_error(400, "states must be an array")

        for state in body.states:
            if state.presetId is not None and state.active is not None:
                upsert_state(state.presetId, state.active)

        return {"success": True, "message": f"{len(body.states)} states saved"}
    except Exception as exc:
        print(f"Trigger states POST error: {exc}")
        return api_error(500, "Failed to save schedule states")
