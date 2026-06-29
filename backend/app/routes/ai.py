import re
from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth_middleware import get_current_user
from app.models.demand import (
    DispatchRequest, DispatchRecommendation,
    PassengerTipRequest, PassengerTipResponse,
)
from app.services import firebase_service, gemini_service

router = APIRouter()


@router.post("/dispatch", response_model=DispatchRecommendation)
def dispatch_recommendation(
    body: DispatchRequest,
    user: dict = Depends(get_current_user),
):
    """
    Cooperative dispatcher asks: 'What should I do for this route?'
    Gemini analyzes queue, active units, and time of day.
    """
    route_doc = firebase_service.get_doc("routes", body.route_id)
    if not route_doc:
        raise HTTPException(status_code=404, detail="Route not found")

    queue = route_doc.get("total_waiting", 0)
    active_jeeps = route_doc.get("active_drivers", 0)

    prompt = gemini_service.build_dispatch_prompt(
        route_name=route_doc.get("name", body.route_id),
        queue=queue,
        active_jeeps=active_jeeps,
        avg_wait_min=8.0,   # TODO: compute live
        peak_hour=False,    # TODO: check time of day
    )
    raw = gemini_service.ask_gemini(prompt)

    insight_match = re.search(r"INSIGHT:\s*(.+)", raw, re.IGNORECASE)
    action_match = re.search(r"ACTION:\s*(.+)", raw, re.IGNORECASE)

    return DispatchRecommendation(
        route_id=body.route_id,
        insight=insight_match.group(1).strip() if insight_match else raw,
        recommended_action=action_match.group(1).strip() if action_match else "Review manually",
    )


@router.post("/passenger-tip", response_model=PassengerTipResponse)
def passenger_tip(
    body: PassengerTipRequest,
    user: dict = Depends(get_current_user),
):
    """
    Passenger asks: 'Which jeep should I take?'
    Returns ETA + occupancy recommendation.
    """
    # TODO: query active drivers on route, compute ETA using Maps API, ask Gemini
    return PassengerTipResponse(
        recommendation="The next jeep on your route is 4 minutes away with 5 seats available. Board now."
    )
