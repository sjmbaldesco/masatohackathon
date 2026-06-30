import httpx
from fastapi import HTTPException

from app.config import settings
from app.services import firebase_service


async def generate_route_polyline(route_id: str) -> dict:
    """
    Dynamically generate a road-following polyline for any route.

    Reads stops from Firestore (sorted by `order`), calls ORS, and returns
    { polyline, travel_time_min, stop_count }.  No coordinates are hardcoded here.

    Raises:
        HTTPException(400) – fewer than 2 stops found for route_id
        HTTPException(502) – ORS call failed
    """
    stops = firebase_service.query_collection(
        "stops", [("route", "==", route_id)]
    )

    ordered = sorted(stops, key=lambda s: s.get("order", 0))

    if len(ordered) < 2:
        raise HTTPException(
            status_code=400,
            detail=f"Route {route_id} has {len(ordered)} stop(s) — need at least 2 to generate a polyline.",
        )

    # ORS expects [lng, lat]
    waypoints = [[s["lng"], s["lat"]] for s in ordered]

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
                headers={"Authorization": settings.ors_api_key},
                json={
                "coordinates": waypoints,
                "instructions": False,
                "radiuses": [-1] * len(waypoints),  # -1 = unlimited snap radius
            },
            )
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"ORS error {exc.response.status_code}: {exc.response.text[:300]}",
        )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"ORS request failed: {exc}")

    feature = data["features"][0]
    # ORS GeoJSON coordinates are [lng, lat] — swap and store as {lat, lng} dicts
    # (Firestore rejects nested arrays; list-of-maps works fine)
    polyline = [{"lat": c[1], "lng": c[0]} for c in feature["geometry"]["coordinates"]]
    travel_time_min = feature["properties"]["summary"]["duration"] / 60

    return {
        "polyline": polyline,
        "travel_time_min": travel_time_min,
        "stop_count": len(ordered),
    }


async def get_travel_time_minutes(origin: tuple, destination: tuple) -> int:
    """
    Returns estimated travel time in minutes between two (lat, lng) tuples.
    ORS expects coordinates as [lng, lat].
    """
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.openrouteservice.org/v2/directions/driving-car/json",
            headers={"Authorization": settings.ors_api_key},
            json={
                "coordinates": [
                    [origin[1], origin[0]],
                    [destination[1], destination[0]],
                ]
            },
        )
        response.raise_for_status()
        data = response.json()
        return int(data["routes"][0]["summary"]["duration"] / 60)


def get_distance_matrix(origins: list[tuple], destinations: list[tuple]) -> list[dict]:
    # TODO: ORS Matrix API — implement when needed
    return []
