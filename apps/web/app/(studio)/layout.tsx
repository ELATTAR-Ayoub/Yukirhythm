"use client";

import { usePathname } from "next/navigation";

import { Toaster } from "sonner";

import { cn } from "@/lib/utils";
import StudioProvider from "@/components/studio/StudioProvider";
import BottomTabBar from "@/components/studio/screens/BottomTabBar";
import GlobalPlayer from "@/components/studio/screens/GlobalPlayer";
import StudioHeader from "@/components/studio/shell/StudioHeader";
import LibraryRail from "@/components/studio/shell/LibraryRail";
import NowPlayingRail from "@/components/studio/shell/NowPlayingRail";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { isSystemRoute } from "@/components/studio/shell/routes";

/**
 * The shell grid: header row, a flex band of independently scrolling
 * columns, then the playback bar — locked to `100vh` at EVERY width, with
 * the document itself never scrolling and `main` as the page's scroller.
 * Below `md` the grid collapses to a single plain column: header and rails
 * are `hidden` (Tailwind breakpoint classes, not `useBreakpoint`, so there
 * is no first-paint flash), `BottomTabBar` and `MiniPlayerBar` (inside
 * `GlobalPlayer`) take over.
 *
 * The viewport lock used to be `md:`-only, which left mobile as a plain
 * block column with the document as the scroller. That meant a route
 * wanting fixed chrome (the create wizard's header + CTA) had no height to
 * anchor against and had to escape to `fixed inset-0` — which dropped it
 * out of `main` and took the column's surface with it, leaving content
 * floating on the raw body background. Locking mobile too gives every
 * route a real height to divide up, so no route needs that escape hatch.
 *
 * The old centring wrapper (`max-w-6xl mx-auto p-2 sm:p-6`) used to live in
 * the ancestor `screens/layout.tsx` and applied here too — it fought this
 * full-viewport grid, so it was pushed down into `ScreensFrame` for the
 * routes that still want it (auth, credits, terms, the screens index; see
 * that component's own comment). Below `md` the outer padding is `p-2
 * sm:p-6`, and `main` reserves bottom room for the fixed BottomTabBar plus
 * MiniPlayerBar when one is on screen — see `MAIN_BOTTOM_INSET`, derived
 * from the tokens that chrome is itself sized by, so the reservation cannot
 * drift from what occupies it. At
 * `md`+ that padding shrinks to a small `md:p-2` inset around the whole
 * grid, and `main` grows its own `md:px-6 md:pt-6` so its card reads as a
 * page with content, not a bare box.
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

/**
 * What `main` reserves at the bottom below `md`, tracking what is actually
 * fixed down there. `MiniPlayerBar` only renders with a track loaded, so
 * reserving room for it unconditionally leaves ~82px of dead band on a cold
 * session — the same dead space, just moved to the other playback state.
 *
 * Both branches are literal class strings (Tailwind scans source text, so an
 * interpolated value would generate no CSS) and both are built from the same
 * tokens the chrome sizes itself with, so the reservation still cannot drift
 * from what occupies it.
 */
const MAIN_BOTTOM_INSET = {
  /** Nav only — no player on screen. */
  idle: "pb-[calc(var(--bottom-nav-h)+0.5rem)]",
  /** Nav + gap + player. */
  playing: "pb-[calc(var(--mobile-chrome-h)+0.5rem)]",
} as const;

function Shell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const system = isSystemRoute(pathname);
  const { nowPlaying } = useMockStudio();

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
            // Exactly the fixed chrome below md, plus a little breathing
            // room — not a guessed `pb-44`, and not a constant either, since
            // the mini player only exists while something is loaded. Zero at
            // md+, where PlaybackBar is an in-flow flex sibling instead.
            nowPlaying ? MAIN_BOTTOM_INSET.playing : MAIN_BOTTOM_INSET.idle,
            "md:pb-0",
            "md:rounded-2xl md:border md:border-border md:bg-card",
            // Symmetric: the column's bottom inset matches its top, so a page
            // whose last element is a CTA doesn't end flush against the card
            // edge. Mobile keeps the chrome reservation above instead — that
            // padding is clearance for the fixed bars, not page inset.
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

/**
 * The real app shell: the studio grid on the real backend. Screens read data
 * from the studio context, which StudioProvider fills from the API.
 */
export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StudioProvider>
      <Shell>{children}</Shell>
      <Toaster />
    </StudioProvider>
  );
}
