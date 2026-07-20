"use client";

import { useCallback, useSyncExternalStore } from "react";

interface Fullscreen {
  /** Whether the document is currently presented fullscreen. */
  active: boolean;
  /** False where the API is missing or blocked by permissions policy — the
   *  caller should not offer a control it cannot honour. */
  supported: boolean;
  toggle: () => void;
}

/**
 * Document fullscreen, read from the browser rather than mirrored in state.
 *
 * The user can leave fullscreen with Escape or F11, which fires no click of
 * ours — so this subscribes to `fullscreenchange` and never infers the state
 * from whichever action we last took. Anything else drifts out of sync the
 * first time someone presses Escape.
 *
 * `useSyncExternalStore` rather than useState + useEffect for the same reason
 * `useBreakpoint` uses it: this is external state, the server snapshot is a
 * definite `false`, and the effect form trips react-hooks/set-state-in-effect
 * for exactly the reason the rule exists.
 */
function subscribe(onChange: () => void): () => void {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

/** Support never changes for the life of the document, so it has nothing to
 *  subscribe to — but it still must not be read during a server render. */
function subscribeNever(): () => void {
  return () => {};
}

export function useFullscreen(): Fullscreen {
  const active = useSyncExternalStore(
    subscribe,
    () => document.fullscreenElement !== null,
    () => false
  );

  const supported = useSyncExternalStore(
    subscribeNever,
    // jsdom implements neither; a permissions policy can disable it in a real
    // browser, typically inside an embedded frame.
    () =>
      typeof document.documentElement.requestFullscreen === "function" &&
      document.fullscreenEnabled === true,
    () => false
  );

  const toggle = useCallback(() => {
    // Both reject rather than throw — on a user gesture they normally
    // succeed, but a rejection must not surface as an unhandled rejection.
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  return { active, supported, toggle };
}
