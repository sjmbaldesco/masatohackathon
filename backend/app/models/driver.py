from pydantic import BaseModel
from typing import Literal


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
    recommendation: Literal["Depart Now", "Wait", "Uncertain"]
