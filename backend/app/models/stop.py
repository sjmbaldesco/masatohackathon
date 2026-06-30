from pydantic import BaseModel


class Stop(BaseModel):
    id: str
    route: str
    name: str
    lat: float
    lng: float
    order: int        # sequence position along the route (0-indexed)
    count: int = 0


class RouteGenerateResponse(BaseModel):
    route_id: str
    polyline_points: int
    travel_time_min: float
    stop_count: int
    last_generated: str
