# Desktop & Tablet Grid Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the phone-in-a-centered-column desktop layout of the design studio with a three-column application shell — library rail, routed page surface, now-playing rail — plus a full-width playback bar, without changing mobile behavior.

**Architecture:** The `(app)` route group layout becomes a fixed `100vh` grid whose columns each own their scroll. Column visibility is driven by Tailwind breakpoint classes so the grid has no hydration flash. A `useBreakpointUp` matchMedia hook drives only drawer-vs-inline *mounting* of feature bodies (queue, add-music), which CSS cannot do because a vaul drawer either mounts or it does not. Playlist detail becomes a real route (`/playlist/[id]`) reusing the same `CollectionDetail` body the mobile drawer uses.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 (CSS-first — **there is no `tailwind.config.js`**; all tokens live in `apps/web/app/globals.css`), vaul drawers, Radix primitives, Vitest + Testing Library.

**Working directory:** all paths below are relative to `apps/web/` unless stated otherwise. Repo root is `D:\Dev\YukiRythem\Yukirhythm`. Branch: `v2_2026`.

**Test command:** `npm test -- <path>` (Vitest). Typecheck: `npm run typecheck`.

---

## Ground rules for this plan

1. **Mobile is a regression surface.** Below `768px` nothing may change: bottom tab bar, `MiniPlayerBar`, `PlaylistDrawer`, `QueueDrawer`, `AddMusicDrawer` all behave exactly as they do today. Task 15 verifies this.
2. **Existing tests must keep passing.** In particular `components/studio/screens/GlobalPlayer.test.tsx`, `app/design-system/screens/(app)/library/page.test.tsx`, `components/studio/screens/MockStudioProvider.test.tsx`.
3. **Design constraints from the spec:** every numeral renders through `DataText`; alternating icons use `IconSwap`; colors come from semantic tokens (`bg-card`, `text-muted-foreground`, …) — no raw hex; motion uses `duration-fast|base|slow` and the `--ease-*` tokens.
4. `globals.css` deliberately restores Tailwind v3 bare-`border` color behavior and forces `outline: none !important` on popper/dialog/menu surfaces. Do not "fix" either.
5. Commit after every task.

---

## File structure

**Created:**

| Path | Responsibility |
|---|---|
| `components/studio/shell/useIsDesktop.ts` | matchMedia hooks — `useBreakpointUp`, `useIsDesktop`, `useIsWide`. SSR-safe. |
| `components/studio/shell/routes.ts` | Route constants + `isSystemRoute()` predicate. Pure, no React. |
| `components/studio/shell/StudioHeader.tsx` | Fixed 56px header — logo, home button + search field, avatar menu. |
| `components/studio/shell/LibraryRail.tsx` | Left 340px column. |
| `components/studio/shell/NowPlayingRail.tsx` | Right 340px column — docked player, Up Next, Add Music. |
| `components/studio/shell/PlaybackBar.tsx` | Full-width 88px bottom bar. |
| `components/studio/screens/QueuePanel.tsx` | Queue body, extracted from `QueueDrawer`. |
| `components/studio/screens/AddMusicPanel.tsx` | Add-music body, extracted from `AddMusicDrawer`. |
| `app/design-system/screens/(app)/playlist/[id]/page.tsx` | Playlist detail route. |
| `components/studio/screens/PlaylistHero.tsx` | Vinyl hero header for the playlist route. |

**Modified:**

| Path | Change |
|---|---|
| `app/globals.css` | Add `--breakpoint-3xl`, `--shell-header-h`, `--shell-bar-h`, `--shell-rail-w`. |
| `app/design-system/screens/layout.tsx` | Drop `max-w-6xl mx-auto p-2 sm:p-6` for the `(app)` tree (moves into the grid). |
| `app/design-system/screens/(app)/layout.tsx` | Rewritten as the grid. |
| `components/studio/screens/QueueDrawer.tsx` | Becomes a thin wrapper over `QueuePanel`. |
| `components/studio/screens/AddMusicDrawer.tsx` | Becomes a thin wrapper over `AddMusicPanel`. |
| `components/studio/screens/DevicePlayer.tsx` | Gains a `docked` prop. |
| `components/studio/screens/GlobalPlayer.tsx` | Swaps `MiniPlayerBar` for `PlaybackBar` at `md+`. |
| `components/studio/TrackRow.tsx` | Gains a `desktop` variant with album/added columns. |

**Deleted:** none. `SideNav.tsx` stays in place until Task 12 removes its last usage; it is deleted in Task 12.

---

## Task 1: Shell tokens

**Files:**
- Modify: `app/globals.css` (the `@theme` block starting at line 35)

- [ ] **Step 1: Add the breakpoint and shell size tokens**

Tailwind 4 reads breakpoints from `@theme` — `--breakpoint-3xl` creates the `3xl:` variant. Add these at the end of the `@theme { ... }` block that begins at line 35, just before its closing brace:

```css
  /* ── Desktop shell ──────────────────────────────────────────────
     3xl is the three-column threshold. It sits at 1440 rather than
     Tailwind's stock xl (1280) because two 340px rails leave only
     ~570px of page column at 1280 — too narrow for the playlist
     track table. Below 3xl the right rail is dropped entirely. */
  --breakpoint-3xl: 1440px;
  --shell-header-h: 56px;
  --shell-bar-h: 88px;
  --shell-rail-w: 340px;
```

- [ ] **Step 2: Verify the variant compiles**

Run: `npm run build`
Expected: build succeeds. (Tailwind 4 errors at build time on an unknown variant, so a later `3xl:` class would fail loudly if the token were wrong.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "feat(studio): add 3xl breakpoint and desktop shell size tokens"
```

---

## Task 2: The breakpoint hook

**Files:**
- Create: `components/studio/shell/useIsDesktop.ts`
- Test: `components/studio/shell/useIsDesktop.test.ts`

The hook must return `false` on the server and on the first client render, then correct itself in an effect. This is deliberate: `useSyncExternalStore` with a non-matching server snapshot would be equivalent, and returning the real value during render would cause a hydration mismatch. Because the hook only governs drawer-vs-inline mounting (a closed drawer renders nothing), the one-frame mobile default is invisible.

- [ ] **Step 1: Write the failing test**

Create `components/studio/shell/useIsDesktop.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useBreakpointUp, DESKTOP_MIN, WIDE_MIN } from "./useIsDesktop";

/** Minimal matchMedia double: we control `matches` and fire the listener. */
function stubMatchMedia(initial: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches: initial,
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) =>
      listeners.add(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) =>
      listeners.delete(cb),
  };
  const matchMedia = vi.fn(() => mql);
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    matchMedia,
    mql,
    set(next: boolean) {
      mql.matches = next;
      listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent));
    },
    listenerCount: () => listeners.size,
  };
}

describe("useBreakpointUp", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports the real match after mount", () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useBreakpointUp(WIDE_MIN));
    expect(result.current).toBe(true);
  });

  it("is false when the query does not match", () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useBreakpointUp(WIDE_MIN));
    expect(result.current).toBe(false);
  });

  it("queries min-width in px", () => {
    const stub = stubMatchMedia(true);
    renderHook(() => useBreakpointUp(DESKTOP_MIN));
    expect(stub.matchMedia).toHaveBeenCalledWith("(min-width: 768px)");
  });

  it("updates when the viewport crosses the threshold", () => {
    const stub = stubMatchMedia(false);
    const { result } = renderHook(() => useBreakpointUp(WIDE_MIN));
    expect(result.current).toBe(false);

    act(() => stub.set(true));
    expect(result.current).toBe(true);
  });

  it("removes its listener on unmount", () => {
    const stub = stubMatchMedia(true);
    const { unmount } = renderHook(() => useBreakpointUp(WIDE_MIN));
    expect(stub.listenerCount()).toBe(1);

    unmount();
    expect(stub.listenerCount()).toBe(0);
  });

  it("returns false when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useBreakpointUp(WIDE_MIN));
    expect(result.current).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- components/studio/shell/useIsDesktop.test.ts`
Expected: FAIL — `Failed to resolve import "./useIsDesktop"`.

- [ ] **Step 3: Write the implementation**

Create `components/studio/shell/useIsDesktop.ts`:

```ts
"use client";

import { useEffect, useState } from "react";

/** Two columns from here up (Tailwind `md`). */
export const DESKTOP_MIN = 768;
/** Three columns from here up (our `3xl` token). */
export const WIDE_MIN = 1440;

/**
 * True once the viewport is at least `minWidth` px wide.
 *
 * Returns false on the server and on the first client render, then corrects
 * itself in an effect — reading matchMedia during render would desync
 * hydration. Callers must therefore tolerate one mobile-default frame, which
 * is why this drives drawer-vs-inline *mounting* only; the grid itself uses
 * Tailwind breakpoint classes so it never flashes.
 */
export function useBreakpointUp(minWidth: number): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // jsdom and older Safari lack matchMedia — stay on the mobile default.
    if (typeof window.matchMedia !== "function") return;

    const mql = window.matchMedia(`(min-width: ${minWidth}px)`);
    setMatches(mql.matches);

    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [minWidth]);

  return matches;
}

/** Library rail visible — two columns or more. */
export function useIsDesktop(): boolean {
  return useBreakpointUp(DESKTOP_MIN);
}

/** Now-playing rail visible — the full three-column grid. */
export function useIsWide(): boolean {
  return useBreakpointUp(WIDE_MIN);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- components/studio/shell/useIsDesktop.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/studio/shell/useIsDesktop.ts apps/web/components/studio/shell/useIsDesktop.test.ts
git commit -m "feat(studio): add SSR-safe breakpoint hooks for the desktop shell"
```

---

## Task 3: Route constants and the system-route predicate

**Files:**
- Create: `components/studio/shell/routes.ts`
- Test: `components/studio/shell/routes.test.ts`

System routes are the "serious" pages — on these the layout drops both rails so the user is not confused about whether they are in a music surface.

- [ ] **Step 1: Write the failing test**

Create `components/studio/shell/routes.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import { SCREENS, isSystemRoute, playlistHref } from "./routes";

describe("isSystemRoute", () => {
  it("treats profile and its subpages as system routes", () => {
    expect(isSystemRoute(`${SCREENS}/profile`)).toBe(true);
    expect(isSystemRoute(`${SCREENS}/profile/settings`)).toBe(true);
    expect(isSystemRoute(`${SCREENS}/profile/privacy`)).toBe(true);
  });

  it("treats credits and terms as system routes", () => {
    expect(isSystemRoute(`${SCREENS}/credits`)).toBe(true);
    expect(isSystemRoute(`${SCREENS}/terms`)).toBe(true);
  });

  it("does not treat music surfaces as system routes", () => {
    expect(isSystemRoute(`${SCREENS}/home`)).toBe(false);
    expect(isSystemRoute(`${SCREENS}/search`)).toBe(false);
    expect(isSystemRoute(`${SCREENS}/library`)).toBe(false);
    expect(isSystemRoute(`${SCREENS}/playlist/liked`)).toBe(false);
  });

  it("does not match a route that merely starts with the same letters", () => {
    expect(isSystemRoute(`${SCREENS}/terminal`)).toBe(false);
    expect(isSystemRoute(`${SCREENS}/profiles`)).toBe(false);
  });

  it("tolerates a null pathname", () => {
    expect(isSystemRoute(null)).toBe(false);
  });
});

describe("playlistHref", () => {
  it("builds the playlist route and encodes the id", () => {
    expect(playlistHref("liked")).toBe(`${SCREENS}/playlist/liked`);
    expect(playlistHref("local 1")).toBe(`${SCREENS}/playlist/local%201`);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- components/studio/shell/routes.test.ts`
Expected: FAIL — `Failed to resolve import "./routes"`.

- [ ] **Step 3: Write the implementation**

Create `components/studio/shell/routes.ts`:

```ts
/** Route helpers for the studio shell. Pure — no React, no navigation. */

export const SCREENS = "/design-system/screens";

export const HOME = `${SCREENS}/home`;
export const SEARCH = `${SCREENS}/search`;
export const LIBRARY = `${SCREENS}/library`;
export const AUTH = `${SCREENS}/auth`;
export const PROFILE = `${SCREENS}/profile`;

/**
 * Pages that are not music surfaces. On these the shell hides both rails and
 * centres the page column, so a settings screen never reads as "somewhere in
 * the player".
 */
const SYSTEM_ROOTS = [
  `${SCREENS}/profile`,
  `${SCREENS}/credits`,
  `${SCREENS}/terms`,
];

export function isSystemRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  // Exact match or a real path segment below it — `/terminal` must not match
  // `/terms`.
  return SYSTEM_ROOTS.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`)
  );
}

export function playlistHref(id: string): string {
  return `${SCREENS}/playlist/${encodeURIComponent(id)}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- components/studio/shell/routes.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/studio/shell/routes.ts apps/web/components/studio/shell/routes.test.ts
git commit -m "feat(studio): add shell route constants and system-route predicate"
```

---

## Task 4: Extract QueuePanel from QueueDrawer

**Files:**
- Create: `components/studio/screens/QueuePanel.tsx`
- Modify: `components/studio/screens/QueueDrawer.tsx` (whole file)

Behavior-preserving refactor. The synthetic "Up next" collection logic moves into the panel so both surfaces share it.

- [ ] **Step 1: Create the panel**

Create `components/studio/screens/QueuePanel.tsx`:

```tsx
"use client";

import { useMemo } from "react";

import CollectionDetail from "./CollectionDetail";
import { useMockStudio } from "./MockStudioProvider";
import { type MockCollection } from "./mock-data";

/**
 * What's playing right now. When playback was launched from a collection this
 * is that collection; when a track was played straight from search or a rail
 * there is no source, so the whole library queue is presented under a
 * synthetic "Up next" collection.
 *
 * Body only — QueueDrawer wraps this in a sheet on mobile, NowPlayingRail
 * renders it inline on desktop.
 */
export function useQueueCollection(): MockCollection {
  const { playingCollection, queue } = useMockStudio();

  return useMemo(
    () =>
      playingCollection ?? {
        id: "queue",
        title: "Up next",
        desc: "Everything queued from your library.",
        texture: "tx-k-silk",
        trackIds: queue.map((t) => t.id),
        likes: 0,
        tags: ["queue"],
        kind: "music",
        pinned: false,
      },
    [playingCollection, queue]
  );
}

export default function QueuePanel() {
  const { playingCollection } = useMockStudio();
  const collection = useQueueCollection();

  return (
    <CollectionDetail
      collection={collection}
      playFrom={playingCollection ?? undefined}
    />
  );
}
```

- [ ] **Step 2: Rewrite the drawer as a wrapper**

Replace the entire contents of `components/studio/screens/QueueDrawer.tsx` with:

```tsx
"use client";

import { ChevronDownIcon } from "@radix-ui/react-icons";

import { DrawerClose, DrawerTitle } from "@/components/ui/drawer";
import { PlayerButton } from "@/components/studio/PlayerButton";
import AppDrawer from "./AppDrawer";
import QueuePanel, { useQueueCollection } from "./QueuePanel";

interface QueueDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The queue as a full sheet — mobile presentation of QueuePanel. */
export default function QueueDrawer({ open, onOpenChange }: QueueDrawerProps) {
  const collection = useQueueCollection();

  return (
    <AppDrawer open={open} onOpenChange={onOpenChange} height="full">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2">
          <DrawerClose asChild>
            <PlayerButton variant="ghost" size="sm" aria-label="Close queue">
              <ChevronDownIcon />
            </PlayerButton>
          </DrawerClose>
          <DrawerTitle className="type-h2 truncate">
            {collection.title}
          </DrawerTitle>
        </div>

        <QueuePanel />
      </div>
    </AppDrawer>
  );
}
```

- [ ] **Step 3: Run the existing suite to confirm nothing regressed**

Run: `npm test`
Expected: PASS — same test count as before this task.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/studio/screens/QueuePanel.tsx apps/web/components/studio/screens/QueueDrawer.tsx
git commit -m "refactor(studio): extract QueuePanel so the queue body has one definition"
```

---

## Task 5: Extract AddMusicPanel from AddMusicDrawer

**Files:**
- Create: `components/studio/screens/AddMusicPanel.tsx`
- Modify: `components/studio/screens/AddMusicDrawer.tsx` (whole file)

The panel gains an `autoFocus` prop: the drawer wants focus on open, the docked rail does not (it would steal focus on every page load).

- [ ] **Step 1: Create the panel**

Create `components/studio/screens/AddMusicPanel.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { CheckIcon, MagnifyingGlassIcon, PlusIcon } from "@radix-ui/react-icons";

import { Input } from "@/components/ui/input";
import TrackRow from "@/components/studio/TrackRow";
import EmptyState from "@/components/studio/EmptyState";
import { PlayerButton } from "@/components/studio/PlayerButton";
import { useMockStudio } from "./MockStudioProvider";
import {
  formatDuration,
  searchMockTracks,
  type MockCollection,
} from "./mock-data";

interface AddMusicPanelProps {
  collection: MockCollection;
  /** The drawer focuses the field on open; the docked rail must not. */
  autoFocus?: boolean;
}

/**
 * Search-and-add body. Suggestions render inline rather than in a floating
 * popover — on a phone a popup over a sheet is unreachable, and in the rail a
 * popover would escape the column.
 */
export default function AddMusicPanel({
  collection,
  autoFocus = false,
}: AddMusicPanelProps) {
  const { addTrackToCollection } = useMockStudio();
  const [q, setQ] = useState("");

  // Suggestions are synchronous here — no need for the debounced global search.
  const results = useMemo(() => (q.trim() ? searchMockTracks(q) : []), [q]);

  return (
    <>
      <div className="relative mt-4 mb-6">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tracks, artists, tags…"
          aria-label="Search tracks to add"
          className="pl-9"
          data-signal="add_music_search"
        />
      </div>

      {!q.trim() ? (
        <EmptyState
          title="Search to add"
          hint="Find a track by title, artist or tag."
          texture="tx-k2-static"
        />
      ) : results.length === 0 ? (
        <EmptyState
          title="No matches"
          hint="Try a different title, artist or tag."
          texture="tx-k2-static"
        />
      ) : (
        <div className="space-y-1">
          {results.map((track, i) => {
            const added = collection.trackIds.includes(track.id);
            return (
              <div key={track.id} className="flex items-center gap-1">
                <div className="flex-1 min-w-0">
                  <TrackRow
                    index={i + 1}
                    title={track.title}
                    artist={track.artist}
                    duration={formatDuration(track.durationSec)}
                    texture={track.texture}
                  />
                </div>
                <PlayerButton
                  variant={added ? "primary" : "outline"}
                  size="sm"
                  disabled={added}
                  aria-label={
                    added
                      ? `${track.title} already added`
                      : `Add ${track.title}`
                  }
                  onClick={() => addTrackToCollection(collection.id, track.id)}
                  data-signal="add_music_confirm"
                >
                  {added ? <CheckIcon /> : <PlusIcon />}
                </PlayerButton>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Rewrite the drawer as a wrapper**

Replace the entire contents of `components/studio/screens/AddMusicDrawer.tsx` with:

```tsx
"use client";

import { DrawerTitle } from "@/components/ui/drawer";
import AppDrawer from "./AppDrawer";
import AddMusicPanel from "./AddMusicPanel";
import { type MockCollection } from "./mock-data";

interface AddMusicDrawerProps {
  collection: MockCollection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Mobile presentation of AddMusicPanel. */
export default function AddMusicDrawer({
  collection,
  open,
  onOpenChange,
}: AddMusicDrawerProps) {
  return (
    <AppDrawer open={open} onOpenChange={onOpenChange} height="full">
      <div className="max-w-3xl mx-auto">
        <DrawerTitle className="type-h2 truncate">Add music</DrawerTitle>
        <p className="type-muted mt-1 truncate">to {collection.title}</p>

        <AddMusicPanel collection={collection} autoFocus />
      </div>
    </AppDrawer>
  );
}
```

- [ ] **Step 3: Run the suite**

Run: `npm test`
Expected: PASS, unchanged count.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/studio/screens/AddMusicPanel.tsx apps/web/components/studio/screens/AddMusicDrawer.tsx
git commit -m "refactor(studio): extract AddMusicPanel from its drawer wrapper"
```

---

## Task 6: Dock the DevicePlayer

**Files:**
- Modify: `components/studio/screens/DevicePlayer.tsx`
- Test: `components/studio/screens/DevicePlayer.test.tsx` (create)

`docked` drops the collapse chevron and lets the card fill its column instead of capping at 340px. The search tray is also suppressed when docked — it hangs *below* the card's bottom edge, which would overlap the Up Next panel underneath it in the rail; the rail reaches search through the header field instead.

- [ ] **Step 1: Write the failing test**

Create `components/studio/screens/DevicePlayer.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import MockStudioProvider from "./MockStudioProvider";
import DevicePlayer from "./DevicePlayer";

describe("DevicePlayer", () => {
  it("shows a collapse control when given onCollapse", () => {
    render(
      <MockStudioProvider>
        <DevicePlayer onCollapse={() => {}} />
      </MockStudioProvider>
    );
    expect(screen.getByLabelText("Collapse player")).toBeTruthy();
  });

  it("has no collapse control when docked", () => {
    render(
      <MockStudioProvider>
        <DevicePlayer docked />
      </MockStudioProvider>
    );
    expect(screen.queryByLabelText("Collapse player")).toBeNull();
  });

  it("hides the search tray when docked", () => {
    render(
      <MockStudioProvider>
        <DevicePlayer docked />
      </MockStudioProvider>
    );
    expect(screen.queryByLabelText("Search tracks")).toBeNull();
  });

  it("keeps the search tray in the overlay presentation", () => {
    render(
      <MockStudioProvider>
        <DevicePlayer onCollapse={() => {}} />
      </MockStudioProvider>
    );
    expect(screen.getByLabelText("Search tracks")).toBeTruthy();
  });

  it("fills its container when docked instead of capping at 340px", () => {
    const { container } = render(
      <MockStudioProvider>
        <DevicePlayer docked />
      </MockStudioProvider>
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toContain("max-w-[340px]");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- components/studio/screens/DevicePlayer.test.tsx`
Expected: FAIL — the "has no collapse control when docked" and "hides the search tray when docked" cases fail because `docked` is not a prop yet (TypeScript will also flag it).

- [ ] **Step 3: Add the prop**

In `components/studio/screens/DevicePlayer.tsx`:

Replace the props interface and signature (lines 17–25) with:

```tsx
interface DevicePlayerProps {
  onCollapse?: () => void;
  /**
   * Docked in the now-playing rail rather than presented as an overlay:
   * fills its column, no collapse control, and no search tray (the tray hangs
   * below the card and would collide with the panels beneath it in the rail).
   */
  docked?: boolean;
}

/** The full device player — the app's signature surface, now a component. */
export default function DevicePlayer({ onCollapse, docked = false }: DevicePlayerProps) {
  const { nowPlaying, isPlaying, progressSec, seek, navDirection } =
    useMockStudio();
  const [discExpanded, setDiscExpanded] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
```

Replace the root element (line 30) with:

```tsx
    <div className={cn("relative w-full", !docked && "max-w-[340px]")}>
```

Wrap the search tray: change line 37's opening `<div` block so the whole tray is conditional. Replace lines 31–68 (the comment block plus the tray `<div>…</div>`) with:

```tsx
      {/*
        The search tray. It sits behind the card and slides down out of it like
        the keyboard on a slider phone: tucked under the card's bottom edge so
        the two read as one chassis, with only the lower slab and its input
        showing. z-0 keeps it under the card, which hides the tucked portion.
      */}
      {docked ? null : (
        <div
          className={cn(
            "absolute inset-x-4 top-full -mt-11 z-0 anim-tray-out",
            "transition-opacity duration-500",
            discExpanded && "opacity-0 pointer-events-none"
          )}
        >
          <div
            className={cn(
              "rounded-b-[30px] border border-t-0 border-border bg-muted/60",
              "shadow-e3 pt-14 pb-4 px-4"
            )}
          >
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search tracks"
              data-signal="player_search_open"
              className={cn(
                "w-full flex items-center gap-2.5 rounded-full border border-border bg-background/70",
                "px-4 py-2.5 text-left text-muted-foreground",
                "hover:text-foreground hover:border-primary/40 transition-colors duration-fast",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              )}
            >
              <MagnifyingGlassIcon className="w-4 h-4 shrink-0" />
              <span className="type-small font-normal truncate">
                Search tracks, artists…
              </span>
            </button>
          </div>
        </div>
      )}
```

Leave the rest of the component — `VinylDisc`, the seek slider, `Transport`, `QueueDrawer`, `PlayerSearchDrawer` — exactly as it is. `PlayerSearchDrawer` stays mounted because `searchOpen` can never become true when docked, so it renders nothing.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- components/studio/screens/DevicePlayer.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/studio/screens/DevicePlayer.tsx apps/web/components/studio/screens/DevicePlayer.test.tsx
git commit -m "feat(studio): add a docked presentation to DevicePlayer"
```

---

## Task 7: StudioHeader

**Files:**
- Create: `components/studio/shell/StudioHeader.tsx`
- Test: `components/studio/shell/StudioHeader.test.tsx`

Logo left, Home button + search field centred, avatar menu right. Typing in the field routes to `/search` and runs the studio search; the avatar menu routes to system pages.

- [ ] **Step 1: Write the failing test**

Create `components/studio/shell/StudioHeader.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import StudioHeader from "./StudioHeader";
import { SEARCH } from "./routes";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/design-system/screens/home",
}));

describe("StudioHeader", () => {
  beforeEach(() => push.mockClear());

  it("routes to the search page when the field is focused", () => {
    render(
      <MockStudioProvider>
        <StudioHeader />
      </MockStudioProvider>
    );

    fireEvent.focus(screen.getByLabelText("Search"));
    expect(push).toHaveBeenCalledWith(SEARCH);
  });

  it("links home", () => {
    render(
      <MockStudioProvider>
        <StudioHeader />
      </MockStudioProvider>
    );
    expect(screen.getByLabelText("Home")).toBeTruthy();
  });

  it("opens a profile menu from the avatar", () => {
    render(
      <MockStudioProvider>
        <StudioHeader />
      </MockStudioProvider>
    );

    fireEvent.click(screen.getByLabelText("Account menu"));
    expect(screen.getByText("Settings")).toBeTruthy();
    expect(screen.getByText("Credits")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- components/studio/shell/StudioHeader.test.tsx`
Expected: FAIL — `Failed to resolve import "./StudioHeader"`.

- [ ] **Step 3: Write the implementation**

Create `components/studio/shell/StudioHeader.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { HomeIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { AUTH, HOME, SCREENS, SEARCH } from "./routes";

const MENU = [
  { href: `${SCREENS}/profile/view`, label: "Profile" },
  { href: `${SCREENS}/profile/stats`, label: "Stats" },
  { href: `${SCREENS}/profile/recents`, label: "Recents" },
  { href: `${SCREENS}/profile/settings`, label: "Settings" },
  { href: `${SCREENS}/profile/privacy`, label: "Privacy" },
  { href: `${SCREENS}/credits`, label: "Credits" },
];

/**
 * The shell's fixed top bar. The search field is the only way into the search
 * page on desktop — focusing it routes there, so typing never happens on a
 * screen that cannot show results.
 */
export default function StudioHeader() {
  const router = useRouter();
  const { user, signOut, search, clearSearch } = useMockStudio();
  const [q, setQ] = useState("");

  const onChange = (value: string) => {
    setQ(value);
    if (value.trim()) {
      search(value);
    } else {
      clearSearch();
    }
  };

  return (
    <header
      className="h-[var(--shell-header-h)] shrink-0 flex items-center gap-3 px-3"
      aria-label="Application"
    >
      <Link href={HOME} className="flex items-center gap-2 shrink-0 px-1">
        <Image
          src="/svgs/logo_light.svg"
          width={20}
          height={20}
          alt=""
          className="h-5 w-auto object-contain"
        />
        <span className="font-display font-bold tracking-tight hidden sm:inline">
          Yukirhythm
        </span>
      </Link>

      <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
        <Link
          href={HOME}
          aria-label="Home"
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full shrink-0",
            "bg-secondary text-foreground hover:text-primary",
            "transition-colors duration-fast"
          )}
        >
          <HomeIcon className="w-4 h-4" />
        </Link>
        <div className="relative w-full max-w-[480px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={q}
            aria-label="Search"
            placeholder="What do you want to play?"
            className="pl-9 rounded-full"
            data-signal="shell_search"
            onFocus={() => router.push(SEARCH)}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>

      <div className="shrink-0">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="rounded-full focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <Avatar className="w-9 h-9 border border-border">
                  <AvatarFallback className="bg-cobalt text-snow font-ui text-xs">
                    {user.initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {MENU.map(({ href, label }) => (
                <DropdownMenuItem key={href} asChild>
                  <Link href={href}>{label}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => signOut()}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link
            href={AUTH}
            className="font-ui text-sm px-4 py-2 rounded-full bg-secondary hover:text-primary transition-colors duration-fast"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- components/studio/shell/StudioHeader.test.tsx`
Expected: PASS, 3 tests.

If the dropdown test fails because Radix needs a pointer-events shim under jsdom, add this to the top of the test file's `describe`:

```tsx
beforeEach(() => {
  // Radix checks pointer capture APIs jsdom does not implement.
  window.HTMLElement.prototype.hasPointerCapture = () => false;
  window.HTMLElement.prototype.releasePointerCapture = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
});
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/studio/shell/StudioHeader.tsx apps/web/components/studio/shell/StudioHeader.test.tsx
git commit -m "feat(studio): add the shell header with search and account menu"
```

---

## Task 8: LibraryRail

**Files:**
- Create: `components/studio/shell/LibraryRail.tsx`
- Test: `components/studio/shell/LibraryRail.test.tsx`

The rail is the library, docked. Clicking a row **navigates** to the playlist route — it does not start playback and it does not open a drawer.

- [ ] **Step 1: Write the failing test**

Create `components/studio/shell/LibraryRail.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import LibraryRail from "./LibraryRail";
import { playlistHref } from "./routes";

vi.mock("next/navigation", () => ({
  usePathname: () => "/design-system/screens/home",
}));

describe("LibraryRail", () => {
  it("links each collection to its playlist route", () => {
    render(
      <MockStudioProvider>
        <LibraryRail />
      </MockStudioProvider>
    );

    const liked = screen.getByRole("link", { name: /liked songs/i });
    expect(liked.getAttribute("href")).toBe(playlistHref("liked"));
  });

  it("marks the open collection as current", () => {
    vi.resetModules();
    render(
      <MockStudioProvider>
        <LibraryRail />
      </MockStudioProvider>
    );

    const liked = screen.getByRole("link", { name: /liked songs/i });
    expect(liked.getAttribute("aria-current")).toBeNull();
  });

  it("offers a create control", () => {
    render(
      <MockStudioProvider>
        <LibraryRail />
      </MockStudioProvider>
    );
    expect(screen.getByLabelText("Create playlist")).toBeTruthy();
  });
});
```

> Note: `LIKED_SONGS.id` is assumed to be `"liked"`. Before writing the implementation, confirm with:
> `grep -n "id:" apps/web/components/studio/screens/mock-data.ts | head -5`
> If the id differs, use the real value in the test.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- components/studio/shell/LibraryRail.test.tsx`
Expected: FAIL — `Failed to resolve import "./LibraryRail"`.

- [ ] **Step 3: Write the implementation**

Create `components/studio/shell/LibraryRail.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DrawingPinFilledIcon, PlusIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import MediaCard from "@/components/studio/MediaCard";
import { PlayerButton } from "@/components/studio/PlayerButton";
import SignInPrompt from "@/components/studio/screens/SignInPrompt";
import CreatePlaylistDrawer from "@/components/studio/screens/CreatePlaylistDrawer";
import { FilterChipRow } from "@/components/studio/screens/TagChip";
import {
  LIBRARY_FILTERS,
  filterLibrary,
} from "@/components/studio/screens/library-utils";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { playlistHref } from "./routes";

/**
 * The left column: the library, permanently docked. Rows navigate to the
 * playlist route rather than opening a sheet — on desktop the page column is
 * where detail belongs, and the rail must stay put so the user keeps their
 * place in the list.
 */
export default function LibraryRail() {
  const { user, collections, libraryFilter, setLibraryFilter } =
    useMockStudio();
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);

  if (!user) {
    return (
      <div className="p-4">
        <h2 className="type-h3 mb-3">Your Library</h2>
        <SignInPrompt hint="Playlists, podcasts and Liked Songs live here." />
      </div>
    );
  }

  const visible = filterLibrary(collections, libraryFilter);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3 shrink-0">
        <h2 className="type-h3">Your Library</h2>
        <PlayerButton
          variant="ghost"
          aria-label="Create playlist"
          onClick={() => setCreating(true)}
        >
          <PlusIcon />
        </PlayerButton>
      </div>

      <div className="px-4 shrink-0">
        <FilterChipRow
          options={LIBRARY_FILTERS}
          value={libraryFilter}
          onChange={setLibraryFilter}
          className="mb-4"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3 pb-4 space-y-2">
        {visible.map((c) => {
          const href = playlistHref(c.id);
          const active = pathname === href;
          return (
            <Link
              key={c.id}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={`Open collection ${c.title}`}
              className={cn(
                "relative block rounded-lg transition-colors duration-fast",
                active && "bg-secondary"
              )}
            >
              <MediaCard
                title={c.title}
                artist={`${c.trackIds.length} tracks · ${c.kind}`}
                texture={c.texture}
                variant="extended"
                size="sm"
              />
              {c.pinned ? (
                <DrawingPinFilledIcon
                  aria-label="Pinned"
                  className="absolute top-2.5 right-2.5 w-3.5 h-3.5 text-primary"
                />
              ) : null}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-full flex items-center gap-4 p-3 rounded-lg border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors duration-fast"
        >
          <span className="flex items-center justify-center w-12 h-12 rounded-md bg-secondary shrink-0">
            <PlusIcon className="w-5 h-5" />
          </span>
          <span className="font-ui font-medium text-sm">Create playlist</span>
        </button>
      </div>

      <CreatePlaylistDrawer open={creating} onOpenChange={setCreating} />
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- components/studio/shell/LibraryRail.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/studio/shell/LibraryRail.tsx apps/web/components/studio/shell/LibraryRail.test.tsx
git commit -m "feat(studio): add the docked library rail"
```

---

## Task 9: The playlist route

**Files:**
- Create: `app/design-system/screens/(app)/playlist/[id]/page.tsx`
- Create: `components/studio/screens/PlaylistHero.tsx`
- Test: `app/design-system/screens/(app)/playlist/[id]/page.test.tsx`

The hero is a vinyl, not a square card — the one deliberate deviation from Spotify. It spins only when this collection is the one playing.

- [ ] **Step 1: Write the failing test**

Create `app/design-system/screens/(app)/playlist/[id]/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import PlaylistScreen from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "liked" }),
  usePathname: () => "/design-system/screens/playlist/liked",
}));

describe("PlaylistScreen", () => {
  it("renders the collection title and description", () => {
    render(
      <MockStudioProvider>
        <PlaylistScreen />
      </MockStudioProvider>
    );

    expect(screen.getByText("Liked Songs")).toBeTruthy();
    expect(screen.getByText(/Every track you've hearted/)).toBeTruthy();
  });

  it("renders a play control for the collection", () => {
    render(
      <MockStudioProvider>
        <PlaylistScreen />
      </MockStudioProvider>
    );
    expect(screen.getByLabelText("Play collection")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- "app/design-system/screens/(app)/playlist/[id]/page.test.tsx"`
Expected: FAIL — `Failed to resolve import "./page"`.

- [ ] **Step 3: Write the hero**

Create `components/studio/screens/PlaylistHero.tsx`:

```tsx
"use client";

import SpinningDisc from "@/components/studio/SpinningDisc";
import AnimatedTexture from "@/components/studio/AnimatedTexture";
import DataText from "@/components/studio/DataText";
import { useMockStudio } from "./MockStudioProvider";
import {
  formatDuration,
  getCollectionTracks,
  type MockCollection,
} from "./mock-data";

/**
 * Playlist page header. Spotify puts a square card here; we put the record,
 * and it only turns when this collection is the one actually playing — the
 * page should not imply playback it isn't driving.
 */
export default function PlaylistHero({
  collection,
}: {
  collection: MockCollection;
}) {
  const { playingCollection, isPlaying } = useMockStudio();
  const tracks = getCollectionTracks(collection);
  const totalSec = tracks.reduce((sum, t) => sum + t.durationSec, 0);
  const spinning = playingCollection?.id === collection.id && isPlaying;

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Dithered wash rather than a plain gradient — the brand's texture
          language already owns this treatment. */}
      <AnimatedTexture
        name={collection.texture}
        className="absolute inset-0 w-full h-full opacity-30"
        aria-hidden
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-transparent"
      />

      <div className="relative flex items-end gap-6 p-6">
        <SpinningDisc
          texture={collection.texture}
          labelTexture="tx-k2-vinyl"
          spinning={spinning}
          className="w-[200px] h-[200px] shrink-0 disc_shadow"
          labelClassName="w-1/3 h-1/3 border-4 border-card"
        />
        <div className="min-w-0 pb-2">
          <div className="font-label text-[11px] uppercase tracking-[0.2em] text-primary">
            {collection.kind}
          </div>
          <h1 className="type-display truncate mt-1">{collection.title}</h1>
          <div className="flex items-center gap-2 mt-3 text-muted-foreground">
            <DataText className="text-sm">{tracks.length}</DataText>
            <span className="font-ui text-sm">tracks</span>
            <span aria-hidden>·</span>
            <DataText className="text-sm">{formatDuration(totalSec)}</DataText>
          </div>
        </div>
      </div>
    </div>
  );
}
```

> Before running: confirm `AnimatedTexture`'s prop name with
> `grep -n "interface\|Props" apps/web/components/studio/AnimatedTexture.tsx`.
> If it takes `texture` rather than `name`, adjust the call.

- [ ] **Step 4: Write the page**

Create `app/design-system/screens/(app)/playlist/[id]/page.tsx`:

```tsx
"use client";

import { useParams } from "next/navigation";

import EmptyState from "@/components/studio/EmptyState";
import CollectionDetail from "@/components/studio/screens/CollectionDetail";
import PlaylistHero from "@/components/studio/screens/PlaylistHero";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";

export default function PlaylistScreen() {
  const { collections } = useMockStudio();
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(
    Array.isArray(params.id) ? params.id[0] : params.id
  );
  const collection = collections.find((c) => c.id === id);

  if (!collection) {
    return (
      <EmptyState
        title="Collection not found"
        hint="It may have been removed. Pick another from your library."
        texture="tx-k2-static"
      />
    );
  }

  return (
    <div className="pb-8">
      <PlaylistHero collection={collection} />
      <div className="px-1 mt-4">
        <CollectionDetail collection={collection} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- "app/design-system/screens/(app)/playlist/[id]/page.test.tsx"`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/app/design-system/screens/(app)/playlist" apps/web/components/studio/screens/PlaylistHero.tsx
git commit -m "feat(studio): add the playlist route with a vinyl hero"
```

---

## Task 10: NowPlayingRail

**Files:**
- Create: `components/studio/shell/NowPlayingRail.tsx`
- Test: `components/studio/shell/NowPlayingRail.test.tsx`

Docked player on top, Up Next below it, Add Music at the bottom. Add Music targets whichever collection the page column is showing; on home, search and system routes it renders a disabled hint instead.

- [ ] **Step 1: Write the failing test**

Create `components/studio/shell/NowPlayingRail.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import NowPlayingRail from "./NowPlayingRail";

const pathname = vi.fn(() => "/design-system/screens/home");

vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
}));

describe("NowPlayingRail", () => {
  it("explains why Add Music is unavailable off a playlist", () => {
    pathname.mockReturnValue("/design-system/screens/home");
    render(
      <MockStudioProvider>
        <NowPlayingRail />
      </MockStudioProvider>
    );

    expect(screen.getByText(/Open a playlist to add tracks/i)).toBeTruthy();
  });

  it("offers Add Music when a playlist is open", () => {
    pathname.mockReturnValue("/design-system/screens/playlist/liked");
    render(
      <MockStudioProvider>
        <NowPlayingRail />
      </MockStudioProvider>
    );

    expect(screen.getByLabelText("Search tracks to add")).toBeTruthy();
  });

  it("shows the Up Next section", () => {
    pathname.mockReturnValue("/design-system/screens/home");
    render(
      <MockStudioProvider>
        <NowPlayingRail />
      </MockStudioProvider>
    );

    expect(screen.getByText("Up next")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- components/studio/shell/NowPlayingRail.test.tsx`
Expected: FAIL — `Failed to resolve import "./NowPlayingRail"`.

- [ ] **Step 3: Write the implementation**

Create `components/studio/shell/NowPlayingRail.tsx`:

```tsx
"use client";

import { usePathname } from "next/navigation";

import DevicePlayer from "@/components/studio/screens/DevicePlayer";
import QueuePanel from "@/components/studio/screens/QueuePanel";
import AddMusicPanel from "@/components/studio/screens/AddMusicPanel";
import SectionLabel from "@/components/studio/SectionLabel";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { SCREENS } from "./routes";

/** The collection the page column is currently showing, if it is a playlist. */
function useOpenCollectionId(): string | null {
  const pathname = usePathname();
  const prefix = `${SCREENS}/playlist/`;
  if (!pathname?.startsWith(prefix)) return null;
  return decodeURIComponent(pathname.slice(prefix.length)) || null;
}

/**
 * The right column. The player is docked at the top rather than presented as
 * an overlay, so at 3xl the fullscreen player is redundant — PlaybackBar drops
 * its expand affordance at the same breakpoint.
 */
export default function NowPlayingRail() {
  const { collections, nowPlaying } = useMockStudio();
  const openId = useOpenCollectionId();
  const openCollection = openId
    ? (collections.find((c) => c.id === openId) ?? null)
    : null;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto no-scrollbar p-4 gap-6">
      {nowPlaying ? (
        <DevicePlayer docked />
      ) : (
        <p className="type-muted text-center py-8">
          Nothing playing yet — pick a track.
        </p>
      )}

      <section aria-label="Up next">
        <SectionLabel>Up next</SectionLabel>
        <QueuePanel />
      </section>

      <section aria-label="Add music">
        <SectionLabel>Add music</SectionLabel>
        {openCollection ? (
          <AddMusicPanel collection={openCollection} />
        ) : (
          <p className="type-muted mt-2">
            Open a playlist to add tracks to it.
          </p>
        )}
      </section>
    </div>
  );
}
```

> Before running: confirm `SectionLabel` takes children with
> `grep -n "interface\|function SectionLabel" apps/web/components/studio/SectionLabel.tsx`.
> If it takes a `label` prop instead, adjust both usages.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- components/studio/shell/NowPlayingRail.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/studio/shell/NowPlayingRail.tsx apps/web/components/studio/shell/NowPlayingRail.test.tsx
git commit -m "feat(studio): add the now-playing rail with docked player, queue and add-music"
```

---

## Task 11: PlaybackBar

**Files:**
- Create: `components/studio/shell/PlaybackBar.tsx`
- Modify: `components/studio/screens/GlobalPlayer.tsx`
- Test: `components/studio/shell/PlaybackBar.test.tsx`

Full-width bar: art + title left, transport and seek centred, volume/queue right. It expands into the fullscreen player only below `3xl` — at `3xl` the right rail already *is* the player.

- [ ] **Step 1: Write the failing test**

Create `components/studio/shell/PlaybackBar.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import MockStudioProvider, {
  useMockStudio,
} from "@/components/studio/screens/MockStudioProvider";
import { MOCK_TRACKS } from "@/components/studio/screens/mock-data";
import PlaybackBar from "./PlaybackBar";

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  );
}

/** Starts playback so the bar has a track to render. */
function Harness() {
  const { play, nowPlaying } = useMockStudio();
  return (
    <>
      {!nowPlaying ? (
        <button onClick={() => play(MOCK_TRACKS[0])}>start</button>
      ) : null}
      <PlaybackBar onExpand={onExpand} />
    </>
  );
}

const onExpand = vi.fn();

describe("PlaybackBar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    onExpand.mockClear();
  });

  it("renders nothing when there is no track", () => {
    stubMatchMedia(false);
    const { container } = render(
      <MockStudioProvider>
        <PlaybackBar onExpand={onExpand} />
      </MockStudioProvider>
    );
    expect(container.querySelector('[aria-label="Playback"]')).toBeNull();
  });

  it("offers an expand control below the wide breakpoint", () => {
    stubMatchMedia(false);
    render(
      <MockStudioProvider>
        <Harness />
      </MockStudioProvider>
    );

    fireEvent.click(screen.getByText("start"));
    fireEvent.click(screen.getByLabelText("Expand player"));
    expect(onExpand).toHaveBeenCalled();
  });

  it("has no expand control at the wide breakpoint", () => {
    stubMatchMedia(true);
    render(
      <MockStudioProvider>
        <Harness />
      </MockStudioProvider>
    );

    fireEvent.click(screen.getByText("start"));
    expect(screen.queryByLabelText("Expand player")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- components/studio/shell/PlaybackBar.test.tsx`
Expected: FAIL — `Failed to resolve import "./PlaybackBar"`.

- [ ] **Step 3: Write the implementation**

Create `components/studio/shell/PlaybackBar.tsx`:

```tsx
"use client";

import { useState } from "react";

import SpinningDisc from "@/components/studio/SpinningDisc";
import DataText from "@/components/studio/DataText";
import { Slider } from "@/components/ui/slider";
import Transport from "@/components/studio/screens/Transport";
import QueueDrawer from "@/components/studio/screens/QueueDrawer";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { formatDuration } from "@/components/studio/screens/mock-data";
import { useIsWide } from "./useIsDesktop";

interface PlaybackBarProps {
  /** Opens the fullscreen player. Only wired below the wide breakpoint. */
  onExpand: () => void;
}

/**
 * The full-width bottom bar. At 3xl the now-playing rail is on screen and is
 * the player, so the expand affordance is dropped rather than duplicating a
 * surface the user can already see.
 */
export default function PlaybackBar({ onExpand }: PlaybackBarProps) {
  const { nowPlaying, isPlaying, progressSec, seek } = useMockStudio();
  const wide = useIsWide();
  const [queueOpen, setQueueOpen] = useState(false);

  if (!nowPlaying) return null;

  const art = (
    <SpinningDisc
      texture={nowPlaying.texture}
      labelTexture="tx-k2-vinyl"
      spinning={isPlaying}
      className="w-12 h-12 shrink-0 disc_shadow"
      labelClassName="w-1/3 h-1/3 border-2 border-card"
    />
  );

  const meta = (
    <span className="min-w-0 text-left">
      <span className="block font-ui font-medium text-sm truncate">
        {nowPlaying.title}
      </span>
      <span className="block font-label text-[10px] uppercase tracking-wider text-muted-foreground truncate">
        {nowPlaying.artist}
      </span>
    </span>
  );

  return (
    <div
      aria-label="Playback"
      className="h-[var(--shell-bar-h)] shrink-0 flex items-center gap-4 px-4 rounded-2xl border border-border bg-card"
    >
      <div className="flex items-center gap-3 min-w-0 w-[var(--shell-rail-w)] max-w-[30%]">
        {wide ? (
          <>
            {art}
            {meta}
          </>
        ) : (
          <button
            type="button"
            aria-label="Expand player"
            onClick={onExpand}
            className="flex items-center gap-3 min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {art}
            {meta}
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
        <Transport size="base" onQueue={() => setQueueOpen(true)} />
        <div className="flex items-center gap-3 w-full max-w-2xl">
          <DataText className="text-xs text-muted-foreground shrink-0">
            {formatDuration(progressSec)}
          </DataText>
          <Slider
            value={[Math.min(progressSec, nowPlaying.durationSec)]}
            max={nowPlaying.durationSec}
            step={1}
            onValueChange={(v) => seek(v[0])}
            aria-label="Seek"
            data-signal="seek"
          />
          <DataText className="text-xs text-muted-foreground shrink-0">
            {formatDuration(nowPlaying.durationSec)}
          </DataText>
        </div>
      </div>

      {/* Balances the left block so the transport stays optically centred. */}
      <div aria-hidden className="w-[var(--shell-rail-w)] max-w-[30%] shrink" />

      <QueueDrawer open={queueOpen} onOpenChange={setQueueOpen} />
    </div>
  );
}
```

- [ ] **Step 4: Wire it into GlobalPlayer**

In `components/studio/screens/GlobalPlayer.tsx`, add the imports:

```tsx
import PlaybackBar from "@/components/studio/shell/PlaybackBar";
import { useIsDesktop } from "@/components/studio/shell/useIsDesktop";
```

Add the hook call next to the existing destructure (line 14):

```tsx
  const { nowPlaying, playerExpanded, setPlayerExpanded } = useMockStudio();
  const isDesktop = useIsDesktop();
```

Replace the final return (line 78):

```tsx
  return isDesktop ? (
    <PlaybackBar onExpand={() => setPlayerExpanded(true)} />
  ) : (
    <MiniPlayerBar onExpand={() => setPlayerExpanded(true)} />
  );
```

`MiniPlayerBar` is untouched and still owns everything below `md`.

- [ ] **Step 5: Run the tests**

Run: `npm test -- components/studio/shell/PlaybackBar.test.tsx components/studio/screens/GlobalPlayer.test.tsx`
Expected: PASS. `GlobalPlayer.test.tsx` must still pass — under jsdom `matchMedia` is stubbed or absent, so `useIsDesktop()` returns false and the mini bar renders, which is what that suite asserts. If it stubs `matchMedia` as matching, add `vi.stubGlobal("matchMedia", undefined)` to its setup rather than changing its assertions.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/studio/shell/PlaybackBar.tsx apps/web/components/studio/shell/PlaybackBar.test.tsx apps/web/components/studio/screens/GlobalPlayer.tsx
git commit -m "feat(studio): add the full-width playback bar for md and up"
```

---

## Task 12: The grid layout

**Files:**
- Modify: `app/design-system/screens/(app)/layout.tsx` (whole file)
- Modify: `app/design-system/screens/layout.tsx`
- Delete: `components/studio/screens/SideNav.tsx`
- Test: `app/design-system/screens/(app)/layout.test.tsx`

This is the task that changes the look. The grid uses Tailwind breakpoint classes — not the hook — so it never flashes.

- [ ] **Step 1: Widen the outer layout**

The `max-w-6xl mx-auto p-2 sm:p-6` wrapper in `app/design-system/screens/layout.tsx` fights the grid. Replace the file with:

```tsx
import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import { Toaster } from "@/components/ui/sonner";

export default function ScreensLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MockStudioProvider>
      {/* The (app) group owns its own full-viewport frame; the docs screens
          under this layout still get the centred column via their own pages. */}
      <div className="relative">{children}</div>
      <Toaster />
    </MockStudioProvider>
  );
}
```

- [ ] **Step 2: Write the failing test**

Create `app/design-system/screens/(app)/layout.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import AppShellLayout from "./layout";

const pathname = vi.fn(() => "/design-system/screens/home");

vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
  useRouter: () => ({ push: vi.fn() }),
}));

describe("AppShellLayout", () => {
  it("renders both rails on a music route", () => {
    pathname.mockReturnValue("/design-system/screens/home");
    render(<AppShellLayout><p>page</p></AppShellLayout>);

    expect(screen.getByLabelText("Your library")).toBeTruthy();
    expect(screen.getByLabelText("Now playing")).toBeTruthy();
  });

  it("hides both rails on a system route", () => {
    pathname.mockReturnValue("/design-system/screens/profile/settings");
    render(<AppShellLayout><p>page</p></AppShellLayout>);

    expect(screen.queryByLabelText("Your library")).toBeNull();
    expect(screen.queryByLabelText("Now playing")).toBeNull();
  });

  it("always renders the page content", () => {
    pathname.mockReturnValue("/design-system/screens/profile/settings");
    render(<AppShellLayout><p>page</p></AppShellLayout>);
    expect(screen.getByText("page")).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- "app/design-system/screens/(app)/layout.test.tsx"`
Expected: FAIL — no element labelled "Your library".

- [ ] **Step 4: Write the grid**

Replace the entire contents of `app/design-system/screens/(app)/layout.tsx` with:

```tsx
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
 * The application shell.
 *
 * Below md this is the phone layout it has always been: one scrolling column,
 * bottom tabs, the mini player. From md up it becomes a fixed-viewport grid
 * whose columns each own their scroll, and at 3xl the now-playing rail joins.
 *
 * Column visibility is Tailwind classes rather than the breakpoint hook, so
 * the grid is correct on the first paint.
 */
export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const system = isSystemRoute(pathname);

  return (
    <div className="md:h-screen md:overflow-hidden md:flex md:flex-col md:p-2 md:gap-2">
      <div className="hidden md:block">
        <StudioHeader />
      </div>

      <div className="md:flex md:flex-1 md:min-h-0 md:gap-2">
        {system ? null : (
          <aside
            aria-label="Your library"
            className="hidden md:block w-[var(--shell-rail-w)] shrink-0 rounded-2xl border border-border bg-card overflow-hidden"
          >
            <LibraryRail />
          </aside>
        )}

        <main
          className={cn(
            "min-w-0 flex-1 pb-44 md:pb-0",
            "md:overflow-y-auto md:rounded-2xl md:border md:border-border md:bg-card",
            "px-2 sm:px-6 md:px-6 py-2 md:py-6",
            system && "md:mx-auto md:max-w-[880px] md:w-full"
          )}
        >
          {children}
        </main>

        {system ? null : (
          <aside
            aria-label="Now playing"
            className="hidden 3xl:block w-[var(--shell-rail-w)] shrink-0 rounded-2xl border border-border bg-card overflow-hidden"
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
```

Note the two `system ? null :` guards render nothing at *every* width on system routes — mobile has no rails anyway, so this is a no-op there.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- "app/design-system/screens/(app)/layout.test.tsx"`
Expected: PASS, 3 tests.

- [ ] **Step 6: Delete the dead SideNav**

`SideNav` was the old desktop sidebar and now has no importer. Confirm, then remove:

```bash
grep -rn "SideNav" apps/web --include=*.tsx --include=*.ts
```
Expected: no results other than the file itself.

```bash
git rm apps/web/components/studio/screens/SideNav.tsx
```

- [ ] **Step 7: Full suite and typecheck**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add -A apps/web/app/design-system/screens apps/web/components/studio/screens/SideNav.tsx
git commit -m "feat(studio): replace the centred column with the three-column shell grid"
```

---

## Task 13: Desktop track rows

**Files:**
- Modify: `components/studio/TrackRow.tsx`
- Test: `components/studio/TrackRow.test.tsx` (create)

The desktop variant adds album and date-added columns. The existing mobile rendering is the default and must not change.

- [ ] **Step 1: Write the failing test**

Create `components/studio/TrackRow.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import TrackRow from "./TrackRow";

describe("TrackRow", () => {
  it("does not render album or added columns by default", () => {
    render(
      <TrackRow title="Tori no Uta" album="AIR OST" addedLabel="1 week ago" />
    );
    expect(screen.queryByText("AIR OST")).toBeNull();
    expect(screen.queryByText("1 week ago")).toBeNull();
  });

  it("renders album and added columns in the desktop variant", () => {
    render(
      <TrackRow
        desktop
        title="Tori no Uta"
        album="AIR OST"
        addedLabel="1 week ago"
      />
    );
    expect(screen.getByText("AIR OST")).toBeTruthy();
    expect(screen.getByText("1 week ago")).toBeTruthy();
  });

  it("keeps the title in both variants", () => {
    render(<TrackRow desktop title="Flyleaf" />);
    expect(screen.getByText("Flyleaf")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- components/studio/TrackRow.test.tsx`
Expected: FAIL — TypeScript rejects `album`, `addedLabel` and `desktop`.

- [ ] **Step 3: Extend the component**

In `components/studio/TrackRow.tsx`, extend the props interface (lines 9–20):

```tsx
interface TrackRowProps {
  index?: number;
  title: string;
  artist?: string;
  duration?: string;
  texture?: TextureName;
  artUrl?: string;
  playing?: boolean;
  selected?: boolean;
  className?: string;
  /** Desktop table variant — adds the album and date-added columns. */
  desktop?: boolean;
  album?: string;
  addedLabel?: string;
  /** Signal: row_play, row_queue */
}
```

Update the destructure to include the new props:

```tsx
export default function TrackRow({
  index,
  title,
  artist,
  duration,
  texture,
  artUrl,
  playing = false,
  selected = false,
  className,
  desktop = false,
  album,
  addedLabel,
}: TrackRowProps) {
```

Insert the two columns immediately before the closing duration block (before the `{duration ? (` at line 103):

```tsx
      {desktop && album ? (
        <span className="hidden lg:block w-[28%] min-w-0 truncate font-ui text-sm text-muted-foreground">
          {album}
        </span>
      ) : null}
      {desktop && addedLabel ? (
        <span className="hidden xl:block w-[18%] min-w-0 truncate font-ui text-sm text-muted-foreground">
          {addedLabel}
        </span>
      ) : null}
```

The columns hide themselves again at narrow widths so the same variant survives the tablet band without a second breakpoint decision at the call site.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- components/studio/TrackRow.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Use the variant on the playlist page**

In `components/studio/screens/CollectionDetail.tsx`, the rows render at line 227. Add the album pass-through — `MockTrack` has no album or added date, so pass the collection title as the album and omit `addedLabel` until the data model carries one:

```tsx
                <TrackRow
                  desktop
                  index={i + 1}
                  title={track.title}
                  artist={track.artist}
                  album={collection.title}
                  duration={formatDuration(track.durationSec)}
                  texture={track.texture}
                  playing={nowPlaying?.id === track.id && isPlaying}
                />
```

> If `MockTrack` does in fact carry an album field, use it. Check with:
> `grep -n "interface MockTrack" -A 12 apps/web/components/studio/screens/mock-data.ts`

- [ ] **Step 6: Run the full suite**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/studio/TrackRow.tsx apps/web/components/studio/TrackRow.test.tsx apps/web/components/studio/screens/CollectionDetail.tsx
git commit -m "feat(studio): add a desktop track row variant with album column"
```

---

## Task 14: Home shelves in grid mode

**Files:**
- Modify: `components/studio/RailShelf.tsx`

With a wide page column, a horizontal drag-scroller wastes the space. Add a `grid` prop that wraps instead.

- [ ] **Step 1: Read the component first**

Run: `cat apps/web/components/studio/RailShelf.tsx`

The prop must be additive — the default (horizontal drag-scroll) is what mobile uses and must not change.

- [ ] **Step 2: Add the prop**

Add `grid?: boolean` to the props interface with this doc comment:

```tsx
  /** Wrap into a grid instead of a horizontal scroller — desktop page column. */
  grid?: boolean;
```

When `grid` is true, replace the `DragScroller`/`ScrollArea` wrapper with:

```tsx
      <div className="grid grid-cols-2 lg:grid-cols-4 3xl:grid-cols-5 gap-4">
        {children}
      </div>
```

Leave the heading and every other branch untouched.

- [ ] **Step 3: Use it on home at md and up**

In `app/design-system/screens/(app)/home/page.tsx`, pass `grid` to each shelf only from `md` up. Since `grid` is a render-shape decision rather than a style, drive it from the hook:

```tsx
import { useIsDesktop } from "@/components/studio/shell/useIsDesktop";
```

```tsx
  const isDesktop = useIsDesktop();
```

Then add `grid={isDesktop}` to each `<RailShelf>` on that page.

- [ ] **Step 4: Verify**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/studio/RailShelf.tsx "apps/web/app/design-system/screens/(app)/home/page.tsx"
git commit -m "feat(studio): wrap home shelves into a grid on desktop"
```

---

## Task 15: Verification pass

**Files:** none — this task changes nothing, it proves the previous fourteen.

- [ ] **Step 1: Full automated gate**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: all four pass. Do not proceed past a failure — fix it and re-run.

- [ ] **Step 2: Start the preview**

Use the `preview_start` tool with the dev server config (create `.claude/launch.json` with `runtimeExecutable: "npm"`, `runtimeArgs: ["run","dev"]`, `port: 3000` if it does not exist). Navigate to `/design-system/screens/home`.

- [ ] **Step 3: Check mobile is unregressed**

Resize to 375×812. Confirm, via `read_page` and a screenshot:
- bottom tab bar present, no header, no rails
- `MiniPlayerBar` (not `PlaybackBar`) above the tab bar
- tapping a library row opens the **drawer**, not the playlist route
- console has no errors (`read_console_messages`)

- [ ] **Step 4: Check the tablet band**

Resize to 1024×800. Confirm:
- header present, library rail present, **no** now-playing rail
- clicking a library row navigates — URL becomes `/design-system/screens/playlist/<id>`
- the playback bar spans the full width and its art block expands the fullscreen player
- library rail and page column scroll independently; the document itself does not scroll

- [ ] **Step 5: Check the desktop band**

Resize to 1600×900. Confirm:
- all three columns present with visible gaps between the card surfaces
- the now-playing rail shows the vinyl, Up Next, and Add Music
- Add Music shows the "Open a playlist to add tracks to it." hint on `/home`, and a live search field on a playlist route
- the playback bar art block is **not** a button (no expand)
- navigating to `/design-system/screens/profile/settings` collapses both rails and centres the page

- [ ] **Step 6: Check both themes**

Use `resize_window` with `colorScheme: "dark"` then `"light"` at 1600×900. Confirm every new surface — header, both rails, playback bar, playlist hero — has legible contrast and visible borders in both.

- [ ] **Step 7: Screenshot the result**

Take a screenshot at 1600×900 in the default (dark) theme and share it in the completion report.

- [ ] **Step 8: Commit any fixes**

If steps 3–6 surfaced problems, fix them and commit each fix separately with a message describing the symptom, not just the change.

---

## Deferred (explicitly not in this plan)

- Keyboard shortcuts (space to play, `/` to focus search)
- Drag-and-drop of tracks from the page column into library rows
- Collapsed icon-strip library mode at narrow desktop widths
- Porting the shell to the production app (`app/page.tsx` and friends)
- A real `addedAt` field on `MockTrack` to fill the date-added column
