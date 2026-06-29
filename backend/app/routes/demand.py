from fastapi import APIRouter, Depends
from app.middleware.auth_middleware import get_current_user
from app.models.demand import DemandPoint
from app.services import firebase_service

router = APIRouter()


@router.get("/{route_id}", response_model=list[DemandPoint])
def get_demand(route_id: str, user: dict = Depends(get_current_user)):
    """
    Returns aggregated demand points (stop-level) for a given route.
    Used by the driver heatmap and cooperative dashboard.
    """
    stops = firebase_service.query_collection(
        "stops", [("route", "==", route_id)]
    )
    return [
        DemandPoint(
            stop=s["stop"],
            lat=s.get("lat", 0.0),
            lng=s.get("lng", 0.0),
            count=s.get("count", 0),
        )
        for s in stops
    ]
