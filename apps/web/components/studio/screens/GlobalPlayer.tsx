"use client";

import { useEffect, useRef } from "react";

import { useMockStudio } from "./MockStudioProvider";
import { useIsDesktop } from "../shell/useBreakpoint";
import PlaybackBar from "../shell/PlaybackBar";
import DevicePlayer from "./DevicePlayer";
import MiniPlayerBar from "./MiniPlayerBar";
import { PlaybackBarSkeleton } from "./RouteSkeletons";

/**
 * The one player surface for the whole app shell.
 * Compressed: MiniPlayerBar below md, PlaybackBar at md (768px) and up.
 * Expanded: DevicePlayer centered over the page.
 *
 * The queue is a routed page (`/screens/queue`) at every width now, so this
 * no longer mounts QueueDrawer — every surface that used to open it
 * (DevicePlayer's transport, NowPlayingRail's "Open queue") navigates there
 * directly instead.
 */
export default function GlobalPlayer() {
  const { nowPlaying, playerExpanded, setPlayerExpanded, playbackLoading } =
    useMockStudio();
  const isDesktop = useIsDesktop();
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Keyboard support for the expanded overlay: Escape dismisses, focus moves
  // to the collapse control on open and returns to the expand trigger on close.
  useEffect(() => {
    // Mirrors the render guard below — with no track there is no dialog to
    // move focus into, so this must not run just because the flag is set.
    if (!playerExpanded || !nowPlaying) return;

    // By the time this effect runs the expand trigger has already unmounted,
    // so activeElement is usually <body> — only remember a real element.
    const prevActive = document.activeElement;
    restoreRef.current =
      prevActive instanceof HTMLElement && prevActive !== document.body
        ? prevActive
        : null;
    dialogRef.current
      ?.querySelector<HTMLElement>('[aria-label="Collapse player"]')
      ?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlayerExpanded(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const prev = restoreRef.current;
      restoreRef.current = null;
      if (prev?.isConnected) {
        prev.focus();
      } else {
        // The mini bar remounts on collapse, so the original trigger node is
        // gone — focus its replacement instead.
        document
          .querySelector<HTMLElement>('[aria-label="Expand player"]')
          ?.focus();
      }
    };
  }, [playerExpanded, nowPlaying, setPlayerExpanded]);

  if (playbackLoading) {
    return isDesktop ? <PlaybackBarSkeleton /> : <PlaybackBarSkeleton mobile />;
  }

  // No early return on `!nowPlaying`: the compressed bar is permanent
  // chrome, the way Spotify's is, and both bars render an idle presentation
  // of their own. The EXPANDED overlay is still gated — a fullscreen player
  // for no track has nothing to show and no way to be dismissed by its own
  // transport.
  return (
    <>
      {playerExpanded && nowPlaying ? (
        <div
          ref={dialogRef}
          className="fixed inset-0 z-50"
          role="dialog"
          aria-label="Now playing"
        >
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm anim-fade-in"
            onClick={() => setPlayerExpanded(false)}
            aria-hidden
          />
          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto anim-jelly-in w-full flex justify-center">
              <DevicePlayer onCollapse={() => setPlayerExpanded(false)} />
            </div>
          </div>
        </div>
      ) : isDesktop ? (
        <PlaybackBar onExpand={() => setPlayerExpanded(true)} />
      ) : (
        <MiniPlayerBar onExpand={() => setPlayerExpanded(true)} />
      )}
    </>
  );
}
