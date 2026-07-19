"use client";

import { useEffect, useState } from "react";

/** Two columns from here up (Tailwind `md`). */
export const DESKTOP_MIN = 768;
/** Three columns from here up (our `3xl` token). */
export const WIDE_MIN = 1440;

/**
 * True once the viewport is at least `minWidth` px wide.
 *
 * Returns false on the server and on the first client render, then corrects
 * itself in an effect — reading matchMedia during render would desync
 * hydration. Callers must therefore tolerate one mobile-default frame, which
 * is why this drives render-shape swaps only; the grid itself uses Tailwind
 * breakpoint classes so it never flashes.
 */
export function useBreakpointUp(minWidth: number): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // jsdom and older Safari lack matchMedia — stay on the mobile default.
    if (typeof window.matchMedia !== "function") return;

    const mql = window.matchMedia(`(min-width: ${minWidth}px)`);
    setMatches(mql.matches);

    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [minWidth]);

  return matches;
}

/** Library rail visible — two columns or more. */
export function useIsDesktop(): boolean {
  return useBreakpointUp(DESKTOP_MIN);
}

/** Now-playing rail visible — the full three-column grid. */
export function useIsWide(): boolean {
  return useBreakpointUp(WIDE_MIN);
}
