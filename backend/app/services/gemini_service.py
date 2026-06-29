import google.generativeai as genai
from app.config import settings

genai.configure(api_key=settings.gemini_api_key)
_model = genai.GenerativeModel("gemini-1.5-flash")


def ask_gemini(prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    response = _model.generate_content(prompt)
    return response.text.strip()


def build_dispatch_prompt(route_name: str, queue: int, active_jeeps: int,
                           avg_wait_min: float, peak_hour: bool) -> str:
    return f"""
You are an AI dispatch assistant for a jeepney cooperative in Metro Manila.

Route: {route_name}
Passengers waiting: {queue}
Active jeeps on route: {active_jeeps}
Average wait time: {avg_wait_min:.1f} minutes
Peak hour: {"Yes" if peak_hour else "No"}

Based on this data, provide:
1. A brief insight (1–2 sentences) explaining what is happening on this route.
2. A specific recommended action for the dispatcher.

Format your response as:
INSIGHT: <insight text>
ACTION: <recommended action>
""".strip()


def build_confidence_prompt(waiting_count: int, historical_avg: float,
                             travel_time_min: int, fare_php: float) -> str:
    return f"""
You are computing a Departure Confidence Score for a jeepney driver in Metro Manila.

Passengers currently waiting along the route: {waiting_count}
Historical average passengers for this time slot: {historical_avg}
Estimated travel time: {travel_time_min} minutes
Fare per passenger: ₱{fare_php}

On a scale of 0–100, how confident should the driver be that departing now is the optimal decision?
Consider passenger load, revenue potential, and wait time impact.

Respond with:
SCORE: <integer 0-100>
EXPECTED_PAX: <range like "15-17">
EXPECTED_REVENUE: <number in PHP>
RECOMMENDATION: <"Depart Now" or "Wait">
REASONING: <one sentence>
""".strip()
