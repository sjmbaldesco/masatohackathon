from pydantic import BaseModel


class GPSUpdateRequest(BaseModel):
    lat: float
    lng: float
    occupancy: int          # number of passengers currently on board
    route: str


class GPSUpdateResponse(BaseModel):
    driver_id: str
    lat: float
    lng: float
    status: str
    message: str


class DepartureScoreResponse(BaseModel):
    driver_id: str
    score: int              # 0–100
    expected_passengers: str   # e.g. "17–18"
    travel_time_min: int
    expected_revenue: float
    # Free text, not a fixed enum: this is populated either from Gemini's own
    # generated phrasing (no guarantee it matches a fixed set of strings) or
    # a hardcoded fallback ("Wait a bit longer") that never matched a strict
    # Literal — either source reliably 500'd response validation before.
    recommendation: str
