#!/usr/bin/env python
"""
Interactive script: assign stop order for any route, then seed the ORS polyline.

Usage (from backend/ directory):
    python seed_stops.py R01
"""
import sys
import os
import asyncio

sys.path.insert(0, os.path.dirname(__file__))

from app.services import firebase_service
from app.services.maps_service import generate_route_polyline


def main(route_id: str):
    # ── 1. Read all stops for this route ──────────────────────────────────────
    stops = firebase_service.query_collection("stops", [("route", "==", route_id)])

    if not stops:
        print(f"No stops found for route '{route_id}'. Add them to Firestore first.")
        sys.exit(1)

    print(f"\nFound {len(stops)} stop(s) for route {route_id}:\n")
    for s in stops:
        order_val = s.get("order", "—")
        print(f"  [{order_val:>2}]  {s['id']:<25}  {s['name']}  ({s['lat']}, {s['lng']})")

    # ── 2. Ask for order ───────────────────────────────────────────────────────
    print(
        "\nEnter stop IDs in route order, comma-separated "
        "(left = first stop, right = last stop)."
    )
    print("Example: lumban-terminal,lewin,pagsawitan-jct,bubukal,stcruz-market")
    raw = input("> ").strip()

    ordered_ids = [s.strip() for s in raw.split(",") if s.strip()]
    stop_map = {s["id"]: s for s in stops}

    missing = [sid for sid in ordered_ids if sid not in stop_map]
    if missing:
        print(f"\nUnknown stop ID(s): {', '.join(missing)}")
        sys.exit(1)

    # ── 3. Write order field back to each stop ─────────────────────────────────
    print("\nWriting order fields to Firestore...")
    for idx, stop_id in enumerate(ordered_ids):
        firebase_service.set_doc("stops", stop_id, {"order": idx})
        print(f"  stops/{stop_id}  →  order={idx}  ({stop_map[stop_id]['name']})")

    # ── 4. Generate ORS polyline and write to routes/{route_id} ───────────────
    print(f"\nGenerating road-following polyline for {route_id} via ORS...")
    result = asyncio.run(generate_route_polyline(route_id))

    from datetime import datetime, timezone
    firebase_service.set_doc("routes", route_id, {
        "route_id": route_id,
        "polyline": result["polyline"],
        "travel_time_min": result["travel_time_min"],
        "last_generated": datetime.now(timezone.utc).isoformat(),
    })

    print(
        f"\nDone. routes/{route_id} written — "
        f"{len(result['polyline'])} points, "
        f"{result['travel_time_min']:.1f} min travel time."
    )
    print("The driver sim will pick up the new polyline automatically on next trip start.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python seed_stops.py <route_id>")
        print("Example: python seed_stops.py R01")
        sys.exit(1)
    main(sys.argv[1])
