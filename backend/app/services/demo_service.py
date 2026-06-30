"""
Demo mode service — fake jeeps + passengers that move in real-time via Firestore.

All demo Firestore document IDs are prefixed with "demo-" so they never conflict
with real driver/passenger accounts.

Public API:
    seed_demo(route_id)   – write initial driver + passenger docs to Firestore
    start_demo(route_id)  – launch async ticker that moves jeeps every second
    stop_demo(route_id)   – cancel the ticker, freeze jeeps in place
    clear_demo(route_id)  – delete all demo-* docs, reset stop counts
    is_running(route_id)  – bool
"""
import asyncio
import math
import random
from datetime import datetime, timezone
from typing import Optional

from app.services import firebase_service

# ---------------------------------------------------------------------------
# Demo driver definitions
# ---------------------------------------------------------------------------

DEMO_DRIVERS = [
    {"uid": "demo-driver-1", "driver_name": "J. Dela Cruz", "plate": "ABC 1234", "capacity": 18, "start_offset": 0.0},
    {"uid": "demo-driver-2", "driver_name": "R. Santos",    "plate": "XYZ 5678", "capacity": 18, "start_offset": 0.30},
    {"uid": "demo-driver-3", "driver_name": "M. Reyes",     "plate": "LMN 9012", "capacity": 18, "start_offset": 0.60},
]

# ---------------------------------------------------------------------------
# Running task registry
# ---------------------------------------------------------------------------

_demo_tasks: dict[str, asyncio.Task] = {}


def is_running(route_id: str) -> bool:
    task = _demo_tasks.get(route_id)
    return task is not None and not task.done()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _km_between(p1: list, p2: list) -> float:
    dlat = (p2[0] - p1[0]) * 111.0
    dlng = (p2[1] - p1[1]) * 111.0 * math.cos(math.radians(p1[0]))
    return math.hypot(dlat, dlng)


def _closest_stop(lat: float, lng: float, stops: list[dict]) -> str:
    if not stops:
        return "Unknown"
    closest = min(stops, key=lambda s: math.hypot(s["lat"] - lat, s["lng"] - lng))
    return closest.get("stop") or closest.get("name") or closest["id"]


def _get_route_data(route_id: str) -> tuple[list, list]:
    """Return (polyline, ordered_stops) or raise ValueError."""
    route_doc = firebase_service.get_doc("routes", route_id)
    if not route_doc or not route_doc.get("polyline"):
        raise ValueError(
            f"Route {route_id} has no polyline. "
            f"Run POST /routes/{route_id}/generate first."
        )
    raw = route_doc["polyline"]
    # Firestore stores as [{lat, lng}] dicts — convert to [[lat, lng]] for math
    polyline = [[p["lat"], p["lng"]] if isinstance(p, dict) else p for p in raw]
    stops = sorted(
        firebase_service.query_collection("stops", [("route", "==", route_id)]),
        key=lambda s: s.get("order", 0),
    )
    return polyline, stops


# ---------------------------------------------------------------------------
# seed_demo
# ---------------------------------------------------------------------------

def seed_demo(route_id: str) -> dict:
    """
    Idempotent. Writes 3 demo drivers and 1–3 passengers per stop to Firestore.
    Deletes any existing demo passengers for this route before writing new ones.
    """
    polyline, stops = _get_route_data(route_id)
    n = len(polyline)

    # ── Seed drivers ──────────────────────────────────────────────────────────
    for driver in DEMO_DRIVERS:
        idx = int(driver["start_offset"] * (n - 1))
        lat, lng = polyline[idx]
        firebase_service.set_doc(
            "drivers",
            driver["uid"],
            {
                "uid": driver["uid"],
                "driver_name": driver["driver_name"],
                "plate": driver["plate"],
                "route": route_id,
                "capacity": driver["capacity"],
                "occupancy_count": 0,
                "occupancy_pct": 0,
                "speed_kmh": 0,
                "lat": lat,
                "lng": lng,
                "current_stop": _closest_stop(lat, lng, stops),
                "status": "idle",
                "last_updated": datetime.now(timezone.utc).isoformat(),
            },
            merge=False,  # full overwrite so re-runs reset cleanly
        )

    # ── Delete existing demo passengers for this route ────────────────────────
    existing = firebase_service.query_collection("passengers", [("route", "==", route_id)])
    for pax in existing:
        if pax["id"].startswith("demo-"):
            firebase_service.delete_doc("passengers", pax["id"])

    # ── Seed new passengers ───────────────────────────────────────────────────
    total_pax = 0
    stop_counts: dict[str, int] = {}

    for stop in stops:
        count = random.randint(1, 3)
        stop_counts[stop["id"]] = count
        for i in range(count):
            pax_id = f"demo-{route_id}-{stop['id']}-pax-{i}"
            firebase_service.set_doc(
                "passengers",
                pax_id,
                {
                    "route": route_id,
                    "status": "waiting",
                    "lat": stop["lat"] + random.uniform(-0.0002, 0.0002),
                    "lng": stop["lng"] + random.uniform(-0.0002, 0.0002),
                    "stop": stop.get("stop") or stop.get("name") or stop["id"],
                },
                merge=False,
            )
            total_pax += 1

    # ── Update each stop's count field ───────────────────────────────────────
    for stop in stops:
        firebase_service.set_doc(
            "stops",
            stop["id"],
            {"count": stop_counts.get(stop["id"], 0)},
        )

    return {
        "route_id": route_id,
        "drivers_seeded": len(DEMO_DRIVERS),
        "passengers_seeded": total_pax,
    }


# ---------------------------------------------------------------------------
# run_demo  (async ticker — runs until cancelled)
# ---------------------------------------------------------------------------

async def run_demo(route_id: str) -> None:
    polyline, stops = _get_route_data(route_id)

    SPEED_KMH = 30
    STEP_KM = SPEED_KMH / 3600  # km advanced per 1-second tick

    # Initialise per-driver state from current Firestore positions
    states: dict[str, dict] = {}
    for d in DEMO_DRIVERS:
        doc = firebase_service.get_doc("drivers", d["uid"])
        if doc:
            lat, lng = doc.get("lat", polyline[0][0]), doc.get("lng", polyline[0][1])
            start_idx = min(
                range(len(polyline)),
                key=lambda i: math.hypot(polyline[i][0] - lat, polyline[i][1] - lng),
            )
            states[d["uid"]] = {
                **d,
                "idx": start_idx,
                "occupancy": doc.get("occupancy_count", 0),
            }

    try:
        while True:
            for uid, state in list(states.items()):
                idx = state["idx"]

                # Looped to end — reset to beginning
                if idx >= len(polyline) - 1:
                    states[uid]["idx"] = 0
                    states[uid]["occupancy"] = 0
                    firebase_service.set_doc(
                        "drivers", uid,
                        {"status": "idle", "speed_kmh": 0,
                         "lat": polyline[0][0], "lng": polyline[0][1]},
                    )
                    continue

                # Advance index until accumulated distance >= STEP_KM
                next_idx = idx + 1
                accumulated = 0.0
                while next_idx < len(polyline) - 1:
                    accumulated += _km_between(polyline[next_idx - 1], polyline[next_idx])
                    if accumulated >= STEP_KM:
                        break
                    next_idx += 1

                lat, lng = polyline[next_idx]
                states[uid]["idx"] = next_idx

                # Realistic occupancy drift: ±1 per tick, clamped 0–18
                occ = state["occupancy"] + random.randint(-1, 2)
                occ = max(0, min(18, occ))
                states[uid]["occupancy"] = occ

                firebase_service.set_doc(
                    "drivers", uid,
                    {
                        "lat": lat,
                        "lng": lng,
                        "speed_kmh": SPEED_KMH,
                        "current_stop": _closest_stop(lat, lng, stops),
                        "occupancy_count": occ,
                        "occupancy_pct": round(occ / 18 * 100),
                        "status": "in_transit",
                        "last_updated": datetime.now(timezone.utc).isoformat(),
                    },
                )

            await asyncio.sleep(1)

    except asyncio.CancelledError:
        # Freeze jeeps in place when stopped
        for uid in states:
            firebase_service.set_doc(
                "drivers", uid,
                {"status": "idle", "speed_kmh": 0},
            )
        raise


# ---------------------------------------------------------------------------
# start_demo / stop_demo
# ---------------------------------------------------------------------------

async def start_demo(route_id: str) -> dict:
    if is_running(route_id):
        return {"status": "already_running", "route_id": route_id}
    task = asyncio.create_task(run_demo(route_id))
    _demo_tasks[route_id] = task
    return {"status": "started", "route_id": route_id}


async def stop_demo(route_id: str) -> dict:
    task = _demo_tasks.get(route_id)
    if task and not task.done():
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    _demo_tasks.pop(route_id, None)
    return {"status": "stopped", "route_id": route_id}


# ---------------------------------------------------------------------------
# clear_demo
# ---------------------------------------------------------------------------

def clear_demo(route_id: str) -> dict:
    """Delete all demo-* driver and passenger docs, reset stop counts."""
    deleted_drivers = 0
    deleted_passengers = 0

    # Delete demo drivers for this route
    drivers = firebase_service.query_collection("drivers", [("route", "==", route_id)])
    for d in drivers:
        if d["id"].startswith("demo-"):
            firebase_service.delete_doc("drivers", d["id"])
            deleted_drivers += 1

    # Delete demo passengers for this route
    passengers = firebase_service.query_collection("passengers", [("route", "==", route_id)])
    for p in passengers:
        if p["id"].startswith("demo-"):
            firebase_service.delete_doc("passengers", p["id"])
            deleted_passengers += 1

    # Reset stop counts to 0
    stops = firebase_service.query_collection("stops", [("route", "==", route_id)])
    for stop in stops:
        firebase_service.set_doc("stops", stop["id"], {"count": 0})

    return {
        "route_id": route_id,
        "deleted_drivers": deleted_drivers,
        "deleted_passengers": deleted_passengers,
    }
