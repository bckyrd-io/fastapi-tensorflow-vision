"""Zone routes - list, create, update and (soft-)delete farm zones.

``zone_type`` distinguishes the kind of zone: ``greenhouse``, ``pond``,
``pen_kraal`` or ``custom``. "Pond" is a category here, not a synonym for zone.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Request
from pydantic import BaseModel

from api import db
from api.errors import api_error

router = APIRouter(prefix="/api/zones", tags=["zones"])

ZONE_COLUMNS = "id, name, location, zone_type, subject_name, size_sqm, depth_m, status, created_at, updated_at"


class ZoneBody(BaseModel):
    id: str | None = None
    name: str | None = None
    location: str | None = None
    zone_type: str | None = "greenhouse"  # greenhouse, pond, pen_kraal, custom
    subject_name: str | None = None
    size: float | str | None = None
    depth: float | str | None = None
    status: str | None = "active"
    device_id: str | None = None
    device_name: str | None = None
    device_mac: str | None = None


def ensure_zone_device_config(zone_id: str, device_id: str | None) -> None:
    """Create the threshold row for a zone and record the reporting device."""
    if not zone_id:
        return

    db.execute(
        """
        INSERT INTO zone_configs
          (zone_id, device_id, temp_min, temp_optimal, temp_max,
           ph_min, ph_optimal, ph_max, humidity_min, humidity_optimal, humidity_max,
           water_level_min, water_level_optimal, water_level_max)
        VALUES (?, ?, 20, 25, 30, 6.0, 6.8, 7.5, 60, 75, 85, 1.0, 1.5, 2.0)
        ON CONFLICT (zone_id) DO NOTHING
        """,
        [zone_id, device_id],
    )
    if device_id:
        db.execute(
            "UPDATE zone_configs SET device_id = ? WHERE zone_id = ?",
            [device_id, zone_id],
        )


@router.get("")
async def list_zones(request: Request):
    """GET /api/zones - list all zones, or one zone with ?id=, with optional ?zone_type= filter."""
    zone_id = request.query_params.get("id")
    zone_type = request.query_params.get("zone_type")
    want_config = request.query_params.get("config")

    try:
        if zone_id:
            zones = db.query(f"SELECT {ZONE_COLUMNS} FROM zones WHERE id = ?", [zone_id])
            if not zones:
                return api_error(404, "Zone not found")

            if want_config:
                configs = db.query(
                    "SELECT temp_min, temp_optimal, temp_max, ph_min, ph_optimal, ph_max, "
                    "humidity_min, humidity_optimal, humidity_max, water_level_min, "
                    "water_level_optimal, water_level_max, device_id, device_name, device_mac "
                    "FROM zone_configs WHERE zone_id = ?",
                    [zone_id],
                )
                return {"zone": zones[0], "config": configs[0] if configs else None}

            return {"zone": zones[0]}

        query = f"""
            SELECT
              z.id, z.name, z.location, z.zone_type, z.subject_name, z.size_sqm, z.depth_m, z.status,
              zc.device_id, zc.device_name, zc.device_mac,
              zc.temp_min, zc.temp_optimal, zc.temp_max,
              zc.ph_min, zc.ph_optimal, zc.ph_max,
              zc.humidity_min, zc.humidity_optimal, zc.humidity_max,
              zc.water_level_min, zc.water_level_optimal, zc.water_level_max,
              (
                SELECT p.predicted_stage
                FROM stage_predictions p
                WHERE p.zone_id = z.id
                ORDER BY p.created_at DESC
                LIMIT 1
              ) AS latest_stage,
              (
                SELECT p.confidence
                FROM stage_predictions p
                WHERE p.zone_id = z.id
                ORDER BY p.created_at DESC
                LIMIT 1
              ) AS stage_confidence,
              (
                SELECT f.image_url
                FROM captured_frames f
                WHERE f.zone_id = z.id
                ORDER BY f.captured_at DESC, f.id DESC
                LIMIT 1
              ) AS latest_image_url,
              (
                SELECT f.captured_at
                FROM captured_frames f
                WHERE f.zone_id = z.id
                ORDER BY f.captured_at DESC, f.id DESC
                LIMIT 1
              ) AS latest_capture_at
            FROM zones z
            LEFT JOIN zone_configs zc ON z.id = zc.zone_id
        """
        params = []
        if zone_type:
            query += " WHERE z.zone_type = ?"
            params.append(zone_type)

        query += " ORDER BY z.id ASC"

        zones = db.query(query, params)
        return {"zones": zones}
    except Exception as exc:
        print(f"Zones GET error: {exc}")
        return api_error(500, "Failed to fetch zone data")


@router.post("")
async def create_or_update_zone(body: ZoneBody):
    """POST /api/zones - register or update a zone."""
    try:
        if not body.name or not body.location:
            return api_error(400, "Missing required fields: name, location")

        zone_id = body.id or f"Z{uuid.uuid4().hex[:4].upper()}"
        existing = db.query_one("SELECT id FROM zones WHERE id = ?", [zone_id])

        if existing:
            db.execute(
                """
                UPDATE zones
                SET name = ?, location = ?, zone_type = ?, subject_name = ?,
                    size_sqm = ?, depth_m = ?, status = ?
                WHERE id = ?
                """,
                [
                    body.name,
                    body.location,
                    body.zone_type or "greenhouse",
                    body.subject_name or "Standard Batch",
                    body.size,
                    body.depth,
                    body.status or "active",
                    zone_id,
                ],
            )
        else:
            db.execute(
                """
                INSERT INTO zones (id, name, location, zone_type, subject_name, size_sqm, depth_m, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    zone_id,
                    body.name,
                    body.location,
                    body.zone_type or "greenhouse",
                    body.subject_name or "Standard Batch",
                    body.size,
                    body.depth,
                    body.status or "active",
                ],
            )

        if body.device_id or not existing:
            ensure_zone_device_config(zone_id, body.device_id)

        return {"success": True, "zone_id": zone_id}
    except Exception as exc:
        print(f"Zones POST error: {exc}")
        return api_error(500, f"Failed to save zone: {exc}")


@router.put("")
async def update_zone(body: ZoneBody):
    """PUT /api/zones - partial zone update (id required)."""
    try:
        if not body.id:
            return api_error(400, "Missing zone id")

        existing = db.query_one("SELECT id FROM zones WHERE id = ?", [body.id])
        if not existing:
            return api_error(404, "Zone not found")

        updates: list[str] = []
        values: list = []
        for column, value in (
            ("name", body.name),
            ("location", body.location),
            ("zone_type", body.zone_type),
            ("subject_name", body.subject_name),
            ("size_sqm", body.size),
            ("depth_m", body.depth),
            ("status", body.status),
        ):
            if value is not None:
                updates.append(f"{column} = ?")
                values.append(value)

        if updates:
            values.append(body.id)
            db.execute(f"UPDATE zones SET {', '.join(updates)} WHERE id = ?", values)

        if body.device_id:
            ensure_zone_device_config(body.id, body.device_id)

        return {"success": True, "message": f"Zone {body.id} updated successfully"}
    except Exception as exc:
        print(f"Zones PUT error: {exc}")
        return api_error(500, "Failed to update zone")


@router.delete("")
async def deactivate_zone(request: Request):
    """DELETE /api/zones?id= - soft-delete (status = inactive)."""
    zone_id = request.query_params.get("id")
    if not zone_id:
        return api_error(400, "Missing zone id")

    try:
        db.execute("UPDATE zones SET status = 'inactive' WHERE id = ?", [zone_id])
        return {"success": True, "message": f"Zone {zone_id} deactivated"}
    except Exception as exc:
        print(f"Zones DELETE error: {exc}")
        return api_error(500, "Failed to deactivate zone")
