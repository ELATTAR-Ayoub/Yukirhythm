/** Route helpers for the studio shell. Pure — no React, no navigation. */

export const SCREENS = "/design-system/screens";

export const HOME = `${SCREENS}/home`;
export const SEARCH = `${SCREENS}/search`;
export const LIBRARY = `${SCREENS}/library`;
export const AUTH = `${SCREENS}/auth`;
export const PROFILE = `${SCREENS}/profile`;
export const CREDITS = `${SCREENS}/credits`;
export const TERMS = `${SCREENS}/terms`;

/**
 * Pages that are not music surfaces. On these the shell hides both rails and
 * centres the page column, so a settings screen never reads as "somewhere in
 * the player".
 */
const SYSTEM_ROOTS = [PROFILE, CREDITS, TERMS];

export function isSystemRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  // Exact match or a real path segment below it — `/terminal` must not match
  // `/terms`.
  return SYSTEM_ROOTS.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`)
  );
}

export function playlistHref(id: string): string {
  return `${SCREENS}/playlist/${encodeURIComponent(id)}`;
}
