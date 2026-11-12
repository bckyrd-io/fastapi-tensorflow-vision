"""PostgreSQL access layer for the AquaMonitor FastAPI backend.

This is a 1:1 Python port of ``green-matrix/lib/database.js`` so that SQL
semantics stay identical to the Next.js API it replaces:

  * ``?`` placeholders are rewritten to psycopg2's ``%s``
  * INSERTs into identity tables get an automatic ``RETURNING id``
    (the JS shim exposed it as ``insertId``)
  * SELECT rows come back as ``list[dict]`` with values shaped the way
    node-postgres produced them: NUMERIC -> string, int8 (BIGINT, i.e.
    COUNT/SUM) -> string, TIMESTAMPTZ -> ISO-8601 UTC with millisecond
    precision (``...559Z``), INTEGER/BOOLEAN -> native
"""

from __future__ import annotations

import os
import re
from contextlib import contextmanager
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Iterator, Sequence

from psycopg2 import pool as pg_pool
from psycopg2.extras import RealDictCursor

# Tables whose INSERT statements receive an automatic ``RETURNING id``.
SERIAL_TABLES = {
    "alerts",
    "feeding_logs",
    "feeding_schedules",
    "sensor_readings",
    "users",
}


# --------------------------------------------------------------------------- #
# configuration
# --------------------------------------------------------------------------- #
def _load_env_file(path: str = ".env") -> None:
    """Minimal .env reader - avoids pulling in an extra dependency."""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            if key and key not in os.environ:
                os.environ[key] = value.strip()


_load_env_file()


def _dsn() -> str:
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    return "postgresql://{user}:{password}@{host}:{port}/{database}".format(
        user=os.environ.get("PGUSER", "postgres"),
        password=os.environ.get("PGPASSWORD", ""),
        host=os.environ.get("PGHOST", "localhost"),
        port=os.environ.get("PGPORT", "5432"),
        database=os.environ.get("PGDATABASE", "db_pond"),
    )


_pool: pg_pool.ThreadedConnectionPool | None = None


def _get_pool() -> pg_pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = pg_pool.ThreadedConnectionPool(minconn=1, maxconn=10, dsn=_dsn())
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None


# --------------------------------------------------------------------------- #
# SQL translation
# --------------------------------------------------------------------------- #
_INSERT_RE = re.compile(r"^\s*INSERT\s+INTO\s+([\w\"]+)", re.IGNORECASE)


def prepare(sql: str) -> str:
    """Translate Next.js-style SQL into psycopg2-style SQL."""
    statement = sql.replace("%", "%%")  # literal percent signs stay literal

    match = _INSERT_RE.match(statement)
    if match:
        table = match.group(1).replace('"', "").lower()
        if table in SERIAL_TABLES and not re.search(r"\bRETURNING\b", statement, re.IGNORECASE):
            statement = f"{statement.strip().rstrip(';')} RETURNING id"

    return statement.replace("?", "%s")


# --------------------------------------------------------------------------- #
# value shaping (node-postgres compatibility)
# --------------------------------------------------------------------------- #
def _iso_utc(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    value = value.astimezone(timezone.utc)
    return "{}.{:03d}Z".format(
        value.strftime("%Y-%m-%dT%H:%M:%S"), value.microsecond // 1000
    )


def to_json_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, datetime):
        return _iso_utc(value)
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, (memoryview, bytearray, bytes)):
        return bytes(value).decode("utf-8", errors="replace")
    return value


def _row(row: Any, int8_cols: frozenset[str] = frozenset()) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in dict(row).items():
        # node-postgres renders PostgreSQL int8 (BIGINT: COUNT/SUM results) as a
        # JavaScript string because float64 can't hold every int8 exactly.
        if key in int8_cols and isinstance(value, int) and not isinstance(value, bool):
            out[key] = str(value)
            continue
        out[key] = to_json_value(value)
    return out


# --------------------------------------------------------------------------- #
# execution helpers
# --------------------------------------------------------------------------- #
@contextmanager
def _connection(commit: bool = False) -> Iterator[Any]:
    """Hand out a pooled connection.

    ``commit=True`` commits on success - node-postgres' ``pool.query`` commits
    each statement implicitly, so plain ``execute()`` must too. Read-only
    ``query()`` rolls back instead so no transaction leaks back into the pool.
    """
    conn = _get_pool().getconn()
    try:
        yield conn
        if commit:
            conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:  # pragma: no cover - connection already broken
            pass
        raise
    finally:
        try:
            conn.rollback()  # no-op after a commit / explicit rollback
        except Exception:  # pragma: no cover
            pass
        _get_pool().putconn(conn)


class _Transaction:
    """Object handed to ``transaction()`` callbacks - mirrors the JS connection."""

    def __init__(self, conn: Any) -> None:
        self._conn = conn

    def query(self, sql: str, params: Sequence[Any] = ()) -> list[dict[str, Any]]:
        return _run_query(self._conn, sql, params)

    def execute(self, sql: str, params: Sequence[Any] = ()) -> dict[str, Any]:
        return _run_execute(self._conn, sql, params)


def _run_query(conn: Any, sql: str, params: Sequence[Any]) -> list[dict[str, Any]]:
    statement = prepare(sql)
    with conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(statement, tuple(params or ()))
        if cursor.description is None:
            return []
        int8_cols = frozenset(
            # 20 == pg_catalog.int8 (BIGINT); psycopg2 doesn't re-export the
            # OID constants, so match the raw OID like node-pg's type parsers do.
            desc.name for desc in cursor.description if desc.type_code == 20
        )
        return [_row(row, int8_cols) for row in cursor.fetchall()]


def _run_execute(conn: Any, sql: str, params: Sequence[Any]) -> dict[str, Any]:
    statement = prepare(sql)
    with conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(statement, tuple(params or ()))
        rows = cursor.fetchall() if cursor.description else []
        insert_id = None
        if rows:
            first = rows[0]
            insert_id = first.get("id") if isinstance(first, dict) else None
        return {"insertId": insert_id, "affectedRows": cursor.rowcount}


def query(sql: str, params: Sequence[Any] = ()) -> list[dict[str, Any]]:
    """Run a statement and return every row as a dict (SELECT / RETURNING)."""
    with _connection() as conn:
        return _run_query(conn, sql, params)


def query_one(sql: str, params: Sequence[Any] = ()) -> dict[str, Any] | None:
    rows = query(sql, params)
    return rows[0] if rows else None


def execute(sql: str, params: Sequence[Any] = ()) -> dict[str, Any]:
    """Run a statement and commit it; returns ``{"insertId": ..., "affectedRows": ...}``."""
    with _connection(commit=True) as conn:
        return _run_execute(conn, sql, params)


@contextmanager
def transaction() -> Iterator[_Transaction]:
    """BEGIN/COMMIT/ROLLBACK wrapper - mirrors ``database.transaction()``."""
    with _connection() as conn:
        tx = _Transaction(conn)
        try:
            yield tx
            conn.commit()
        except Exception:
            conn.rollback()
            raise


def test_connection() -> bool:
    try:
        row = query_one("SELECT 1 AS test")
        print("Database connection successful" if row else "Database connection failed")
        return bool(row)
    except Exception as exc:  # pragma: no cover
        print(f"Database connection failed: {exc}")
        return False
