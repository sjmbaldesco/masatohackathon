from pydantic import BaseModel
from typing import Literal


class PassengerWaitingRequest(BaseModel):
    stop: str
    route: str
    lat: float | None = None
    lng: float | None = None


class PassengerWaitingResponse(BaseModel):
    passenger_id: str
    stop: str
    route: str
    status: Literal["waiting"] = "waiting"
    message: str
