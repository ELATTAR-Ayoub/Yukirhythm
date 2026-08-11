"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { useMockStudio } from "./MockStudioProvider";
import { useIsDesktop } from "../shell/useBreakpoint";
import PlaybackBar from "../shell/PlaybackBar";
import ImmersivePlayer from "./ImmersivePlayer";
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
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const routeRef = useRef(pathname);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [closing, setClosing] = useState(false);

  const closePlayer = useCallback(() => {
    if (closing) return;
    setClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setPlayerExpanded(false);
      setImmersive(false);
      setClosing(false);
      closeTimerRef.current = null;
    }, 240);
  }, [closing, setPlayerExpanded]);

  const openPlayer = useCallback(
    (fullScreen: boolean) => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
      setClosing(false);
      setImmersive(fullScreen);
      setPlayerExpanded(true);
    },
    [setPlayerExpanded]
  );

  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    []
  );

  // Expanded surfaces are route-local UI. Navigation must never carry one
  // over the destination page.
  useEffect(() => {
    if (routeRef.current === pathname) return;
    routeRef.current = pathname;
    if (playerExpanded) closePlayer();
  }, [pathname, playerExpanded, closePlayer]);

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
      if (e.key === "Escape") closePlayer();
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
  }, [playerExpanded, nowPlaying, closePlayer]);

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
            className={
              closing
                ? "absolute inset-0 bg-ink/50 backdrop-blur-sm anim-player-backdrop-out"
                : "absolute inset-0 bg-ink/50 backdrop-blur-sm anim-fade-in"
            }
            onClick={closePlayer}
            aria-hidden
          />
          <div
            className={`absolute inset-0 pointer-events-auto ${
              closing ? "anim-player-compress" : "anim-player-expand"
            }`}
          >
            {immersive ? (
              <ImmersivePlayer onCollapse={closePlayer} />
            ) : (
              <div className="flex h-full items-center justify-center px-4 py-20">
                <DevicePlayer
                  onCollapse={closePlayer}
                  onExpand={() => setImmersive(true)}
                />
              </div>
            )}
          </div>
        </div>
      ) : isDesktop ? (
        <PlaybackBar onExpand={() => openPlayer(true)} />
      ) : (
        <MiniPlayerBar onExpand={() => openPlayer(false)} />
      )}
    </>
  );
}
