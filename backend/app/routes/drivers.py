from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth_middleware import get_current_user
from app.models.driver import GPSUpdateRequest, GPSUpdateResponse, DepartureScoreResponse
from app.services import firebase_service
from app.services.confidence_score import compute as compute_score

router = APIRouter()


@router.post("/gps", response_model=GPSUpdateResponse)
def update_gps(
    body: GPSUpdateRequest,
    user: dict = Depends(get_current_user),
):
    """Driver pushes GPS position every 5–10 seconds."""
    uid = user["uid"]
    firebase_service.set_doc("drivers", uid, {
        "uid": uid,
        "lat": body.lat,
        "lng": body.lng,
        "occupancy": body.occupancy,
        "route": body.route,
        "status": "active",
        "last_updated": datetime.now(timezone.utc).isoformat(),
    })
    return GPSUpdateResponse(
        driver_id=uid,
        lat=body.lat,
        lng=body.lng,
        status="active",
        message="GPS updated.",
    )


@router.get("/{driver_id}/confidence", response_model=DepartureScoreResponse)
def get_confidence(driver_id: str, user: dict = Depends(get_current_user)):
    """Returns the Departure Confidence Score for a driver."""
    if driver_id != user["uid"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    driver_doc = firebase_service.get_doc("drivers", driver_id)
    if not driver_doc:
        raise HTTPException(status_code=404, detail="Driver not found")

    result = compute_score(driver_id, driver_doc)
    return DepartureScoreResponse(**result)
