export const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY;

export const DEFAULT_CENTER = { lat: 14.5995, lng: 120.9842 };

export function toHeatmapData(demandPoints) {
  return demandPoints.map((p) => [p.lat, p.lng, p.count]);
}

export async function getETAMinutes(originLatLng, destLatLng) {
  const response = await fetch(
    "https://api.openrouteservice.org/v2/directions/driving-car/json",
    {
      method: "POST",
      headers: {
        Authorization: ORS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates: [
          [originLatLng.lng, originLatLng.lat],
          [destLatLng.lng, destLatLng.lat],
        ],
      }),
    }
  );
  const data = await response.json();
  return data.routes[0].summary.duration / 60;
}
