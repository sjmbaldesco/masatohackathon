from pydantic import BaseModel


class DemandPoint(BaseModel):
    stop: str
    lat: float
    lng: float
    count: int


class DispatchRequest(BaseModel):
    route_id: str


class DispatchRecommendation(BaseModel):
    route_id: str
    insight: str
    recommended_action: str


class PassengerTipRequest(BaseModel):
    stop: str
    route: str


class PassengerTipResponse(BaseModel):
    recommendation: str
