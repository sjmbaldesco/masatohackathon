from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth_middleware import get_current_user
from app.models.stop import RouteGenerateResponse
from app.services import firebase_service
from app.services.maps_service import generate_route_polyline

router = APIRouter()


def _require_driver_or_admin(user: dict = Depends(get_current_user)) -> dict:
    """Allow only drivers and admins to trigger route generation."""
    user_doc = firebase_service.get_doc("users", user["uid"])
    role = (user_doc or {}).get("role", "")
    if role not in ("driver", "admin"):
        raise HTTPException(status_code=403, detail="Drivers and admins only.")
    return user


@router.post("/{route_id}/generate", response_model=RouteGenerateResponse)
async def generate_route(
    route_id: str,
    user: dict = Depends(_require_driver_or_admin),
):
    """
    Generate a road-following polyline for any route from its Firestore stops.
    Stops must have an `order` field set (use seed_stops.py to patch them).
    """
    result = await generate_route_polyline(route_id)

    last_generated = datetime.now(timezone.utc).isoformat()
    firebase_service.set_doc("routes", route_id, {
        "route_id": route_id,
        "polyline": result["polyline"],
        "travel_time_min": result["travel_time_min"],
        "last_generated": last_generated,
    })

    return RouteGenerateResponse(
        route_id=route_id,
        polyline_points=len(result["polyline"]),
        travel_time_min=result["travel_time_min"],
        stop_count=result["stop_count"],
        last_generated=last_generated,
    )
