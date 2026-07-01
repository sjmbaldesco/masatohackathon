import { useEffect, useRef, useState } from "react";
import { bearing } from "../services/maps";

const TWEEN_DURATION_MS = 460; // slightly under the 500ms sim tick

/**
 * 60fps tween from the last rendered position to a new tick target, plus a
 * forward-facing heading. Deliberately a SEPARATE hook from
 * `useRouteProgress` (which only updates at tick rate): this one re-renders
 * its caller on every animation frame, so it must only ever be called inside
 * a small leaf component that renders just the marker — never inside a
 * page-level component that also owns unrelated UI (status cards, overlays,
 * etc.), or that whole tree ends up reconciling 60 times a second to move a
 * dot.
 *
 * @param {{lat:number,lng:number}|null} leadPoint - this tick's target position (from useRouteProgress)
 * @param {{lat:number,lng:number}|null} nextPoint - the next vertex ahead, for heading
 */
export function useSmoothedPosition(leadPoint, nextPoint) {
  const [pos, setPos]         = useState(leadPoint);
  const [heading, setHeading] = useState(0);
  const currentPosRef = useRef(leadPoint);
  const rafRef          = useRef(null);

  useEffect(() => {
    if (!leadPoint) return;
    const to   = leadPoint;
    const from = currentPosRef.current ?? to;

    if (nextPoint) setHeading(bearing(to, nextPoint));

    const t0 = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    function step(now) {
      const tt   = Math.min((now - t0) / TWEEN_DURATION_MS, 1);
      const ease = 1 - (1 - tt) * (1 - tt); // ease-out quad
      const next = {
        lat: from.lat + (to.lat - from.lat) * ease,
        lng: from.lng + (to.lng - from.lng) * ease,
      };
      currentPosRef.current = next;
      setPos(next);
      if (tt < 1) rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [leadPoint, nextPoint]);

  return { pos: pos ?? leadPoint, heading };
}
