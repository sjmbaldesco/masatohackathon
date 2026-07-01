import { useEffect, useRef, useState } from "react";
import { projectPointOntoPolylineWithProgress } from "../services/maps";

// A backward jump this large (in "segment index units") can only be a real
// loop-back-to-start (sim.js/demo_service both cycle the jeep once it
// reaches the end of the route), never GPS/sim jitter — jitter never
// regresses by more than a fraction of one segment. Below this threshold,
// backward movement is treated as noise and ignored so the trimmed line
// never flickers/re-extends.
const LOOP_RESET_FRACTION = 0.5;

/**
 * Single shared source of truth for "where along the route is the jeep" —
 * used by Driver, Passenger, and Admin so all three trim/track the route
 * identically instead of three independent (and visibly different)
 * treatments of the same raw Firestore ticks.
 *
 * This updates at tick rate only (once per ~500ms Firestore write, whenever
 * lat/lng actually change) — it does NOT do frame-by-frame smoothing. That's
 * deliberate: calling this directly inside a page-level component (e.g. the
 * component that also renders the bottom overlay/status cards) keeps that
 * whole tree re-rendering at tick rate, not 60fps. For the smooth 60fps
 * visual glide, pair this with `useSmoothedPosition` — but call that pairing
 * only inside the small leaf component that actually renders the marker, so
 * the 60fps churn stays isolated to it.
 *
 * Given a raw position tick and the route polyline, this:
 *   1. Projects the raw point onto the polyline, so it's always on the road.
 *   2. Tracks progress as a monotonic scalar (segment index + fraction) so
 *      jitter that projects slightly backward between ticks never flickers
 *      a trimmed line — while still recognizing a genuine loop-back-to-start
 *      (a huge backward jump) as a real reset, not jitter.
 *   3. Derives remainingPath — the route trimmed to what's still ahead.
 *   4. Optionally finds the nearest stop in a given list (e.g. ROUTE_STOPS),
 *      for pages that show "jeep is near stop N" without depending on the
 *      driver doc's current_stop string — that field is written by three
 *      different code paths (sim.js, DriverPage.handleStartTrip,
 *      demo_service.py) and can go stale or mismatched.
 *
 * @param {number|null|undefined} lat - raw driver latitude
 * @param {number|null|undefined} lng - raw driver longitude
 * @param {{lat:number,lng:number}[]} polyline - normalized route polyline
 * @param {{lat:number,lng:number,name:string}[]|null} routeStops - optional, for nearestStopIndex
 * @param {*} resetKey - progress resets whenever this value changes (e.g. a trip-start marker)
 */
export function useRouteProgress({ lat, lng, polyline, routeStops = null, resetKey }) {
  const furthestRef = useRef({ progress: -1, index: 0, point: null });

  const [derived, setDerived] = useState(() => ({
    leadPoint: null,
    remainingPath: polyline,
    segmentIndex: 0,
  }));

  // Explicit reset (e.g. a new trip starting) — independent of the
  // loop-back auto-detection below, which only covers a single continuous
  // trip that happens to cycle past the end of the route.
  useEffect(() => {
    furthestRef.current = { progress: -1, index: 0, point: null };
  }, [resetKey]);

  useEffect(() => {
    if (lat == null || lng == null || !polyline || polyline.length < 2) return;

    const { point, index, t } = projectPointOntoPolylineWithProgress({ lat, lng }, polyline);
    const progress = index + t;
    const furthest = furthestRef.current;

    const isLoopReset = progress < furthest.progress - polyline.length * LOOP_RESET_FRACTION;
    if (progress >= furthest.progress || isLoopReset) {
      furthestRef.current = { progress, index, point };
    }

    const { index: idx, point: leadPoint } = furthestRef.current;
    setDerived({ leadPoint, remainingPath: [leadPoint, ...polyline.slice(idx + 1)], segmentIndex: idx });
  }, [lat, lng, polyline]);

  let nearestStopIndex = -1;
  if (routeStops && derived.leadPoint) {
    let bestDist = Infinity;
    routeStops.forEach((s, i) => {
      const d = Math.hypot(s.lat - derived.leadPoint.lat, s.lng - derived.leadPoint.lng);
      if (d < bestDist) { bestDist = d; nearestStopIndex = i; }
    });
  }

  return {
    leadPoint: derived.leadPoint,
    remainingPath: derived.remainingPath,
    segmentIndex: derived.segmentIndex,
    nearestStopIndex,
  };
}
