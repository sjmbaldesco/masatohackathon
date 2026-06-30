export const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
export const LIBRARIES = [];

// Route center: midpoint of Lumban → Sta. Cruz route
export const DEFAULT_CENTER = { lat: 14.2780, lng: 121.4390 };

// Real Lumban → Sta. Cruz stops (mirrors Firestore — keep in sync with seed_route.py)
export const ROUTE_STOPS = [
  { id: "R01_Lumban",             name: "Lumban",                      lat: 14.2989101, lng: 121.4637842 },
  { id: "R01_7Eleven",            name: "7-Eleven Lumban",             lat: 14.2922896, lng: 121.4608792 },
  { id: "R01_BDO_Pagsanjan",      name: "BDO Pagsanjan",               lat: 14.2729798, lng: 121.4548759 },
  { id: "R01_Pagsanjan_Terminal", name: "Pagsanjan Terminal",           lat: 14.2649319, lng: 121.4354092 },
  { id: "R01_DLTB_Pagsawitan",    name: "DLTB Pagsawitan",             lat: 14.2666797, lng: 121.4254287 },
  { id: "R01_RedCross",           name: "Philippine Red Cross",         lat: 14.2746565, lng: 121.4178734 },
  { id: "R01_PWU",                name: "Philippine Women's University",lat: 14.2814155, lng: 121.4158682 },
  { id: "R01_Jollibee",           name: "Jollibee Sta. Cruz",           lat: 14.2830272, lng: 121.4150841 },
  { id: "R01_FcHome",             name: "FC Home Center",               lat: 14.2849718, lng: 121.4129111 },
  { id: "R01_StaCruzPlaza",       name: "Sta. Cruz Plaza",              lat: 14.2816764, lng: 121.4149922 },
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
