from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth_middleware import get_current_user
from app.models.passenger import PassengerWaitingRequest, PassengerWaitingResponse
from app.services import firebase_service

router = APIRouter()


@router.post("/waiting", response_model=PassengerWaitingResponse)
def broadcast_waiting(
    body: PassengerWaitingRequest,
    user: dict = Depends(get_current_user),
):
    """Passenger taps 'I'm waiting here'. Writes to Firestore and increments stop demand."""
    uid = user["uid"]

    passenger_data = {
        "passenger_id": uid,
        "uid": uid,
        "stop": body.stop,
        "route": body.route,
        "lat": body.lat,
        "lng": body.lng,
        "status": "waiting",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    firebase_service.set_doc("passengers", uid, passenger_data)

    # Increment stop demand counter
    # TODO: use Firestore FieldValue.increment for atomicity
    stop_ref = f"{body.route}_{body.stop}"
    stop_doc = firebase_service.get_doc("stops", stop_ref) or {}
    firebase_service.set_doc("stops", stop_ref, {
        **stop_doc,
        "count": stop_doc.get("count", 0) + 1,
        "route": body.route,
        "stop": body.stop,
        "lat": body.lat,
        "lng": body.lng,
    })

    return PassengerWaitingResponse(
        passenger_id=uid,
        stop=body.stop,
        route=body.route,
        status="waiting",
        message="You're now visible to drivers on this route.",
    )


@router.delete("/{passenger_id}/waiting")
def cancel_waiting(passenger_id: str, user: dict = Depends(get_current_user)):
    """Passenger cancels their waiting broadcast."""
    if passenger_id != user["uid"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    firebase_service.set_doc("passengers", passenger_id, {"status": "cancelled"})
    # TODO: decrement stop demand counter atomically
    return {"message": "Waiting status cancelled."}
