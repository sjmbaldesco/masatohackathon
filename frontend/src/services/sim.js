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

/**
 * Animate a jeep along a polyline and write position to Firestore every second.
 * @param {string} driverId - Firestore document ID under drivers/
 * @param {Array<[number,number]>} polyline - [[lat, lng], ...]
 * @param {number} speedKmh
 */
export function startSim(driverId, polyline, speedKmh = 30) {
  stopSim(driverId);

  if (!polyline || polyline.length < 2) {
    console.warn("startSim: polyline too short, skipping");
    return;
  }

  const TICK_MS = 1000;
  // degrees per tick ≈ speedKmh / 3600 km/s / 111 km per degree
  const degPerTick = (speedKmh / 3600 / 111) * (TICK_MS / 1000);

  let segIdx = 0;
  let t = 0; // interpolation [0, 1] within current segment

  activeTimers[driverId] = setInterval(async () => {
    if (segIdx >= polyline.length - 1) {
      stopSim(driverId);
      try {
        await setDoc(
          doc(db, "drivers", driverId),
          { status: "idle", speed_kmh: 0, last_updated: serverTimestamp() },
          { merge: true }
        );
      } catch (e) { console.error("sim end write:", e); }
      return;
    }

    const [lat1, lng1] = polyline[segIdx];
    const [lat2, lng2] = polyline[segIdx + 1];
    const segLen = Math.hypot(lat2 - lat1, lng2 - lng1);

    if (segLen === 0) { segIdx++; return; }

    t += degPerTick / segLen;

    if (t >= 1) {
      segIdx++;
      t = 0;
      if (segIdx >= polyline.length - 1) return;
    }

    const [s1, s2] = [polyline[segIdx], polyline[segIdx + 1] ?? polyline[segIdx]];
    const lat = s1[0] + (s2[0] - s1[0]) * t;
    const lng = s1[1] + (s2[1] - s1[1]) * t;
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
