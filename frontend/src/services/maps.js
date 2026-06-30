export const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
export const LIBRARIES = ["visualization"];

// Shared gray map style matching the 2B2D42/8D99AE/EDF2F4 palette
export const GRAY_MAP_STYLE = [
  { elementType: "geometry",           stylers: [{ color: "#edf2f4" }] },
  { elementType: "labels.text.fill",   stylers: [{ color: "#2b2d42" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#edf2f4" }] },
  { featureType: "road", elementType: "geometry",          stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#f0f4f8" }] },
  { featureType: "water", elementType: "geometry",         stylers: [{ color: "#adb8c7" }] },
  { featureType: "poi",     stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

// Route center: midpoint of Lumban → Sta. Cruz via Pagsanjan
export const DEFAULT_CENTER = { lat: 14.2780, lng: 121.4390 };

// Real Lumban → Sta. Cruz stops (mirrors Firestore — keep in sync with seed_route.py)
export const ROUTE_STOPS = [
  { id: "R01_Lumban",             name: "Lumban",                       lat: 14.2989101, lng: 121.4637842 },
  { id: "R01_7Eleven",            name: "7-Eleven Lumban",              lat: 14.2922896, lng: 121.4608792 },
  { id: "R01_BDO_Pagsanjan",      name: "BDO Pagsanjan",                lat: 14.2729798, lng: 121.4548759 },
  { id: "R01_Pagsanjan_Terminal", name: "Pagsanjan Terminal",            lat: 14.2649319, lng: 121.4354092 },
  { id: "R01_DLTB_Pagsawitan",    name: "DLTB Pagsawitan",              lat: 14.2666797, lng: 121.4254287 },
  { id: "R01_RedCross",           name: "Philippine Red Cross",          lat: 14.2746565, lng: 121.4178734 },
  { id: "R01_PWU",                name: "Philippine Women's University", lat: 14.2814155, lng: 121.4158682 },
  { id: "R01_Jollibee",           name: "Jollibee Sta. Cruz",            lat: 14.2830272, lng: 121.4150841 },
  { id: "R01_FcHome",             name: "FC Home Center",                lat: 14.2849718, lng: 121.4129111 },
  { id: "R01_StaCruzPlaza",       name: "Sta. Cruz Plaza",               lat: 14.2816764, lng: 121.4149922 },
];

// Fallback polyline tracing the actual road (used when Directions API unavailable)
// Route: Lumban → south through Pagsanjan → west to Pagsawitan → north to Sta. Cruz
export const DEMO_POLYLINE = [
  [14.2989, 121.4638],  // Lumban Market
  [14.2960, 121.4625],
  [14.2923, 121.4609],  // 7-Eleven Lumban
  [14.2870, 121.4590],
  [14.2800, 121.4570],
  [14.2730, 121.4549],  // Pagsanjan town proper
  [14.2690, 121.4470],
  [14.2649, 121.4354],  // Pagsanjan Terminal
  [14.2655, 121.4300],
  [14.2667, 121.4254],  // Pagsawitan / DLTB
  [14.2700, 121.4215],
  [14.2747, 121.4179],  // Pedro Guevara Ave
  [14.2780, 121.4162],
  [14.2814, 121.4158],
  [14.2817, 121.4150],  // Sta. Cruz Plaza
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
