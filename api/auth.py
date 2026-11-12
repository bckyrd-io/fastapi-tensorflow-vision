"""Auth routes - port of green-matrix/app/api/auth/* (login, logout, me)."""

from __future__ import annotations

import base64
import time

import bcrypt
from fastapi import APIRouter, Request
from pydantic import BaseModel

from api import db
from api.errors import api_error

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginBody(BaseModel):
    username: str | None = None
    password: str | None = None


@router.post("/login")
async def login(body: LoginBody):
    """POST /api/auth/login - validate credentials and issue a session token."""
    try:
        if not body.username or not body.password:
            return api_error(400, "Missing username or password")

        users = db.query(
            "SELECT id, username, email, password_hash, full_name, role, is_active "
            "FROM users WHERE username = ? AND is_active = TRUE",
            [body.username],
        )
        if not users:
            return api_error(401, "Invalid credentials")

        user = users[0]
        try:
            # bcryptjs hashes ($2a$...) are accepted by python-bcrypt as-is
            valid = bcrypt.checkpw(
                body.password.encode("utf-8"),
                user["password_hash"].encode("utf-8"),
            )
        except (ValueError, TypeError):
            valid = False

        if not valid:
            return api_error(401, "Invalid credentials")

        db.execute("UPDATE users SET last_login = NOW() WHERE id = ?", [user["id"]])

        # Same "simple token" the Next.js API issued: base64("<id>:<epoch ms>")
        token = base64.b64encode(
            f"{user['id']}:{int(time.time() * 1000)}".encode("utf-8")
        ).decode("ascii")

        return {
            "success": True,
            "user": {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
                "fullName": user["full_name"],
                "role": user["role"],
            },
            "token": token,
        }
    except Exception as exc:
        print(f"Login error: {exc}")
        return api_error(500, "Internal server error")


@router.get("/me")
async def me(request: Request):
    """GET /api/auth/me - return the first active user (Bearer required)."""
    auth_header = request.headers.get("authorization") or ""
    if not auth_header.startswith("Bearer "):
        return api_error(401, "Unauthorized")

    try:
        users = db.query(
            "SELECT id, username, email, full_name, role, is_active, last_login, created_at "
            "FROM users WHERE is_active = TRUE LIMIT 1"
        )
        if not users:
            return api_error(404, "No active users found")
        return {"success": True, "user": users[0]}
    except Exception as exc:
        print(f"Auth me error: {exc}")
        return api_error(500, "Internal server error")


@router.post("/logout")
async def logout():
    """POST /api/auth/logout - client-side session drop (same as the JS API)."""
    try:
        return {"success": True, "message": "Logged out successfully"}
    except Exception as exc:
        print(f"Logout error: {exc}")
        return api_error(500, "Internal server error")
