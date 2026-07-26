"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import DragScroller from "@/components/studio/DragScroller";
import SectionLabel from "@/components/studio/SectionLabel";
import { SkeletonCard } from "@/components/studio/Skeletons";
import { useIsDesktop } from "@/components/studio/shell/useBreakpoint";

interface RailShelfProps {
  label: string;
  title: string;
  seeAllHref?: string;
  /** Optional control aligned opposite the shelf title. */
  headerAction?: React.ReactNode;
  /** Skeletons everything — header, see-all and cards. */
  loading?: boolean;
  /**
   * Wraps children into a grid instead of the horizontal drag-scroller once
   * the viewport is desktop-width. Mobile always keeps the scroller — this
   * only ever adds a wider-screen presentation, never removes the default.
   */
  grid?: boolean;
  children?: React.ReactNode;
  className?: string;
  /** Signal: shelf_scroll, shelf_see_all */
}

/**
 * Horizontal scroller shelf — "Recently played", "New releases", etc.
 *
 * `grid` swaps the scroller for a wrapped grid on desktop. This is a
 * render-shape decision, not a styling one: `DragScroller` attaches
 * pointer-capture drag and wheel-redirect listeners meant for a horizontally
 * overflowing row. Left mounted under a grid (no horizontal overflow to
 * drag), a slightly-off click that trips its `moved > 3px` slop threshold
 * would still swallow the click meant for a card underneath — so the
 * scroller has to not be there at all in grid mode, not just be restyled.
 * That means the swap is driven by `useIsDesktop()` rather than pure
 * Tailwind breakpoint classes, and inherits its one-frame mobile-shaped flash
 * on desktop's first paint (documented on the hook). Acceptable here: it's a
 * single frame during hydration, already the accepted trade-off for every
 * other render-shape swap in this shell (e.g. `PlaybackBar`'s wide-vs-narrow
 * swap), and the alternative — leaving `DragScroller` mounted and just
 * restyling its children into a grid — reintroduces the click-swallowing bug
 * above.
 */
export default function RailShelf({
  label,
  title,
  seeAllHref,
  headerAction,
  loading = false,
  grid = false,
  children,
  className,
}: RailShelfProps) {
  const isDesktop = useIsDesktop();
  const asGrid = grid && isDesktop;

  if (loading) {
    return (
      <section className={cn("w-full", className)} aria-busy>
        <div className="flex items-end justify-between gap-4 mb-3 animate-pulse">
          <div>
            <div className="h-2.5 w-24 bg-muted rounded-sm" />
            <div className="h-6 w-48 bg-muted rounded-sm mt-2" />
          </div>
          <div className="h-7 w-20 bg-muted rounded-full" />
        </div>
        <div className="flex gap-4 overflow-hidden pb-3 -mx-1 px-1">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} className="w-36" />
          ))}
        </div>
      </section>
    );
  }
  return (
    <section className={cn("w-full", className)} data-signal="shelf_scroll">
      <div className="flex items-end justify-between gap-4 mb-3">
        <div>
          <SectionLabel>{label}</SectionLabel>
          <h2 className="font-display font-bold text-2xl tracking-tight mt-0.5">
            {title}
          </h2>
        </div>
        {headerAction ? (
          <div className="shrink-0">{headerAction}</div>
        ) : seeAllHref ? (
          <Button variant="ghost" size="sm" asChild className="shrink-0">
            <Link href={seeAllHref} data-signal="shelf_see_all">
              See all
              <ArrowRightIcon className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        ) : null}
      </div>
      {asGrid ? (
        // `3xl:grid-cols-5` used to be silently beaten by `lg:grid-cols-4`
        // above 1440px: Tailwind 4 emitted the shell's custom `3xl`
        // breakpoint's media block earlier in the stylesheet than the
        // built-in `lg`/`xl`/`2xl` blocks regardless of its 1440px value,
        // so equal-specificity source order let `lg:` win even past 1440px.
        // Fixed at the token level — `--breakpoint-3xl` in app/globals.css
        // now redeclares the whole sm..3xl scale so every entry lands in
        // the same theme-merge pass and keeps ascending source order. With
        // that fixed, `3xl:grid-cols-5` genuinely applies above 1440px:
        // measured live (three-column shell, both rails visible) at
        // 1600px the page column is ~838px wide and lands 5 cards at
        // ~155px each; at 1920px the column widens to ~1158px and cards
        // grow to ~219px. Both comfortably clear the card's own minimum
        // content width, so 5 columns is a genuine improvement over 4
        // rather than a cramped step.
        <div className="grid grid-cols-2 lg:grid-cols-4 3xl:grid-cols-5 gap-4 pb-3">
          {children}
        </div>
      ) : (
        <DragScroller className="pb-3 -mx-1 px-1">
          <div className="flex gap-4 w-max">{children}</div>
        </DragScroller>
      )}
    </section>
  );
}
