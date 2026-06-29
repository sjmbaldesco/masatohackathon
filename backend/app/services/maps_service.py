import httpx
from app.config import settings


async def get_travel_time_minutes(origin: tuple, destination: tuple) -> int:
    """
    Returns estimated travel time in minutes between two (lat, lng) tuples.
    ORS expects coordinates as [lng, lat].
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.openrouteservice.org/v2/directions/driving-car/json",
            headers={"Authorization": settings.ors_api_key},
            json={
                "coordinates": [
                    [origin[1], origin[0]],
                    [destination[1], destination[0]],
                ]
            },
        )
        response.raise_for_status()
        data = response.json()
        return int(data["routes"][0]["summary"]["duration"] / 60)


def get_distance_matrix(origins: list[tuple], destinations: list[tuple]) -> list[dict]:
    # TODO: ORS Matrix API has a different structure — implement when needed
    return []
