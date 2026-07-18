"use client";

import { useMockStudio } from "./MockStudioProvider";
import DevicePlayer from "./DevicePlayer";
import MiniPlayerBar from "./MiniPlayerBar";

/**
 * The one player surface for the whole app shell.
 * Compressed: MiniPlayerBar. Expanded: DevicePlayer centered over the page.
 */
export default function GlobalPlayer() {
  const { nowPlaying, playerExpanded, setPlayerExpanded } = useMockStudio();
  if (!nowPlaying) return null;

  if (playerExpanded) {
    return (
      <div className="fixed inset-0 z-40" role="dialog" aria-label="Now playing">
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
