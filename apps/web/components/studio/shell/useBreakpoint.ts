"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Two columns from here up (Tailwind `md`). */
export const DESKTOP_MIN = 768;
/**
 * Three columns from here up.
 *
 * MUST stay in sync with `--breakpoint-3xl` in `app/globals.css` (the `@theme`
 * block). Tailwind 4 is CSS-first and has no config file to import from, so
 * this value is duplicated by necessity — change one and you must change the
 * other.
 */
export const WIDE_MIN = 1440;

/**
 * True once the viewport is at least `minWidth` px wide.
 *
 * Backed by `useSyncExternalStore`, so the server snapshot is `false` and
 * React swaps in the real match after hydration — no set-state-in-effect round
 * trip, and no tear under concurrent rendering. Callers still see one
 * mobile-default frame during hydration, which is why this drives
 * render-shape swaps only; the grid itself uses Tailwind breakpoint classes so
 * it never flashes.
 */
export function useBreakpointUp(minWidth: number): boolean {
  const query = `(min-width: ${minWidth}px)`;

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      // jsdom lacks matchMedia entirely — stay on the mobile default.
      if (typeof window.matchMedia !== "function") return () => {};

      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    [query]
  );

  const getSnapshot = useCallback(() => {
    if (typeof window.matchMedia !== "function") return false;
    return window.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** Library rail visible — two columns or more. */
export function useIsDesktop(): boolean {
  return useBreakpointUp(DESKTOP_MIN);
}

/** Now-playing rail visible — the full three-column grid. */
export function useIsWide(): boolean {
  return useBreakpointUp(WIDE_MIN);
}
