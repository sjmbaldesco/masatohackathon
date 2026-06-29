"""
Departure Confidence Score computation.

Strategy:
  1. Gather live inputs: passengers waiting along route, driver's current occupancy.
  2. Get travel time via ORS Directions API (TODO: wire up once terminal coords are resolved).
  3. Build Gemini prompt with live + historical data.
  4. Parse Gemini response and return structured score.

Fallback: if Gemini fails, compute a simple heuristic score.
"""
import re
from app.services import firebase_service, gemini_service

FARE_PER_PASSENGER_PHP = 15.0
JEEP_CAPACITY = 18


def compute(driver_id: str, driver_doc: dict) -> dict:
    route = driver_doc.get("route", "")
    lat = driver_doc.get("lat", 14.5995)
    lng = driver_doc.get("lng", 120.9842)
    on_board = driver_doc.get("occupancy", 0)

    # 1. Count waiting passengers along route
    waiting = firebase_service.query_collection(
        "passengers", [("route", "==", route), ("status", "==", "waiting")]
    )
    waiting_count = len(waiting)
    total_potential = on_board + waiting_count

    # 2. Get travel time to terminal (stub: use last stop of route)
    # TODO: resolve terminal coordinates from routes collection
    travel_time_min = 35  # fallback

    # 3. Gemini scoring
    try:
        prompt = gemini_service.build_confidence_prompt(
            waiting_count=waiting_count,
            historical_avg=12.0,   # TODO: pull from historical analytics
            travel_time_min=travel_time_min,
            fare_php=FARE_PER_PASSENGER_PHP,
        )
        raw = gemini_service.ask_gemini(prompt)
        score, expected_pax, expected_revenue, recommendation = _parse_confidence_response(raw)
    except Exception:
        # Heuristic fallback
        fill_ratio = total_potential / JEEP_CAPACITY
        score = min(int(fill_ratio * 100), 100)
        expected_pax = f"{total_potential}"
        expected_revenue = total_potential * FARE_PER_PASSENGER_PHP
        recommendation = "Depart Now" if score >= 70 else "Wait"

    return {
        "driver_id": driver_id,
        "score": score,
        "expected_passengers": expected_pax,
        "travel_time_min": travel_time_min,
        "expected_revenue": expected_revenue,
        "recommendation": recommendation,
    }


def _parse_confidence_response(raw: str) -> tuple:
    """Parse structured Gemini output into (score, pax_range, revenue, recommendation)."""
    score = int(re.search(r"SCORE:\s*(\d+)", raw).group(1))
    expected_pax = re.search(r"EXPECTED_PAX:\s*(.+)", raw).group(1).strip()
    expected_revenue = float(re.search(r"EXPECTED_REVENUE:\s*([\d.]+)", raw).group(1))
    recommendation = re.search(r"RECOMMENDATION:\s*(.+)", raw).group(1).strip()
    return score, expected_pax, expected_revenue, recommendation
