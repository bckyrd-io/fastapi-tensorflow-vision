"""User management routes - port of green-matrix/app/api/users/*."""

from __future__ import annotations

import bcrypt
from fastapi import APIRouter, Request
from pydantic import BaseModel

from api import db
from api.errors import api_error

router = APIRouter(prefix="/api/users", tags=["users"])

USER_COLUMNS = (
    "id, username, email, full_name, role, is_active, last_login, created_at"
)


class CreateUserBody(BaseModel):
    username: str | None = None
    email: str | None = None
    password: str | None = None
    fullName: str | None = None
    role: str | None = None


class ToggleUserBody(BaseModel):
    id: int | str | None = None
    isActive: bool | None = None


class UpdateUserBody(BaseModel):
    username: str | None = None
    email: str | None = None
    password: str | None = None
    fullName: str | None = None
    role: str | None = None
    isActive: bool | None = None


@router.get("")
async def list_users(request: Request):
    """GET /api/users - all users, or one user with ?id=."""
    user_id = request.query_params.get("id")
    try:
        if user_id:
            users = db.query(f"SELECT {USER_COLUMNS} FROM users WHERE id = ?", [user_id])
            if not users:
                return api_error(404, "User not found")
            return {"user": users[0]}

        users = db.query(f"SELECT {USER_COLUMNS} FROM users ORDER BY created_at DESC")
        return {"users": users}
    except Exception as exc:
        print(f"Users GET error: {exc}")
        return api_error(500, "Failed to fetch users")


@router.post("")
async def create_user(body: CreateUserBody):
    """POST /api/users - register a new user (admin only)."""
    try:
        username, email, password, full_name, role = (
            body.username,
            body.email,
            body.password,
            body.fullName,
            body.role,
        )
        if not username or not email or not password or not role:
            return api_error(
                400, "Missing required fields: username, email, password, role"
            )

        existing = db.query(
            "SELECT id FROM users WHERE username = ? OR email = ?", [username, email]
        )
        if existing:
            return api_error(409, "Username or email already exists")

        password_hash = bcrypt.hashpw(
            password.encode("utf-8"), bcrypt.gensalt(rounds=10)
        ).decode("utf-8")

        result = db.execute(
            "INSERT INTO users (username, email, password_hash, full_name, role, is_active) "
            "VALUES (?, ?, ?, ?, ?, TRUE)",
            [username, email, password_hash, full_name or username, role],
        )

        return {
            "success": True,
            "userId": result["insertId"],
            "message": "User created successfully",
        }
    except Exception as exc:
        print(f"User POST error: {exc}")
        return api_error(500, "Failed to create user")


@router.put("")
async def toggle_user(body: ToggleUserBody):
    """PUT /api/users - enable/disable a user (usage page toggle)."""
    try:
        if body.id is None or body.isActive is None:
            return api_error(400, "Missing required fields: id, isActive")

        db.execute("UPDATE users SET is_active = ? WHERE id = ?", [body.isActive, body.id])
        return {"success": True}
    except Exception as exc:
        print(f"Users PUT error: {exc}")
        return api_error(500, "Failed to update user")


@router.delete("")
async def delete_user(request: Request):
    """DELETE /api/users?id= - permanently delete a user."""
    user_id = request.query_params.get("id")
    if not user_id:
        return api_error(400, "Missing user id")

    try:
        result = db.execute("DELETE FROM users WHERE id = ?", [user_id])
        if result["affectedRows"] == 0:
            return api_error(404, "User not found")

        return {
            "success": True,
            "message": f"User {user_id} permanently deleted",
        }
    except Exception as exc:
        print(f"User DELETE error: {exc}")
        return api_error(500, "Failed to delete user")


@router.put("/{user_id}")
async def update_user(user_id: str, body: UpdateUserBody):
    """PUT /api/users/[id] - edit profile, role, password or status."""
    try:
        parsed_id = int(user_id)
    except (TypeError, ValueError):
        return api_error(400, "Invalid user ID")

    try:
        existing = db.query("SELECT id FROM users WHERE id = ?", [parsed_id])
        if not existing:
            return api_error(404, "User not found")

        if body.username or body.email:
            conditions, values = [], []
            if body.username:
                conditions.append("username = ?")
                values.append(body.username)
            if body.email:
                conditions.append("email = ?")
                values.append(body.email)
            duplicates = db.query(
                f"SELECT id FROM users WHERE ({' OR '.join(conditions)}) AND id != ?",
                [*values, parsed_id],
            )
            if duplicates:
                return api_error(409, "Username or email already exists")

        update_fields, update_values = [], []
        if body.username is not None:
            update_fields.append("username = ?")
            update_values.append(body.username)
        if body.email is not None:
            update_fields.append("email = ?")
            update_values.append(body.email)
        if body.fullName is not None:
            update_fields.append("full_name = ?")
            update_values.append(body.fullName)
        if body.role is not None:
            update_fields.append("role = ?")
            update_values.append(body.role)
        if body.isActive is not None:
            update_fields.append("is_active = ?")
            update_values.append(body.isActive)
        if body.password:
            password_hash = bcrypt.hashpw(
                body.password.encode("utf-8"), bcrypt.gensalt(rounds=10)
            ).decode("utf-8")
            update_fields.append("password_hash = ?")
            update_values.append(password_hash)

        if not update_fields:
            return api_error(400, "No fields to update")

        update_values.append(parsed_id)
        db.execute(
            f"UPDATE users SET {', '.join(update_fields)} WHERE id = ?", update_values
        )

        updated = db.query(f"SELECT {USER_COLUMNS} FROM users WHERE id = ?", [parsed_id])
        return {
            "success": True,
            "user": updated[0] if updated else None,
            "message": "User updated successfully",
        }
    except Exception as exc:
        print(f"Users PUT error: {exc}")
        return api_error(500, "Failed to update user")
