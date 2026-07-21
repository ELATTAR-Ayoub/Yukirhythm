/** Route helpers for the studio shell. Pure — no React, no navigation. */

/** The app lives at the root; screens were promoted out of /design-system. */
export const SCREENS = "";

export const HOME = `${SCREENS}/home`;
export const SEARCH = `${SCREENS}/search`;
export const LIBRARY = `${SCREENS}/library`;
export const AUTH = `${SCREENS}/auth`;
export const PROFILE = `${SCREENS}/profile`;
export const CREDITS = `${SCREENS}/credits`;
export const TERMS = `${SCREENS}/terms`;
/** Routed form of the create-playlist flow, reachable at every width (see
 *  LibraryRail and the mobile library page). */
export const CREATE = `${SCREENS}/create`;
/** Routed form of the queue, reachable at every width (see NowPlayingRail,
 *  Transport/DevicePlayer/PlaybackBar). */
export const QUEUE = `${SCREENS}/queue`;
/** Add-to-queue. Deliberately NOT `/playlist/queue/add`: the queue is not a
 *  collection, has no id to look up, and adding to it must write to no
 *  playlist. Routing it through the playlist add screen is what produced the
 *  "Collection not found" error. */
export const QUEUE_ADD = `${QUEUE}/add`;

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

/** Routed form of the add-music flow for a given playlist, reachable at
 *  every width (see CollectionDetail's "Add music" control). */
export function addMusicHref(id: string): string {
  return `${playlistHref(id)}/add`;
}
