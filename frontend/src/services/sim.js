import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { ROUTE_STOPS } from "./maps";

const activeTimers = {};

function closestStop(lat, lng, stops = ROUTE_STOPS) {
  let best = stops[0];
  let minDist = Infinity;
  for (const s of stops) {
    const d = Math.hypot(s.lat - lat, s.lng - lng);
    if (d < minDist) { minDist = d; best = s; }
  }
  return best.name;
}

function getLatLng(p) {
  if (Array.isArray(p)) return [p[0], p[1]];
  return [p.lat, p.lng];
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Animate a jeep along a polyline and write position to Firestore every 500 ms.
 * Uses proper haversine distance so speed in km/h is accurate regardless of route direction.
 * Cycles back to the start when it reaches the end of the route.
 */
export function startSim(driverId, polyline, speedKmh = 50) {
  stopSim(driverId);

  if (!polyline || polyline.length < 2) {
    console.warn("startSim: polyline too short, skipping");
    return;
  }

  // Pre-compute cumulative distances in metres along the polyline
  const pts = polyline.map(getLatLng);
  const cumDist = [0];
  for (let i = 1; i < pts.length; i++) {
    cumDist.push(
      cumDist[i - 1] + haversineMeters(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])
    );
  }
  const totalMeters = cumDist[cumDist.length - 1];
  if (totalMeters === 0) { console.warn("startSim: zero-length polyline"); return; }

  const TICK_MS = 500;
  const metersPerTick = (speedKmh * 1000 / 3600) * (TICK_MS / 1000);
  let distTravelled = 0;

  activeTimers[driverId] = setInterval(async () => {
    distTravelled = (distTravelled + metersPerTick) % totalMeters;

    // Binary search: find segment index where cumDist[lo] <= distTravelled < cumDist[lo+1]
    let lo = 0, hi = cumDist.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (cumDist[mid] <= distTravelled) lo = mid;
      else hi = mid - 1;
    }

    const segLen = cumDist[lo + 1] - cumDist[lo];
    const frac = segLen > 0 ? (distTravelled - cumDist[lo]) / segLen : 0;
    const lat = pts[lo][0] + (pts[lo + 1][0] - pts[lo][0]) * frac;
    const lng = pts[lo][1] + (pts[lo + 1][1] - pts[lo][1]) * frac;
    const currentStop = closestStop(lat, lng);

    try {
      await setDoc(
        doc(db, "drivers", driverId),
        { lat, lng, speed_kmh: speedKmh, current_stop: currentStop, last_updated: serverTimestamp() },
        { merge: true }
      );
    } catch (e) { console.error("sim write:", e); }
  }, TICK_MS);
}

export function stopSim(driverId) {
  if (activeTimers[driverId]) {
    clearInterval(activeTimers[driverId]);
    delete activeTimers[driverId];
  }
}

export function isSimRunning(driverId) {
  return !!activeTimers[driverId];
}
