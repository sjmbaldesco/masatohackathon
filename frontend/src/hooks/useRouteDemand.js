import { useMemo } from "react";
import { useCollection } from "./useFirestore";

/**
 * Pure grouping helper, exported separately so a component that's already
 * fetched the passengers collection for its own reasons (e.g. AdminDashboard,
 * which needs it for top-level KPIs too) can reuse this instead of opening a
 * second, redundant Firestore listener for the identical query via
 * useRouteDemand below.
 */
export function groupWaitingByStop(waitingPassengers) {
  const counts = {};
  for (const p of waitingPassengers) {
    if (p.stop) counts[p.stop] = (counts[p.stop] ?? 0) + 1;
  }
  return counts;
}

/**
 * Single live source of truth for "how many passengers are waiting where" on
 * a route. Reads the `passengers` collection directly (status == "waiting")
 * rather than trusting the denormalized `stops.count` field — that field
 * only ever increments (passengers.py's cancel-waiting endpoint has a
 * standing TODO to decrement it that was never implemented), so it drifts
 * upward over time and can silently disagree with reality. Every page that
 * shows a waiting-passenger number to a human should read this instead.
 *
 * Only call this where the passengers-for-this-route data isn't already
 * available from a parent — each call opens its own Firestore listener.
 */
export function useRouteDemand(routeId) {
  const { data: waitingPassengers } = useCollection(
    "passengers", [["route", "==", routeId], ["status", "==", "waiting"]]
  );

  const countsByStop = useMemo(() => groupWaitingByStop(waitingPassengers), [waitingPassengers]);

  return { waitingPassengers, countsByStop, totalWaiting: waitingPassengers.length };
}
