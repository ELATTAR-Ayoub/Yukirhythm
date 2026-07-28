"use client";

import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import BottomTabBar from "@/components/studio/screens/BottomTabBar";
import GlobalPlayer from "@/components/studio/screens/GlobalPlayer";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import LibraryRail from "./LibraryRail";
import NowPlayingRail from "./NowPlayingRail";
import StudioHeader from "./StudioHeader";
import { isSystemRoute } from "./routes";

/**
 * Rail geometry and card treatment shared by every consumer of the studio
 * shell. Public listening routes use this exact component rather than
 * recreating the normal app chrome.
 */
const RAIL_SLOT = {
  library: "hidden md:block md:min-h-0 w-[var(--shell-rail-w)] shrink-0",
  nowPlaying: "hidden 3xl:block md:min-h-0 w-[var(--shell-rail-w)] shrink-0",
} as const;

const RAIL_SURFACE = "rounded-2xl border border-border bg-card overflow-hidden";

const MAIN_BOTTOM_INSET = {
  idle: "pb-[calc(var(--bottom-nav-h)+0.5rem)]",
  playing: "pb-[calc(var(--mobile-chrome-h)+0.5rem)]",
} as const;

/**
 * The app's responsive shell grid: header, library rail, independently
 * scrolling page, now-playing rail, mobile navigation, and global player.
 */
export default function StudioShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const system = isSystemRoute(pathname);
  const { nowPlaying, playbackLoading } = useMockStudio();

  return (
    <div className="h-screen overflow-hidden flex flex-col p-2 sm:p-6 md:p-2 md:gap-2">
      <div className="hidden md:block shrink-0">
        <StudioHeader />
      </div>

      <div className="flex flex-1 min-h-0 md:gap-2">
        {system ? (
          <div aria-hidden className={cn(RAIL_SLOT.library, RAIL_SURFACE)} />
        ) : (
          <aside
            aria-labelledby="library-rail-heading"
            className={cn(RAIL_SLOT.library, RAIL_SURFACE)}
          >
            <LibraryRail />
          </aside>
        )}

        <main
          className={cn(
            "min-w-0 flex-1 min-h-0 overflow-y-auto",
            nowPlaying || playbackLoading
              ? MAIN_BOTTOM_INSET.playing
              : MAIN_BOTTOM_INSET.idle,
            "md:pb-0",
            "md:rounded-2xl md:border md:border-border md:bg-card",
            "md:px-6 md:pt-6 md:pb-6"
          )}
        >
          {children}
        </main>

        {system ? (
          <div aria-hidden className={cn(RAIL_SLOT.nowPlaying, RAIL_SURFACE)} />
        ) : (
          <aside
            aria-label="Now playing"
            className={cn(RAIL_SLOT.nowPlaying, RAIL_SURFACE)}
          >
            <NowPlayingRail />
          </aside>
        )}
      </div>

      <BottomTabBar />
      <GlobalPlayer />
    </div>
  );
}
