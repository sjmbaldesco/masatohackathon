import { useEffect, useState } from "react";

/**
 * Tracks whether the viewport is at or below a breakpoint, via matchMedia.
 * Used to switch between a desktop and a dedicated mobile layout in JS
 * (rather than hiding one with CSS), so components that mount heavy
 * resources — e.g. GoogleMap — only ever render once at a time.
 *
 * @param {number} breakpoint - px width; viewports narrower than this count as mobile (default 1024, matches Tailwind's `lg`)
 */
export function useIsMobile(breakpoint = 1024) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}
