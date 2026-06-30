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

// Handles both [[lat, lng]] arrays and [{lat, lng}] objects from Firestore
function getLatLng(p) {
  if (Array.isArray(p)) return [p[0], p[1]];
  return [p.lat, p.lng];
}

/**
 * Animate a jeep along a polyline and write position to Firestore every second.
 * Cycles back to the start when it reaches the end of the route.
 * @param {string} driverId - Firestore document ID under drivers/
 * @param {Array} polyline - [[lat, lng], ...] or [{lat, lng}, ...] from Firestore
 * @param {number} speedKmh
 */
export function startSim(driverId, polyline, speedKmh = 30) {
  stopSim(driverId);

  if (!polyline || polyline.length < 2) {
    console.warn("startSim: polyline too short, skipping");
    return;
  }

  const TICK_MS = 500;
  const degPerTick = (speedKmh / 3600 / 111) * (TICK_MS / 1000);

  let segIdx = 0;
  let t = 0;

  activeTimers[driverId] = setInterval(async () => {
    // Loop back to start when reaching the end
    if (segIdx >= polyline.length - 1) {
      segIdx = 0;
      t = 0;
      return;
    }

    const [lat1, lng1] = getLatLng(polyline[segIdx]);
    const [lat2, lng2] = getLatLng(polyline[segIdx + 1]);
    const segLen = Math.hypot(lat2 - lat1, lng2 - lng1);

    if (segLen === 0) { segIdx++; return; }

    t += degPerTick / segLen;

    if (t >= 1) {
      segIdx++;
      t = 0;
      if (segIdx >= polyline.length - 1) return;
    }

    const p1 = getLatLng(polyline[segIdx]);
    const p2 = getLatLng(polyline[segIdx + 1] ?? polyline[segIdx]);
    const lat = p1[0] + (p2[0] - p1[0]) * t;
    const lng = p1[1] + (p2[1] - p1[1]) * t;
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
