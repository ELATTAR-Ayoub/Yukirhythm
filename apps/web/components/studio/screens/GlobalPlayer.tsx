"use client";

import { useEffect, useRef } from "react";

import { useMockStudio } from "./MockStudioProvider";
import DevicePlayer from "./DevicePlayer";
import MiniPlayerBar from "./MiniPlayerBar";

/**
 * The one player surface for the whole app shell.
 * Compressed: MiniPlayerBar. Expanded: DevicePlayer centered over the page.
 */
export default function GlobalPlayer() {
  const { nowPlaying, playerExpanded, setPlayerExpanded } = useMockStudio();
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Keyboard support for the expanded overlay: Escape dismisses, focus moves
  // to the collapse control on open and returns to the expand trigger on close.
  useEffect(() => {
    if (!playerExpanded) return;

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
  }, [playerExpanded, setPlayerExpanded]);

  if (!nowPlaying) return null;

  if (playerExpanded) {
    return (
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
    );
  }

  return <MiniPlayerBar onExpand={() => setPlayerExpanded(true)} />;
}
