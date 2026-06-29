export const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
export const LIBRARIES = [];

// Route center: Lumban, Laguna
export const DEFAULT_CENTER = { lat: 14.2976, lng: 121.475 };

// Lumban → Sta. Cruz demo route stops
export const ROUTE_STOPS = [
  { id: "lumban",     name: "Lumban",     lat: 14.2976, lng: 121.4750 },
  { id: "town-plaza", name: "Town Plaza", lat: 14.2965, lng: 121.4720 },
  { id: "pagsawitan", name: "Pagsawitan", lat: 14.2875, lng: 121.4445 },
  { id: "sta-cruz",   name: "Sta. Cruz",  lat: 14.2820, lng: 121.4183 },
];

// Simplified polyline for simulation (15 waypoints along the route)
export const DEMO_POLYLINE = [
  [14.2976, 121.4750],
  [14.2965, 121.4720],
  [14.2950, 121.4685],
  [14.2935, 121.4645],
  [14.2915, 121.4595],
  [14.2900, 121.4545],
  [14.2885, 121.4490],
  [14.2875, 121.4445],
  [14.2860, 121.4395],
  [14.2850, 121.4350],
  [14.2845, 121.4295],
  [14.2835, 121.4250],
  [14.2825, 121.4215],
  [14.2820, 121.4183],
];

export function occupancyColor(pct) {
  if (pct > 85) return "#D32F2F";
  if (pct > 50) return "#F57C00";
  return "#388E3C";
}

export function occupancyLabel(count, capacity) {
  if (count >= capacity) return "Full";
  return `${capacity - count} seats`;
}

export function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function etaMinutes(jeepPos, stopPos, speedKmh = 30) {
  const dist = haversineKm(jeepPos, stopPos);
  return Math.max(1, Math.round((dist / speedKmh) * 60));
}
