"""One-shot: generate R01 polyline and write to Firestore."""
import asyncio, sys
from datetime import datetime, timezone

sys.path.insert(0, ".")
from app.services.maps_service import generate_route_polyline
from app.services import firebase_service

ROUTE_ID = sys.argv[1] if len(sys.argv) > 1 else "R01"

async def main():
    print(f"Generating polyline for {ROUTE_ID} ...")
    result = await generate_route_polyline(ROUTE_ID)
    firebase_service.set_doc("routes", ROUTE_ID, {
        "route_id": ROUTE_ID,
        "polyline": result["polyline"],
        "travel_time_min": result["travel_time_min"],
        "last_generated": datetime.now(timezone.utc).isoformat(),
    })
    points = len(result["polyline"])
    mins = result["travel_time_min"]
    stops = result["stop_count"]
    print(f"Saved: {points} points, {mins} min travel time, {stops} stops")

asyncio.run(main())
