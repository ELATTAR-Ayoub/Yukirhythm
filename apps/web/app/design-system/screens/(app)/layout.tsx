"use client";

import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import BottomTabBar from "@/components/studio/screens/BottomTabBar";
import GlobalPlayer from "@/components/studio/screens/GlobalPlayer";
import StudioHeader from "@/components/studio/shell/StudioHeader";
import LibraryRail from "@/components/studio/shell/LibraryRail";
import NowPlayingRail from "@/components/studio/shell/NowPlayingRail";
import { isSystemRoute } from "@/components/studio/shell/routes";

/**
 * The desktop shell grid: header row, a flex band of independently
 * scrolling columns, then the playback bar — all locked to `100vh` with the
 * document itself never scrolling. Below `md` this collapses to a single
 * plain column exactly as before: header and rails are `hidden` (Tailwind
 * breakpoint classes, not `useBreakpoint`, so there is no first-paint flash),
 * `BottomTabBar` and `MiniPlayerBar` (inside `GlobalPlayer`) take over.
 *
 * The old centring wrapper (`max-w-6xl mx-auto p-2 sm:p-6`) used to live in
 * the ancestor `screens/layout.tsx` and applied here too — it fought this
 * full-viewport grid, so it was pushed down into `ScreensFrame` for the
 * routes that still want it (auth, credits, terms, the screens index; see
 * that component's own comment). Below `md`, THIS layout now reproduces the
 * same padding total that wrapper used to contribute — `p-2 sm:p-6` here,
 * plus `main`'s own `pb-44` for the fixed MiniPlayerBar/BottomTabBar — so
 * mobile is pixel-identical to before. At `md`+ that padding shrinks to a
 * small `md:p-2` inset around the whole grid, and `main` grows its own
 * `md:px-6 md:pt-6` so its card reads as a page with content, not a bare box.
 */
/**
 * Rail geometry and card treatment, shared between a populated rail and the
 * empty one a system route leaves in its place. A system route empties the
 * rails, it does not remove them: the panels keep their width, border and
 * surface so the grid holds its shape and the page column measures the same
 * on Settings as it does on Home. Walking into a system route should quiet
 * the rails, not resize the page.
 */
const RAIL_SLOT = {
  library: "hidden md:block md:min-h-0 w-[var(--shell-rail-w)] shrink-0",
  nowPlaying: "hidden 3xl:block md:min-h-0 w-[var(--shell-rail-w)] shrink-0",
} as const;

const RAIL_SURFACE = "rounded-2xl border border-border bg-card overflow-hidden";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const system = isSystemRoute(pathname);

  return (
    <div className="p-2 sm:p-6 md:p-2 md:h-screen md:overflow-hidden md:flex md:flex-col md:gap-2">
      <div className="hidden md:block shrink-0">
        <StudioHeader />
      </div>

      <div className="md:flex md:flex-1 md:min-h-0 md:gap-2">
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
            "min-w-0 flex-1 md:min-h-0",
            "pb-44 md:pb-0",
            "md:overflow-y-auto md:rounded-2xl md:border md:border-border md:bg-card",
            "md:px-6 md:pt-6"
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
