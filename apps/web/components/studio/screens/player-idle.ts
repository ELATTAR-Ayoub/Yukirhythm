/**
 * Shared vocabulary for a player surface with nothing loaded.
 *
 * Two surfaces render an idle presentation — the desktop `PlaybackBar` and
 * the docked `DevicePlayer` in the now-playing rail. They must say the same
 * thing in the same words: an idle player is a recognisable state, not a
 * per-component improvisation. (`MiniPlayerBar` deliberately renders nothing
 * when idle instead — on a phone a dead 70px band competes with the tab bar
 * for the scarcest space on screen.)
 */

/** Elapsed/total with nothing loaded. Not "0:00" — that is a real position
 *  in a real track, and an idle surface has neither. */
export const NO_TIME = "--:--";

/** What an idle surface calls itself. Deliberately not a greeting or a
 *  call to action: it states the player's actual state and nothing more. */
export const IDLE_LABEL = "Nothing playing";
