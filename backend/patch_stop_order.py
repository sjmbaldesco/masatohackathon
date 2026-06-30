"""
Patch missing `order` fields on R01 stops, then generate and save the polyline.
Sorts stops by longitude descending (east→west: Lumban→Sta.Cruz).
"""
import asyncio, sys
sys.path.insert(0, ".")
from datetime import datetime, timezone
from app.services import firebase_service
from app.services.maps_service import generate_route_polyline

ROUTE_ID = sys.argv[1] if len(sys.argv) > 1 else "R01"

def main():
    stops = firebase_service.query_collection("stops", [("route", "==", ROUTE_ID)])
    if not stops:
        print(f"No stops found for route {ROUTE_ID}. Aborting.")
        sys.exit(1)

    # Sort east→west by longitude descending (Lumban is easternmost)
    stops_sorted = sorted(stops, key=lambda s: s["lng"], reverse=True)

    print(f"Assigning order to {len(stops_sorted)} stops:")
    for i, stop in enumerate(stops_sorted):
        label = stop.get("stop") or stop.get("name") or stop["id"]
        print(f"  {i}: {label}  ({stop['lat']}, {stop['lng']})")
        firebase_service.set_doc("stops", stop["id"], {"order": i})

    print("\nGenerating polyline via ORS...")
    result = asyncio.run(generate_route_polyline(ROUTE_ID))

    firebase_service.set_doc("routes", ROUTE_ID, {
        "route_id": ROUTE_ID,
        "polyline": result["polyline"],
        "travel_time_min": result["travel_time_min"],
        "last_generated": datetime.now(timezone.utc).isoformat(),
    })
    print(f"Saved polyline: {len(result['polyline'])} points, "
          f"{result['travel_time_min']} min, {result['stop_count']} stops")
    print("\nDone. Now run: python seed_demo.py && python start_demo.py")

main()
