"""
Departure Confidence Score computation.

Strategy:
  1. Deterministic base score from occupancy + demand + idle time.
  2. Gemini provides a bounded adjustment (-10..+10) with a short reason.
  3. Soft-fail to the base score if Gemini times out or errors.
  4. 30-second in-process cache per driver to avoid hammering Gemini on every tick.
"""
import re
import math
import time
from app.services import firebase_service, gemini_service

FARE_PER_PASSENGER_PHP = 15.0
JEEP_CAPACITY = 18
_CACHE: dict[str, tuple[dict, float]] = {}
_CACHE_TTL_S = 30


def compute(driver_id: str, driver_doc: dict) -> dict:
    cached, ts = _CACHE.get(driver_id, ({}, 0.0))
    if cached and time.time() - ts < _CACHE_TTL_S:
        return cached

    route = driver_doc.get("route", "")
    on_board = int(driver_doc.get("occupancy_count", driver_doc.get("occupancy", 0)))

    # Minutes since the driver last updated their position
    mins_idle = _minutes_idle(driver_doc.get("last_updated"))

    waiting = firebase_service.query_collection(
        "passengers", [("route", "==", route), ("status", "==", "waiting")]
    )
    waiting_count = len(waiting)

    route_doc = firebase_service.get_doc("routes", route) if route else None
    travel_time_min = int((route_doc or {}).get("travel_time_min", 35))

    base = _base_confidence(on_board, JEEP_CAPACITY, waiting_count, mins_idle)

    try:
        prompt = _adjustment_prompt(base, on_board, JEEP_CAPACITY, waiting_count, mins_idle)
        raw = gemini_service.ask_gemini(prompt)
        adj, recommendation = _parse_adjustment(raw)
        adj = max(-10, min(10, adj))
        score = max(0, min(100, base + adj))
    except Exception:
        score = base
        recommendation = "Depart Now" if score >= 70 else "Wait a bit longer"

    total_potential = on_board + waiting_count
    result = {
        "driver_id": driver_id,
        "score": score,
        "expected_passengers": str(total_potential),
        "travel_time_min": travel_time_min,
        "expected_revenue": total_potential * FARE_PER_PASSENGER_PHP,
        "recommendation": recommendation,
    }
    _CACHE[driver_id] = (result, time.time())
    return result


def _base_confidence(on_board: int, capacity: int, waiting: int, mins_idle: float) -> int:
    """Deterministic 0-100 score based on load and idle pressure."""
    fill = min((on_board + waiting) / capacity, 1.0)
    load_score = int(math.pow(fill, 0.7) * 85)
    idle_bonus = min(int(mins_idle * 3), 15)
    return min(load_score + idle_bonus, 100)


def _minutes_idle(last_updated) -> float:
    try:
        from datetime import datetime, timezone
        if last_updated is None:
            return 0.0
        if isinstance(last_updated, str):
            dt = datetime.fromisoformat(last_updated.replace("Z", "+00:00"))
        else:
            dt = last_updated
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - dt).total_seconds() / 60
    except Exception:
        return 0.0


def _adjustment_prompt(base: int, on_board: int, capacity: int, waiting: int, mins_idle: float) -> str:
    return (
        f"You are a jeepney dispatch AI for Pasada (Philippine transport app).\n\n"
        f"Situation:\n"
        f"- On board: {on_board}/{capacity}\n"
        f"- Waiting at stops ahead: {waiting}\n"
        f"- Driver idle: {mins_idle:.1f} min\n"
        f"- Base departure confidence: {base}/100\n\n"
        f"Give a BOUNDED ADJUSTMENT from -10 to +10 and a short recommendation (max 6 words).\n"
        f"Consider: rush hour, earnings, fairness to waiting passengers.\n\n"
        f"Reply in EXACTLY this format:\n"
        f"ADJUSTMENT: <integer>\n"
        f"RECOMMENDATION: <phrase>"
    )


def _parse_adjustment(raw: str) -> tuple[int, str]:
    adj = int(re.search(r"ADJUSTMENT:\s*([+-]?\d+)", raw).group(1))
    rec = re.search(r"RECOMMENDATION:\s*(.+)", raw).group(1).strip()
    return adj, rec
