"""Alert routes - port of green-matrix/app/api/alerts/route.ts."""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

from api import db
from api.errors import api_error

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

ALERT_COLUMNS = """
    a.id,
    a.pond_id,
    a.type,
    a.message,
    a.source,
    a.status,
    a.value,
    a.parameter,
    a.acknowledged_by,
    a.acknowledged_at,
    a.created_at,
    p.name as pond_name
"""


class AlertBody(BaseModel):
    pond_id: str | None = None
    type: str | None = "info"
    message: str | None = None
    source: str | None = "system"
    value: float | str | None = None
    parameter: str | None = None


class AckBody(BaseModel):
    id: int | str | None = None
    acknowledged_by: str | None = "system"


@router.get("")
async def list_alerts(request: Request):
    """GET /api/alerts - filtered alerts plus the dashboard counters."""
    params = request.query_params
    status = params.get("status") or "active"
    source = params.get("source")
    alert_type = params.get("type")
    pond_id = params.get("pond_id")
    limit = int(params.get("limit") or 50)

    try:
        sql = f"SELECT {ALERT_COLUMNS} FROM alerts a LEFT JOIN ponds p ON a.pond_id = p.id WHERE a.status = ?"
        values: list = [status]

        if source:
            sql += " AND a.source = ?"
            values.append(source)
        if alert_type:
            sql += " AND a.type = ?"
            values.append(alert_type)
        if pond_id:
            sql += " AND a.pond_id = ?"
            values.append(pond_id)

        sql += " ORDER BY a.created_at DESC LIMIT ?"
        values.append(limit)

        alerts = db.query(sql, values)

        rows = db.query(
            """
            SELECT
              SUM(CASE WHEN status = 'active' AND type = 'critical' THEN 1 ELSE 0 END) as critical_count,
              SUM(CASE WHEN status = 'active' AND type = 'warning' THEN 1 ELSE 0 END) as warning_count,
              SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as total_active,
              SUM(CASE WHEN created_at::date = CURRENT_DATE AND status = 'inactive' THEN 1 ELSE 0 END) as acknowledged_today
            FROM alerts
            """
        )
        counts = rows[0] if rows else None

        return {
            "alerts": alerts,
            "stats": {
                "critical": (counts or {}).get("critical_count") or 0,
                "warning": (counts or {}).get("warning_count") or 0,
                "totalActive": (counts or {}).get("total_active") or 0,
                "acknowledgedToday": (counts or {}).get("acknowledged_today") or 0,
            },
        }
    except Exception as exc:
        print(f"Alerts GET error: {exc}")
        return api_error(500, "Failed to fetch alerts")


@router.post("")
async def create_alert(body: AlertBody):
    """POST /api/alerts - create an alert (internal use)."""
    try:
        if not body.message:
            return api_error(400, "Message is required")

        result = db.execute(
            "INSERT INTO alerts (pond_id, type, message, source, value, parameter, status, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, 'active', NOW())",
            [
                body.pond_id or None,
                body.type or "info",
                body.message,
                body.source or "system",
                body.value if body.value is not None else None,
                body.parameter or None,
            ],
        )

        return {
            "success": True,
            "alertId": result["insertId"],
            "message": "Alert created successfully",
        }
    except Exception as exc:
        print(f"Alerts POST error: {exc}")
        return api_error(500, "Failed to create alert")


@router.put("")
async def acknowledge_alert(body: AckBody):
    """PUT /api/alerts - mark a single alert as read."""
    try:
        if not body.id:
            return api_error(400, "Alert ID is required")

        db.execute(
            "UPDATE alerts SET status = 'inactive', acknowledged_by = ?, acknowledged_at = NOW() "
            "WHERE id = ?",
            [body.acknowledged_by or "system", body.id],
        )
        return {"success": True, "message": "Alert marked as read"}
    except Exception as exc:
        print(f"Alerts PUT error: {exc}")
        return api_error(500, "Failed to update alert")


@router.delete("")
async def acknowledge_all(request: Request):
    """DELETE /api/alerts - mark every active alert as read."""
    acknowledged_by = request.query_params.get("user") or "system"
    pond_id = request.query_params.get("pond_id")

    try:
        sql = (
            "UPDATE alerts SET status = 'inactive', acknowledged_by = ?, acknowledged_at = NOW() "
            "WHERE status = 'active'"
        )
        values: list = [acknowledged_by]
        if pond_id:
            sql += " AND pond_id = ?"
            values.append(pond_id)

        result = db.execute(sql, values)
        return {
            "success": True,
            "message": "All alerts marked as read",
            "count": result["affectedRows"],
        }
    except Exception as exc:
        print(f"Alerts DELETE error: {exc}")
        return api_error(500, "Failed to mark alerts as read")
