"""Pond routes - port of green-matrix/app/api/ponds/route.ts."""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

from api import db
from api.errors import api_error

router = APIRouter(prefix="/api/ponds", tags=["ponds"])

POND_COLUMNS = "id, name, location, size_sqm, depth_m, species, status"


class PondBody(BaseModel):
    id: str | None = None
    name: str | None = None
    location: str | None = None
    size: float | str | None = None
    depth: float | str | None = None
    species: str | None = None
    status: str | None = None
    device_id: str | None = None
    device_name: str | None = None
    device_mac: str | None = None
    is_hardware_registration: bool | None = None


def ensure_device_config(pond_id: str, device_id: str | None) -> None:
    """Create a default threshold config when a device registers a pond.

    Never overwrites an existing configuration (ON CONFLICT DO NOTHING).
    """
    if not pond_id or not device_id:
        return

    db.execute(
        """
        INSERT INTO pond_configs
          (pond_id, device_id, temp_min, temp_optimal, temp_max,
           ph_min, ph_optimal, ph_max, humidity_min, humidity_optimal, humidity_max,
           water_level_min, water_level_optimal, water_level_max)
        VALUES (?, ?, 20, 25, 30, 6.5, 7.0, 8.5, 60, 70, 80, 1.0, 1.5, 2.0)
        ON CONFLICT (pond_id) DO NOTHING
        """,
        [pond_id, device_id],
    )


@router.get("")
async def list_ponds(request: Request):
    """GET /api/ponds - every pond, or one pond with ?id= (& ?config=true)."""
    pond_id = request.query_params.get("id")
    want_config = request.query_params.get("config")

    try:
        if pond_id:
            ponds = db.query(f"SELECT {POND_COLUMNS} FROM ponds WHERE id = ?", [pond_id])
            if not ponds:
                return api_error(404, "Pond not found")

            if want_config:
                configs = db.query(
                    "SELECT temp_min, temp_optimal, temp_max, ph_min, ph_optimal, ph_max, "
                    "humidity_min, humidity_optimal, humidity_max, water_level_min, "
                    "water_level_optimal, water_level_max, device_id, device_name, device_mac "
                    "FROM pond_configs WHERE pond_id = ?",
                    [pond_id],
                )
                return {"pond": ponds[0], "config": configs[0] if configs else None}

            return {"pond": ponds[0]}

        ponds = db.query(
            f"""
            SELECT
              p.id, p.name, p.location, p.size_sqm, p.depth_m, p.species, p.status,
              pc.device_id, pc.device_name, pc.device_mac,
              pc.temp_min, pc.temp_optimal, pc.temp_max,
              pc.ph_min, pc.ph_optimal, pc.ph_max,
              pc.humidity_min, pc.humidity_optimal, pc.humidity_max,
              pc.water_level_min, pc.water_level_optimal, pc.water_level_max
            FROM ponds p
            LEFT JOIN pond_configs pc ON p.id = pc.pond_id
            """
        )
        return {"ponds": ponds}
    except Exception as exc:
        print(f"Ponds GET error: {exc}")
        return api_error(500, "Failed to fetch pond data")


@router.post("")
async def create_or_update_pond(body: PondBody):
    """POST /api/ponds - hardware (ESP32 / simulator) pond registration."""
    try:
        if not body.name or not body.location:
            return api_error(400, "Missing required fields: name, location")

        pond_id = body.id or body.name.lower().replace(" ", "-")
        size = body.size if body.size not in (None, "") else 500
        depth = body.depth if body.depth not in (None, "") else 1.5
        species = body.species or "Tilapia"

        existing = db.query("SELECT id FROM ponds WHERE id = ?", [pond_id])

        if existing:
            db.execute(
                "UPDATE ponds SET name = ?, location = ?, size_sqm = ?, depth_m = ?, "
                "species = ?, status = 'active' WHERE id = ?",
                [body.name, body.location, size, depth, species, pond_id],
            )
            # Hardware registration (ESP32 or simulator) also registers the device so
            # threshold monitoring can run for this pond.
            ensure_device_config(pond_id, body.device_id)

            return {
                "success": True,
                "message": "Pond updated successfully",
                "pond": {
                    "id": pond_id,
                    "name": body.name,
                    "location": body.location,
                    "size": size,
                    "depth": depth,
                    "species": species,
                    "status": "active",
                },
            }

        db.execute(
            "INSERT INTO ponds (id, name, location, size_sqm, depth_m, species, status) "
            "VALUES (?, ?, ?, ?, ?, ?, 'active')",
            [pond_id, body.name, body.location, size, depth, species],
        )
        # Hardware registration (ESP32 or simulator) also registers the device so
        # threshold monitoring can run for the new pond.
        ensure_device_config(pond_id, body.device_id)

        return {
            "success": True,
            "pond": {
                "id": pond_id,
                "name": body.name,
                "location": body.location,
                "size": size,
                "depth": depth,
                "species": species,
                "status": "active",
            },
        }
    except Exception as exc:
        print(f"Pond POST error: {exc}")
        return api_error(500, "Failed to create pond")


@router.put("")
async def update_pond(body: PondBody):
    """PUT /api/ponds - partial pond update."""
    try:
        if not body.id:
            return api_error(400, "Missing pond id")

        existing = db.query("SELECT id FROM ponds WHERE id = ?", [body.id])
        if not existing:
            return api_error(404, "Pond not found")

        updates, params = [], []
        for field, column in (
            ("name", "name"),
            ("location", "location"),
            ("size", "size_sqm"),
            ("depth", "depth_m"),
            ("species", "species"),
            ("status", "status"),
        ):
            value = getattr(body, field)
            if value is not None and value != "":
                updates.append(f"{column} = ?")
                params.append(value)

        if updates:
            params.append(body.id)
            db.execute(f"UPDATE ponds SET {', '.join(updates)} WHERE id = ?", params)

        return {"success": True, "message": f"Pond {body.id} updated successfully"}
    except Exception as exc:
        print(f"Pond PUT error: {exc}")
        return api_error(500, "Failed to update pond")


@router.delete("")
async def deactivate_pond(request: Request):
    """DELETE /api/ponds?id= - soft-delete (status = inactive)."""
    pond_id = request.query_params.get("id")
    if not pond_id:
        return api_error(400, "Missing pond id")

    try:
        db.execute("UPDATE ponds SET status = 'inactive' WHERE id = ?", [pond_id])
        return {"success": True, "message": f"Pond {pond_id} deactivated"}
    except Exception as exc:
        print(f"Pond DELETE error: {exc}")
        return api_error(500, "Failed to deactivate pond")
