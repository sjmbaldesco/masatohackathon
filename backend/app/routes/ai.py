import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.middleware.auth_middleware import get_current_user
from app.models.demand import (
    DispatchRequest, DispatchRecommendation,
    PassengerTipRequest, PassengerTipResponse,
)
from app.services import firebase_service, gemini_service

router = APIRouter()


# ── Analytics Insights ─────────────────────────────────────────────────────────

class AnalyticsInsightsRequest(BaseModel):
    active_drivers: int = 0
    total_waiting: int = 0
    avg_occupancy_pct: int = 0
    route: Optional[str] = "R01"


class AnalyticsInsightsResponse(BaseModel):
    insights: list[str]


@router.post("/analytics/insights", response_model=AnalyticsInsightsResponse)
def analytics_insights(
    body: AnalyticsInsightsRequest,
    user: dict = Depends(get_current_user),
):
    """Generate AI narrative insights for the Excel analytics export."""
    try:
        prompt = (
            f"You are an AI transport analyst for Pasada, a Philippine jeepney platform.\n\n"
            f"Route {body.route} snapshot:\n"
            f"- Active drivers: {body.active_drivers}\n"
            f"- Waiting passengers: {body.total_waiting}\n"
            f"- Average occupancy: {body.avg_occupancy_pct}%\n\n"
            f"Give exactly 3 concise insights (1-2 sentences each) about performance, demand trends, "
            f"and a recommendation. Number them 1., 2., 3."
        )
        raw = gemini_service.ask_gemini(prompt)
        lines = [l.strip() for l in raw.splitlines() if l.strip()]
        insights = [re.sub(r"^\d+\.\s*", "", l) for l in lines if re.match(r"^\d+\.", l)]
        if not insights:
            insights = [raw]
    except Exception:
        occ_word = "above" if body.avg_occupancy_pct > 70 else "below"
        insights = [
            f"Route {body.route}: {body.active_drivers} active driver(s), {body.total_waiting} passengers waiting.",
            f"Fleet avg occupancy {body.avg_occupancy_pct}% — {occ_word} the 70% optimal threshold.",
            "Review dispatch intervals against live demand to improve passenger wait times.",
        ]
    return AnalyticsInsightsResponse(insights=insights)


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
