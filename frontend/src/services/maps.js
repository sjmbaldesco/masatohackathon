export const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
export const LIBRARIES = [];

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

// Demand heatmap tiers — discrete, brand-aligned colors so it reads at a
// glance. Shared by every page that renders a demand heatmap (Driver, Admin)
// so they can never visually disagree about what "high demand" looks like.
// Radius/opacity are fixed per tier on purpose: color alone should carry the
// signal, not a second (size/opacity) variable.
export const DEMAND_TIERS = [
  { max: 3,        color: "#388E3C", label: "Low (1–3)"    },
  { max: 7,        color: "#F57C00", label: "Medium (4–7)" },
  { max: Infinity, color: "#D32F2F", label: "High (8+)"    },
];
export const DEMAND_CIRCLE_RADIUS_M = 120;
export const DEMAND_CIRCLE_OPACITY  = 0.32;

export function demandTier(cnt) {
  return DEMAND_TIERS.find((t) => cnt <= t.max) ?? DEMAND_TIERS[DEMAND_TIERS.length - 1];
}

// Compass heading (0=N, 90=E, ...) from point p1 to p2. Shared by any page
// that needs to orient a marker or the map camera along the route.
export function bearing(p1, p2) {
  const toR = (d) => (d * Math.PI) / 180;
  const [lat1, lng1] = Array.isArray(p1) ? p1 : [p1.lat, p1.lng];
  const [lat2, lng2] = Array.isArray(p2) ? p2 : [p2.lat, p2.lng];
  const dLng = toR(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toR(lat2));
  const x = Math.cos(toR(lat1)) * Math.sin(toR(lat2)) - Math.sin(toR(lat1)) * Math.cos(toR(lat2)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Normalizes a raw Firestore polyline (array of [lat,lng] tuples or
// {lat,lng} objects) into a consistent {lat,lng}[] shape.
export function normalizePolyline(polyline) {
  return polyline.map((p) => (Array.isArray(p) ? { lat: p[0], lng: p[1] } : { lat: p.lat, lng: p.lng }));
}

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

// Projects p onto the closest point on segment a→b (planar approximation —
// fine at the scale of a single jeepney route, not for cross-country spans).
// Returns the projected point plus t (0-1 fraction along the segment), so
// callers can track exactly how far along the polyline that point falls.
function projectPointOntoSegment(p, a, b) {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { point: { lat: a.lat, lng: a.lng }, t: 0 };
  let t = ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { point: { lat: a.lat + t * dy, lng: a.lng + t * dx }, t };
}

/**
 * Snaps a raw GPS/sim point onto the nearest point on the route polyline,
 * and also reports WHERE along the polyline that point falls: `index` is the
 * segment (path[index] -> path[index+1]) and `t` is the 0-1 fraction within
 * it. `index + t` is a single monotonic-along-the-route progress scalar —
 * callers can compare it across ticks to detect real forward progress vs.
 * GPS/sim jitter, and to trim the polyline to only what's still ahead.
 */
export function projectPointOntoPolylineWithProgress(point, path) {
  if (!path || path.length < 2) return { point, index: 0, t: 0 };
  let best = point;
  let bestDist = Infinity;
  let bestIndex = 0;
  let bestT = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const { point: proj, t } = projectPointOntoSegment(point, path[i], path[i + 1]);
    const d = Math.hypot(proj.lat - point.lat, proj.lng - point.lng);
    if (d < bestDist) { bestDist = d; best = proj; bestIndex = i; bestT = t; }
  }
  return { point: best, index: bestIndex, t: bestT };
}
