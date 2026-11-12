"""Shared helpers for the AquaMonitor FastAPI routes."""

from __future__ import annotations

from fastapi.responses import JSONResponse


def api_error(status: int, message: str, **extra) -> JSONResponse:
    """Build the same ``{"error": ...}`` bodies NextResponse.json produced."""
    body = {"error": message}
    body.update(extra)
    return JSONResponse(status_code=status, content=body)


def js_number(value) -> float | int | None:
    """Mimic JavaScript's number rendering in JSON (20.0 -> 20)."""
    if value is None:
        return None
    number = float(value)
    return int(number) if number.is_integer() else number


def to_fixed(value, digits: int) -> float:
    """Equivalent of ``parseFloat(x.toFixed(digits))``.

    JavaScript rounds the *exact* binary value of the double: it picks the
    integer ``n`` closest to ``value * 10**digits`` and, on a tie, the larger
    ``n``.  Python's ``format()`` uses round-half-even (``24.25`` -> ``24.2``)
    and ``value * 10**d`` can round across the tie boundary (``25.45 * 10``
    becomes exactly ``254.5``), so go through ``Decimal(float)`` which holds
    the exact expansion, rounding half away-from-zero for positives and
    half-toward-zero for negatives (the JS "larger n" tie-break).
    """
    from decimal import ROUND_HALF_DOWN, ROUND_HALF_UP, Decimal

    number = Decimal(float(value))
    quantum = Decimal(1).scaleb(-digits)
    rounding = ROUND_HALF_UP if number >= 0 else ROUND_HALF_DOWN
    return float(number.quantize(quantum, rounding=rounding))


def js_round(value) -> int:
    """Equivalent of ``Math.round`` for non-negative values."""
    import math

    return int(math.floor(float(value) + 0.5))
