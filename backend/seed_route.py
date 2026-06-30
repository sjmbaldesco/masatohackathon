"""
Replace R01 stops with the real Lumban → Sta. Cruz route, then regenerate polyline.
Run once: python seed_route.py
"""
import asyncio, sys
sys.path.insert(0, ".")
from datetime import datetime, timezone
from app.services import firebase_service
from app.services.maps_service import generate_route_polyline

ROUTE_ID = "R01"

NEW_STOPS = [
    {"id": "R01_Lumban",             "stop": "Lumban",                      "lat": 14.2989101, "lng": 121.4637842, "order": 0},
    {"id": "R01_7Eleven",            "stop": "7-Eleven Lumban",             "lat": 14.2922896, "lng": 121.4608792, "order": 1},
    {"id": "R01_BDO_Pagsanjan",      "stop": "BDO Pagsanjan",               "lat": 14.2729798, "lng": 121.4548759, "order": 2},
    {"id": "R01_Pagsanjan_Terminal", "stop": "Pagsanjan Terminal",           "lat": 14.2649319, "lng": 121.4354092, "order": 3},
    {"id": "R01_DLTB_Pagsawitan",    "stop": "DLTB Pagsawitan",             "lat": 14.2666797, "lng": 121.4254287, "order": 4},
    {"id": "R01_RedCross",           "stop": "Philippine Red Cross",         "lat": 14.2746565, "lng": 121.4178734, "order": 5},
    {"id": "R01_PWU",                "stop": "Philippine Women's University","lat": 14.2814155, "lng": 121.4158682, "order": 6},
    {"id": "R01_Jollibee",           "stop": "Jollibee Sta. Cruz",           "lat": 14.2830272, "lng": 121.4150841, "order": 7},
    {"id": "R01_FcHome",             "stop": "FC Home Center",               "lat": 14.2849718, "lng": 121.4129111, "order": 8},
    {"id": "R01_StaCruzPlaza",       "stop": "Sta. Cruz Plaza",              "lat": 14.2816764, "lng": 121.4149922, "order": 9},
]

def main():
    # Delete old stops
    old = firebase_service.query_collection("stops", [("route", "==", ROUTE_ID)])
    for s in old:
        firebase_service.delete_doc("stops", s["id"])
        print(f"  Deleted old stop: {s['id']}")

    # Write new stops
    for s in NEW_STOPS:
        firebase_service.set_doc("stops", s["id"], {**s, "route": ROUTE_ID, "count": 0}, merge=False)
        print(f"  Added stop {s['order']}: {s['stop']}")

    # Regenerate polyline
    print("\nGenerating ORS polyline...")
    result = asyncio.run(generate_route_polyline(ROUTE_ID))
    firebase_service.set_doc("routes", ROUTE_ID, {
        "route_id": ROUTE_ID,
        "polyline": result["polyline"],
        "travel_time_min": result["travel_time_min"],
        "last_generated": datetime.now(timezone.utc).isoformat(),
    })
    print(f"Saved: {len(result['polyline'])} points, {result['travel_time_min']:.1f} min, {result['stop_count']} stops")
    print("\nDone. Now run: python seed_demo.py && python start_demo.py")

main()
