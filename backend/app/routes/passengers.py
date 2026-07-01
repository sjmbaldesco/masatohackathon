from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query

from app.middleware.auth_middleware import get_current_user
from app.models.passenger import PassengerWaitingRequest, PassengerWaitingResponse
from app.services import firebase_service

router = APIRouter()

VALID_EXIT_REASONS = {"cancelled", "boarded"}


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
def cancel_waiting(
    passenger_id: str,
    reason: str = Query("cancelled", description="cancelled | boarded"),
    user: dict = Depends(get_current_user),
):
    """Passenger stops waiting — either backed out (cancelled) or already
    boarded a jeepney, this one or another (boarded). Either way they drop
    out of the live demand count; the reason is kept only for analytics."""
    if passenger_id != user["uid"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    status = reason if reason in VALID_EXIT_REASONS else "cancelled"
    firebase_service.set_doc("passengers", passenger_id, {"status": status})
    # TODO: decrement stop demand counter atomically
    # Note: this counter is no longer read by the frontend for anything shown
    # to a user — Driver/Passenger/Admin all compute live waiting-passenger
    # counts directly from the passengers collection (status == "waiting")
    # instead, specifically because this counter only ever increments and
    # drifts stale. Left in place in case something else still depends on it;
    # not removed as part of that frontend change.
    return {"message": f"Waiting status set to '{status}'."}
