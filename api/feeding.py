"""Feeding routes - port of green-matrix/app/api/feeding/* (5 route files)."""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

from api import db
from api.errors import api_error

router = APIRouter(prefix="/api/feeding", tags=["feeding"])

DEFAULT_INTERVALS = [1, 3, 10]

PRESETS = [
    {"id": "a1-08", "pond": "Pond A1", "pondId": "A1", "time": "08:00", "amount": 500, "days": "Daily"},
    {"id": "a1-16", "pond": "Pond A1", "pondId": "A1", "time": "16:00", "amount": 400, "days": "Daily"},
    {"id": "a2-08", "pond": "Pond A2", "pondId": "A2", "time": "08:30", "amount": 450, "days": "Daily"},
    {"id": "b1-09", "pond": "Pond B1", "pondId": "B1", "time": "09:00", "amount": 600, "days": "Mon, Wed, Fri"},
]


def create_alert(
    pond_id: str,
    message: str,
    alert_type: str = "info",
    source: str = "feeding",
) -> None:
    try:
        db.execute(
            "INSERT INTO alerts (pond_id, type, message, source, status, created_at) "
            "VALUES (?, ?, ?, ?, 'active', NOW())",
            [pond_id, alert_type, message, source],
        )
        print(f"[ALERT CREATED] {alert_type}: {message} for pond {pond_id}")
    except Exception as exc:
        print(f"Failed to create alert: {exc}")


# --------------------------------------------------------------------------- #
# /api/feeding
# --------------------------------------------------------------------------- #
class FeedingBody(BaseModel):
    action: str | None = None
    pondId: str | None = None


@router.get("")
async def get_feeding(request: Request):
    """GET /api/feeding?type=history|schedules - history or interval schedules."""
    type_ = request.query_params.get("type")
    pond_id = request.query_params.get("pondId") or "P001"

    try:
        if type_ == "history":
            history = db.query(
                "SELECT id, pond_id, schedule_id, amount_grams, triggered_by, fed_at, "
                "device_id, status FROM feeding_logs "
                "WHERE pond_id = ? ORDER BY fed_at DESC LIMIT 50",
                [pond_id],
            )
            return {"history": history}

        schedules = db.query(
            "SELECT id, pond_id, interval_minutes, active, last_executed "
            "FROM feeding_schedules "
            "WHERE pond_id = ? AND interval_minutes IS NOT NULL "
            "ORDER BY interval_minutes",
            [pond_id],
        )
        return {"pondId": pond_id, "schedules": schedules}
    except Exception as exc:
        print(f"Feeding GET error: {exc}")
        return api_error(500, "Failed to fetch feeding data")


@router.post("")
async def post_feeding(body: FeedingBody):
    """POST /api/feeding - manual feed trigger or disable all schedules."""
    action, pond_id = body.action, body.pondId

    try:
        if action == "trigger":
            if not pond_id:
                return api_error(400, "Missing required field: pondId")

            # Pending entry the ESP32/simulator picks up from /api/feeding/pending
            result = db.execute(
                "INSERT INTO feeding_logs "
                "(pond_id, amount_grams, triggered_by, triggered_by_user, status) "
                "VALUES (?, 0, 'manual', 'web_user', 'pending')",
                [pond_id],
            )
            log_id = result["insertId"]

            create_alert(pond_id, "Manual feeding queued - pending execution by device")

            return {
                "success": True,
                "message": (
                    f"Feeding queued for Pond {pond_id}. Device will execute shortly."
                ),
                "feedingId": log_id,
            }

        if action == "disable":
            db.execute(
                "UPDATE feeding_schedules SET active = FALSE WHERE pond_id = ?", [pond_id]
            )
            create_alert(pond_id, "All feeding schedules disabled")
            return {
                "success": True,
                "message": f"Feeding schedules disabled for pond {pond_id}",
            }

        return api_error(400, "Invalid action")
    except Exception as exc:
        print(f"Feeding POST error: {exc}")
        print(f"Error details: {exc}")
        return api_error(500, "Failed to process feeding action", details=str(exc))


# --------------------------------------------------------------------------- #
# /api/feeding/pending  (device polling)
# --------------------------------------------------------------------------- #
class PendingBody(BaseModel):
    scheduleId: int | str | None = None
    logId: int | str | None = None
    pondId: str | None = None
    status: str | None = None
    deviceId: str | None = None
    fedAt: str | None = None


@router.get("/pending")
async def get_pending(request: Request):
    """GET /api/feeding/pending - work queue for the ESP32/simulator."""
    pond_id = request.query_params.get("pondId")
    device_id = request.query_params.get("deviceId")

    if not pond_id:
        return api_error(400, "Missing pondId parameter")

    try:
        schedules = db.query(
            """
            SELECT id, pond_id, interval_minutes
            FROM feeding_schedules
            WHERE pond_id = ?
              AND active = TRUE
              AND interval_minutes IS NOT NULL
              AND (last_executed IS NULL OR last_executed < NOW() - (interval_minutes * INTERVAL '1 minute'))
            """,
            [pond_id],
        )

        # Update immediately so a schedule is never handed out twice
        for schedule in schedules:
            db.execute(
                "UPDATE feeding_schedules SET last_executed = NOW() WHERE id = ?",
                [schedule["id"]],
            )
            print(
                f"[FEEDING PENDING] Updated last_executed for schedule {schedule['id']} "
                f"(every {schedule['interval_minutes']}min)"
            )

        pending_manual = db.query(
            "SELECT id, pond_id, amount_grams, device_id FROM feeding_logs "
            "WHERE pond_id = ? AND status = 'pending' AND triggered_by = 'manual'",
            [pond_id],
        )

        for manual in pending_manual:
            db.execute(
                "UPDATE feeding_logs SET status = 'in_progress' WHERE id = ?",
                [manual["id"]],
            )
            print(f"[FEEDING PENDING] Marked manual trigger {manual['id']} as in_progress")

        response = {
            "pondId": pond_id,
            "scheduledFeedings": schedules,
            "manualTriggers": pending_manual,
            "deviceId": device_id or None,
        }

        if schedules or pending_manual:
            print(f"[FEEDING PENDING] Device {device_id} polled for pond {pond_id}: {response}")

        return response
    except Exception as exc:
        print(f"Feeding pending GET error: {exc}")
        return api_error(500, "Failed to fetch pending feedings")


@router.post("/pending")
async def ack_pending(body: PendingBody):
    """POST /api/feeding/pending - device reports a feeding completed."""
    try:
        if body.logId:
            db.execute(
                "UPDATE feeding_logs SET status = ?, fed_at = ?, device_id = ? WHERE id = ?",
                [
                    body.status or "completed",
                    body.fedAt or _now(),
                    body.deviceId,
                    body.logId,
                ],
            )
            print(
                f"[FEEDING COMPLETED] Manual feeding {body.logId} completed by device "
                f"{body.deviceId}"
            )
            return {
                "success": True,
                "message": f"Manual feeding {body.logId} marked as {body.status}",
            }

        if body.scheduleId:
            db.execute(
                "UPDATE feeding_schedules SET last_executed = NOW() WHERE id = ?",
                [body.scheduleId],
            )
            db.execute(
                "INSERT INTO feeding_logs "
                "(pond_id, schedule_id, amount_grams, triggered_by, device_id, status, fed_at) "
                "VALUES (?, ?, 0, 'schedule', ?, 'completed', NOW())",
                [body.pondId, body.scheduleId, body.deviceId],
            )
            print(
                f"[FEEDING COMPLETED] Interval schedule {body.scheduleId} completed by device "
                f"{body.deviceId}"
            )
            return {
                "success": True,
                "message": f"Interval schedule {body.scheduleId} completed",
            }

        return api_error(400, "Missing scheduleId or logId")
    except Exception as exc:
        print(f"Feeding pending POST error: {exc}")
        return api_error(500, "Failed to update feeding status")


def _now():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------- #
# /api/feeding/presets
# --------------------------------------------------------------------------- #
class PresetStateBody(BaseModel):
    presetId: str | None = None
    active: bool | None = None


class PresetTriggerBody(BaseModel):
    action: str | None = None
    presetId: str | None = None
    pondId: str | None = None
    amount: int | None = None


@router.get("/presets")
async def get_presets():
    """GET /api/feeding/presets - hard-coded presets merged with saved states."""
    try:
        states = db.query("SELECT preset_id, active FROM feeding_schedule_states")
        active_map = {
            state["preset_id"]: (state["active"] is True or state["active"] == 1)
            for state in states
        }
        return {
            "presets": [
                {**preset, "active": active_map[preset["id"]] if preset["id"] in active_map else True}
                for preset in PRESETS
            ]
        }
    except Exception as exc:
        print(f"Feeding presets GET error: {exc}")
        return {"presets": [{**preset, "active": True} for preset in PRESETS]}


@router.put("/presets")
async def put_preset_state(body: PresetStateBody):
    """PUT /api/feeding/presets - toggle a preset on/off."""
    try:
        if not body.presetId or body.active is None:
            return api_error(400, "Missing required fields: presetId, active (boolean)")

        if not any(preset["id"] == body.presetId for preset in PRESETS):
            return api_error(400, "Invalid presetId")

        db.execute(
            """
            INSERT INTO feeding_schedule_states (preset_id, active, updated_at)
            VALUES (?, ?, NOW())
            ON CONFLICT (preset_id) DO UPDATE SET
              active = EXCLUDED.active,
              updated_at = NOW()
            """,
            [body.presetId, body.active],
        )
        return {"success": True, "presetId": body.presetId, "active": body.active}
    except Exception as exc:
        print(f"Feeding presets PUT error: {exc}")
        return api_error(500, "Failed to update preset state")


@router.post("/presets")
async def trigger_preset(body: PresetTriggerBody):
    """POST /api/feeding/presets - instant feeding for a preset."""
    try:
        if body.action == "trigger" and body.presetId:
            preset = next((p for p in PRESETS if p["id"] == body.presetId), None)
            if not preset:
                return api_error(400, "Invalid presetId")

            result = db.execute(
                "INSERT INTO feeding_logs "
                "(pond_id, amount_grams, triggered_by, triggered_by_user, device_id, status) "
                "VALUES (?, ?, 'manual', 'web_user', 'esp32_servo', 'pending')",
                [preset["pondId"], preset["amount"]],
            )
            log_id = result["insertId"]

            print(
                f"[ESP32 COMMAND] Feed pond {preset['pondId']}, amount: {preset['amount']}g"
            )

            db.execute(
                "UPDATE feeding_logs SET status = 'completed', fed_at = NOW() WHERE id = ?",
                [log_id],
            )
            create_alert(
                preset["pondId"],
                f"Feeding completed successfully - {preset['amount']}g dispensed",
            )

            return {
                "success": True,
                "message": f"Feeding triggered for {preset['pond']}",
                "preset": preset,
                "logId": log_id,
            }

        return api_error(400, "Invalid action")
    except Exception as exc:
        print(f"Feeding presets POST error: {exc}")
        return api_error(500, "Failed to trigger feeding")


# --------------------------------------------------------------------------- #
# /api/feeding/schedules
# --------------------------------------------------------------------------- #
class ScheduleBody(BaseModel):
    id: int | str | None = None
    active: bool | None = None
    pond_id: str | None = None
    reset: bool | None = None


def ensure_default_schedules(pond_id: str) -> list[dict]:
    existing = db.query(
        "SELECT id, interval_minutes, active FROM feeding_schedules "
        "WHERE pond_id = ? AND interval_minutes IS NOT NULL "
        "ORDER BY interval_minutes",
        [pond_id],
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
                "INSERT INTO feeding_schedules (pond_id, interval_minutes, active) "
                "VALUES (?, ?, FALSE)",
                [pond_id, interval],
            )
            created.append(
                {"id": result["insertId"], "interval_minutes": interval, "active": False}
            )
        else:
            created.append(match)

    return created


@router.get("/schedules")
async def get_schedules(request: Request):
    """GET /api/feeding/schedules?pondId=&init=true - interval schedules."""
    pond_id = request.query_params.get("pondId")
    init = request.query_params.get("init") == "true"

    if not pond_id:
        return api_error(400, "Missing pondId parameter")

    try:
        if init:
            schedules = ensure_default_schedules(pond_id)
        else:
            schedules = db.query(
                "SELECT id, pond_id, interval_minutes, active FROM feeding_schedules "
                "WHERE pond_id = ? AND interval_minutes IS NOT NULL "
                "ORDER BY interval_minutes",
                [pond_id],
            )
        return {"pondId": pond_id, "schedules": schedules}
    except Exception as exc:
        print(f"Feeding schedules GET error: {exc}")
        return api_error(500, "Failed to fetch schedules")


@router.put("/schedules")
async def put_schedule(body: ScheduleBody):
    """PUT /api/feeding/schedules - enable/disable one schedule."""
    try:
        if not body.id:
            return api_error(400, "Missing schedule id")

        db.execute("UPDATE feeding_schedules SET active = ? WHERE id = ?", [body.active, body.id])
        state = "activated" if body.active else "disabled"
        return {"success": True, "message": f"Schedule {body.id} {state}"}
    except Exception as exc:
        print(f"Feeding schedules PUT error: {exc}")
        return api_error(500, "Failed to update schedule")


@router.post("/schedules")
async def post_schedules(body: ScheduleBody):
    """POST /api/feeding/schedules - (re)create the default interval schedules."""
    try:
        if not body.pond_id:
            return api_error(400, "Missing pond_id")

        if body.reset:
            db.execute(
                "DELETE FROM feeding_schedules WHERE pond_id = ? AND interval_minutes IS NOT NULL",
                [body.pond_id],
            )

        schedules = ensure_default_schedules(body.pond_id)
        return {
            "success": True,
            "message": (
                f"Created {len(schedules)} interval schedules for pond {body.pond_id}"
            ),
            "schedules": schedules,
        }
    except Exception as exc:
        print(f"Feeding schedules POST error: {exc}")
        return api_error(500, "Failed to create schedules")


# --------------------------------------------------------------------------- #
# /api/feeding/states
# --------------------------------------------------------------------------- #
class StateBody(BaseModel):
    presetId: str | None = None
    active: bool | None = None


class StatesBody(BaseModel):
    states: list[StateBody] | None = None


def upsert_state(preset_id: str, active: bool) -> None:
    db.execute(
        """
        INSERT INTO feeding_schedule_states (preset_id, active, updated_at)
        VALUES (?, ?, NOW())
        ON CONFLICT (preset_id) DO UPDATE SET
          active = EXCLUDED.active,
          updated_at = NOW()
        """,
        [preset_id, active],
    )


@router.get("/states")
async def get_states():
    """GET /api/feeding/states - saved preset states."""
    try:
        states = db.query(
            'SELECT preset_id AS "presetId", active FROM feeding_schedule_states '
            "ORDER BY preset_id"
        )
        return {"states": states or []}
    except Exception as exc:
        print(f"Feeding states GET error: {exc}")
        return {"states": []}


@router.put("/states")
async def put_state(body: StateBody):
    """PUT /api/feeding/states - save one preset state."""
    try:
        if not body.presetId or body.active is None:
            return api_error(400, "Missing required fields: presetId, active")

        upsert_state(body.presetId, body.active)
        return {"success": True, "presetId": body.presetId, "active": body.active}
    except Exception as exc:
        print(f"Feeding states PUT error: {exc}")
        return api_error(500, "Failed to save schedule state")


@router.post("/states")
async def post_states(body: StatesBody):
    """POST /api/feeding/states - bulk save preset states."""
    try:
        if body.states is None:
            return api_error(400, "states must be an array")

        for state in body.states:
            if state.presetId is not None and state.active is not None:
                upsert_state(state.presetId, state.active)

        return {"success": True, "message": f"{len(body.states)} states saved"}
    except Exception as exc:
        print(f"Feeding states POST error: {exc}")
        return api_error(500, "Failed to save schedule states")
