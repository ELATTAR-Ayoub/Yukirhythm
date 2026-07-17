# Screens IA Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `/design-system/screens/*` mock previews as a four-section app (Home, Search, Library, Profile hub + subpages) with one merged social-only auth screen and a global compressed/expanded player.

**Architecture:** A Next.js route group `(app)` under `screens/` provides the AppShell (desktop SideNav, mobile BottomTabBar, GlobalPlayer). All state stays in `MockStudioProvider` (session, player, library slices) driven by an extended `mock-data.ts`. Drawers and the expanded player are in-page states, not routes. Every new component is registered in a categorized `/design-system/components` gallery.

**Tech Stack:** Next.js App Router, Tailwind + studio tokens (`type-*`, `font-label`, `bg-cobalt`…), shadcn/ui primitives, vaul drawers, vitest + @testing-library/react (jsdom, fake timers).

**Spec:** `docs/superpowers/specs/2026-07-18-screens-ia-restructure-design.md`
**Working directory for all commands:** `apps/web` inside the `design-studio` worktree (branch `v2-design-studio`).
**Test command:** `npm run test -- <pattern>` (vitest run). Lint: `npm run lint`.

**Notes for the implementer:**
- Reuse, don't rebuild: `MediaCard` (boxy = CollectionCard, extended = CollectionListRow), `RailShelf` (= ShelfRow), `TrackRow`, `EmptyState`, `PlayerButton`, `Transport`, `AuroraBackground`, `Texture`, `DataText`, `Avatar`, vaul `Drawer`.
- `public/svgs/facebook.svg`, `google.svg`, `logo_light.svg` already exist.
- No `@testing-library/user-event` installed — use `fireEvent`.
- No shadcn Switch installed — Task 6 builds a tiny `ToggleSwitch` (no new deps).
- vaul provides the spring drawer physics natively; the jelly keyframes in Task 3 cover the expanded player.
- `BASE = "/design-system/screens"` — every internal link uses it.

---

## File structure

```
apps/web/components/studio/screens/
  mock-data.ts                (extend)   mock-data.test.ts        (new)
  library-utils.ts            (new)      library-utils.test.ts    (new)
  MockStudioProvider.tsx      (extend)   MockStudioProvider.test.tsx (extend)
  AppDrawer.tsx  PageHeader.tsx  BottomTabBar.tsx  SideNav.tsx        (new)
  DevicePlayer.tsx  MiniPlayerBar.tsx  GlobalPlayer.tsx (+test)       (new)
  TagChip.tsx  ViewToggle.tsx  SortControl.tsx  TrackMenu.tsx         (new)
  MenuList.tsx  StatCard.tsx  ProfileBadge.tsx  BackHeader.tsx        (new)
  ToggleSwitch.tsx  SocialAuthButtons.tsx  SignInPrompt.tsx           (new)
  PlaylistDrawer.tsx  CreatePlaylistDrawer.tsx                        (new)
  NowPlayingBar.tsx  PreviewChrome.tsx  PreviewMenu.tsx               (DELETE in Task 13)

apps/web/app/design-system/screens/
  layout.tsx                  (modify: provider + Toaster only)
  page.tsx                    (modify: new index cards)
  (app)/layout.tsx            (new: AppShell)
  (app)/home/page.tsx         (moved + rewritten)
  (app)/search/page.tsx       (new)
  (app)/library/page.tsx      (new, + test)
  (app)/profile/page.tsx      (moved + rewritten: hub)
  (app)/profile/{view,stats,recents,settings,privacy}/page.tsx (new)
  auth/page.tsx               (new, + test)   login/ signup/   (DELETE)
  credits/page.tsx            (untouched)

apps/web/app/design-system/components/
  page.tsx                    (rewrite: category index)
  core/page.tsx               (old gallery content moved here)
  {shell,player,content,drawers,profile}/page.tsx (new category pages)

apps/web/app/globals.css      (append jelly/fade keyframes)
```

---

### Task 1: Extend mock data

**Files:**
- Modify: `apps/web/components/studio/screens/mock-data.ts`
- Test: `apps/web/components/studio/screens/mock-data.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `mock-data.test.ts`:

```tsx
import { describe, it, expect } from "vitest";
import {
  LIKED_SONGS,
  MOCK_COLLECTIONS,
  MOCK_HISTORY,
  getCollectionTracks,
  getTrack,
  recentCollections,
  searchMockCollections,
} from "./mock-data";

describe("mock-data helpers", () => {
  it("resolves collection tracks and drops unknown ids", () => {
    const tracks = getCollectionTracks({ ...LIKED_SONGS, trackIds: ["t1", "nope", "t3"] });
    expect(tracks.map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  it("finds a track by id", () => {
    expect(getTrack("t1")?.title).toBe("Midnight Snowfall");
    expect(getTrack("nope")).toBeUndefined();
  });

  it("searches collections by title and tag, case-insensitive", () => {
    expect(searchMockCollections("PIXEL").map((c) => c.id)).toContain("c3");
    expect(searchMockCollections("lofi").map((c) => c.id)).toContain("c1");
    expect(searchMockCollections("")).toEqual([]);
  });

  it("dedupes recent collections preserving history order", () => {
    const all = [LIKED_SONGS, ...MOCK_COLLECTIONS];
    const recents = recentCollections(MOCK_HISTORY, all);
    const ids = recents.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe(MOCK_HISTORY[0].collectionId);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- mock-data`
Expected: FAIL — `LIKED_SONGS`, `getTrack`, etc. not exported.

- [ ] **Step 3: Implement the data extensions**

In `mock-data.ts`:

3a. Extend `MockCollection` (kind + pinned are REQUIRED fields):

```ts
export type CollectionKind = "music" | "podcast";

export interface MockCollection {
  id: string;
  title: string;
  desc: string;
  texture: TextureName;
  trackIds: string[];
  likes: number;
  tags: string[];
  kind: CollectionKind;
  pinned: boolean;
}
```

3b. Add `kind`/`pinned` to every existing `MOCK_COLLECTIONS` entry — all `kind: "music", pinned: false` EXCEPT `c3` (Pixel Podcasts): `kind: "podcast"`. Append one more podcast so the Podcasts chip shows two rows:

```ts
  { id: "c7", title: "Night Static Radio", desc: "Late-night talk, tape hiss included.", texture: "tx-k2-ascii-eq", trackIds: ["t12", "t3", "t10"], likes: 204, tags: ["podcast", "night"], kind: "podcast", pinned: false },
```

3c. Add Liked Songs, history, stats, curated slices (after `MOCK_USER`):

```ts
export const LIKED_SONGS_ID = "liked";

/** Every user has this; pinned by default and surfaced first in the Library. */
export const LIKED_SONGS: MockCollection = {
  id: LIKED_SONGS_ID,
  title: "Liked Songs",
  desc: "Every track you've hearted.",
  texture: "tx-k-ripple",
  trackIds: ["t2", "t5", "t7", "t10", "t8"],
  likes: 0,
  tags: ["liked"],
  kind: "music",
  pinned: true,
};

export type HistoryGroup = "Today" | "Yesterday" | "This week";
export const HISTORY_GROUPS: HistoryGroup[] = ["Today", "Yesterday", "This week"];

export interface MockHistoryEntry {
  trackId: string;
  collectionId: string;
  group: HistoryGroup;
  timeLabel: string;
}

/** Static, deterministic listening history (newest first). */
export const MOCK_HISTORY: MockHistoryEntry[] = [
  { trackId: "t2", collectionId: "c2", group: "Today", timeLabel: "09:12" },
  { trackId: "t1", collectionId: "c1", group: "Today", timeLabel: "08:47" },
  { trackId: "t5", collectionId: LIKED_SONGS_ID, group: "Today", timeLabel: "08:02" },
  { trackId: "t3", collectionId: "c3", group: "Yesterday", timeLabel: "22:30" },
  { trackId: "t6", collectionId: "c2", group: "Yesterday", timeLabel: "18:15" },
  { trackId: "t7", collectionId: "c4", group: "Yesterday", timeLabel: "07:58" },
  { trackId: "t9", collectionId: "c6", group: "This week", timeLabel: "Tue" },
  { trackId: "t10", collectionId: "c5", group: "This week", timeLabel: "Tue" },
  { trackId: "t12", collectionId: "c7", group: "This week", timeLabel: "Mon" },
  { trackId: "t4", collectionId: "c1", group: "This week", timeLabel: "Mon" },
];

export interface MockStats {
  minutesWeek: number;
  minutesMonth: number;
  minutesAllTime: number;
  streakDays: number;
  topArtists: { name: string; plays: number }[];
  topTrackIds: string[];
  genreSplit: { name: string; pct: number }[];
  /** 24 values, 0..1 — relative listening intensity per hour. */
  byHour: number[];
}

export const MOCK_STATS: MockStats = {
  minutesWeek: 312,
  minutesMonth: 1489,
  minutesAllTime: 21437,
  streakDays: 9,
  topArtists: [
    { name: "Aoi Waves", plays: 84 },
    { name: "Yuki Sato", plays: 71 },
    { name: "Mint Circuit", plays: 56 },
    { name: "Nori", plays: 39 },
    { name: "8-Bit Monk", plays: 24 },
  ],
  topTrackIds: ["t2", "t8", "t1", "t7", "t10"],
  genreSplit: [
    { name: "Lo-fi", pct: 38 },
    { name: "Ambient", pct: 27 },
    { name: "Podcast", pct: 19 },
    { name: "Retro", pct: 16 },
  ],
  byHour: [0.05, 0.02, 0.01, 0.01, 0.02, 0.06, 0.2, 0.55, 0.7, 0.5, 0.35, 0.3, 0.4, 0.35, 0.3, 0.35, 0.45, 0.6, 0.8, 1, 0.9, 0.65, 0.35, 0.15],
};

export const NEW_RELEASE_IDS = ["t12", "t7", "t3", "t9", "t11", "t6"];
export const YOU_MIGHT_LIKE_IDS = ["t4", "t8", "t1", "t5", "t10"];

export const EXPLORE_TILES: { label: string; texture: TextureName }[] = [
  { label: "Lo-fi", texture: "tx-k2-topo" },
  { label: "Ambient", texture: "tx-k2-marble-dense" },
  { label: "Retro", texture: "tx-k2-checker" },
  { label: "Podcasts", texture: "tx-k2-static" },
  { label: "Night", texture: "tx-k-marble" },
  { label: "Focus", texture: "tx-k-silk" },
  { label: "Morning", texture: "tx-k2-horizon" },
  { label: "Glitch", texture: "tx-k-glitch" },
];

export function getTrack(id: string): MockTrack | undefined {
  return MOCK_TRACKS.find((t) => t.id === id);
}

export function getCollectionTracks(collection: MockCollection): MockTrack[] {
  return collection.trackIds
    .map(getTrack)
    .filter((t): t is MockTrack => t !== undefined);
}

export function searchMockCollections(query: string): MockCollection[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return MOCK_COLLECTIONS.filter(
    (c) =>
      c.title.toLowerCase().includes(q) ||
      c.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}

/** Collections behind the history entries, deduped, newest first. */
export function recentCollections(
  history: MockHistoryEntry[],
  collections: MockCollection[]
): MockCollection[] {
  const seen = new Set<string>();
  const out: MockCollection[] = [];
  for (const entry of history) {
    if (seen.has(entry.collectionId)) continue;
    seen.add(entry.collectionId);
    const col = collections.find((c) => c.id === entry.collectionId);
    if (col) out.push(col);
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- mock-data`
Expected: PASS (4 tests). Existing suites must still pass: `npm run test`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/studio/screens/mock-data.ts apps/web/components/studio/screens/mock-data.test.ts
git commit -m "feat(studio): extend mock data with library, history and stats"
```

---

### Task 2: Library helpers + provider slices

**Files:**
- Create: `apps/web/components/studio/screens/library-utils.ts`
- Test: `apps/web/components/studio/screens/library-utils.test.ts`
- Modify: `apps/web/components/studio/screens/MockStudioProvider.tsx`
- Test: `apps/web/components/studio/screens/MockStudioProvider.test.tsx`

- [ ] **Step 1: Write the failing library-utils tests**

Create `library-utils.test.ts`:

```tsx
import { describe, it, expect } from "vitest";
import { LIKED_SONGS, MOCK_COLLECTIONS, MOCK_TRACKS } from "./mock-data";
import { filterLibrary, sortTracks } from "./library-utils";

const ALL = [LIKED_SONGS, ...MOCK_COLLECTIONS];

describe("filterLibrary", () => {
  it("puts pinned collections first for the playlists filter", () => {
    const result = filterLibrary(ALL, "playlists");
    expect(result[0].id).toBe(LIKED_SONGS.id); // pinned by default
    expect(result.every((c) => c.kind === "music")).toBe(true);
  });

  it("shows only podcasts for the podcasts filter", () => {
    const result = filterLibrary(ALL, "podcasts");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((c) => c.kind === "podcast")).toBe(true);
  });

  it("shows only Liked Songs for the liked filter", () => {
    expect(filterLibrary(ALL, "liked").map((c) => c.id)).toEqual([LIKED_SONGS.id]);
  });
});

describe("sortTracks", () => {
  it("sorts alphabetically for alpha, keeps order for recent", () => {
    const alpha = sortTracks(MOCK_TRACKS, "alpha").map((t) => t.title);
    expect(alpha).toEqual([...alpha].sort((a, b) => a.localeCompare(b)));
    expect(sortTracks(MOCK_TRACKS, "recent")).toEqual(MOCK_TRACKS);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- library-utils`
Expected: FAIL — module `./library-utils` not found.

- [ ] **Step 3: Implement `library-utils.ts`**

```ts
import { LIKED_SONGS_ID, type MockCollection, type MockTrack } from "./mock-data";

export type LibraryFilter = "playlists" | "podcasts" | "liked";
export type TrackSort = "recent" | "alpha";

export const LIBRARY_FILTERS: { value: LibraryFilter; label: string }[] = [
  { value: "playlists", label: "Playlists" },
  { value: "podcasts", label: "Podcasts" },
  { value: "liked", label: "Liked Songs" },
];

/** Pinned first (stable), then the chip's slice of the library. */
export function filterLibrary(
  collections: MockCollection[],
  filter: LibraryFilter
): MockCollection[] {
  const pinnedFirst = [...collections].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned)
  );
  if (filter === "liked") return pinnedFirst.filter((c) => c.id === LIKED_SONGS_ID);
  if (filter === "podcasts") return pinnedFirst.filter((c) => c.kind === "podcast");
  return pinnedFirst.filter((c) => c.kind === "music");
}

/** "recent" = catalogue order (mock stand-in for added-at). */
export function sortTracks(tracks: MockTrack[], sort: TrackSort): MockTrack[] {
  if (sort === "alpha") {
    return [...tracks].sort((a, b) => a.title.localeCompare(b.title));
  }
  return tracks;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- library-utils`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing provider tests**

Append to the `describe` block in `MockStudioProvider.test.tsx` (and add `LIKED_SONGS` to the existing `./mock-data` import):

```tsx
  it("manages the library: pin, filter, create", () => {
    const { result } = renderHook(() => useMockStudio(), { wrapper });

    expect(result.current.collections[0].id).toBe(LIKED_SONGS.id);
    expect(result.current.libraryFilter).toBe("playlists");

    act(() => result.current.togglePin("c1"));
    expect(result.current.collections.find((c) => c.id === "c1")?.pinned).toBe(true);

    act(() => result.current.setLibraryFilter("podcasts"));
    expect(result.current.libraryFilter).toBe("podcasts");

    const before = result.current.collections.length;
    act(() =>
      result.current.createCollection({
        title: "Rainy Tapes",
        desc: "Tape loops for rain.",
        tags: ["rain"],
        kind: "music",
      })
    );
    expect(result.current.collections).toHaveLength(before + 1);
    expect(result.current.collections.at(-1)?.title).toBe("Rainy Tapes");
    expect(result.current.collections.at(-1)?.pinned).toBe(false);
  });

  it("expands and collapses the player", () => {
    const { result } = renderHook(() => useMockStudio(), { wrapper });

    expect(result.current.playerExpanded).toBe(false);
    act(() => result.current.setPlayerExpanded(true));
    expect(result.current.playerExpanded).toBe(true);
    act(() => result.current.setPlayerExpanded(false));
    expect(result.current.playerExpanded).toBe(false);
  });
```

- [ ] **Step 6: Run to verify failure**

Run: `npm run test -- MockStudioProvider`
Expected: FAIL — `collections`, `togglePin`, etc. undefined.

- [ ] **Step 7: Extend `MockStudioProvider.tsx`**

7a. Extend imports:

```ts
import {
  LIKED_SONGS,
  MOCK_COLLECTIONS,
  MOCK_TRACKS,
  MOCK_USER,
  searchMockTracks,
  type CollectionKind,
  type MockCollection,
  type MockTrack,
  type MockUser,
} from "./mock-data";
import type { LibraryFilter } from "./library-utils";
```

7b. Add to `MockStudioValue` (after the `search` group):

```ts
  // library
  collections: MockCollection[];
  libraryFilter: LibraryFilter;
  setLibraryFilter: (filter: LibraryFilter) => void;
  togglePin: (id: string) => void;
  createCollection: (input: {
    title: string;
    desc: string;
    tags: string[];
    kind: CollectionKind;
  }) => void;
  // player surface
  playerExpanded: boolean;
  setPlayerExpanded: (open: boolean) => void;
```

7c. Add state + callbacks inside the component (after the search state):

```ts
  const [collections, setCollections] = useState<MockCollection[]>([
    LIKED_SONGS,
    ...MOCK_COLLECTIONS,
  ]);
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("playlists");
  const [playerExpanded, setPlayerExpanded] = useState(false);

  const togglePin = useCallback((id: string) => {
    setCollections((cs) =>
      cs.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
    );
  }, []);

  const createCollection = useCallback(
    (input: { title: string; desc: string; tags: string[]; kind: CollectionKind }) => {
      setCollections((cs) => [
        ...cs,
        {
          id: `local-${cs.length + 1}`,
          title: input.title,
          desc: input.desc,
          texture: "tx-k-silk",
          trackIds: [],
          likes: 0,
          tags: input.tags,
          kind: input.kind,
          pinned: false,
        },
      ]);
    },
    []
  );
```

7d. Add all seven new fields (`collections`, `libraryFilter`, `setLibraryFilter`, `togglePin`, `createCollection`, `playerExpanded`, `setPlayerExpanded`) to the `value` object.

- [ ] **Step 8: Run to verify pass**

Run: `npm run test -- MockStudioProvider`
Expected: PASS (5 tests).

- [ ] **Step 9: Commit**

```bash
git add apps/web/components/studio/screens/library-utils.ts apps/web/components/studio/screens/library-utils.test.ts apps/web/components/studio/screens/MockStudioProvider.tsx apps/web/components/studio/screens/MockStudioProvider.test.tsx
git commit -m "feat(studio): library and player-surface slices in mock provider"
```

---

### Task 3: Motion utilities + AppDrawer base

**Files:**
- Modify: `apps/web/app/globals.css` (append at end)
- Create: `apps/web/components/studio/screens/AppDrawer.tsx`

- [ ] **Step 1: Append motion utilities to `globals.css`**

```css
/* ── Screens IA: jelly motion ─────────────────────────────── */
@keyframes jelly-in {
  0% { opacity: 0; transform: scale(0.92) translateY(24px); }
  60% { opacity: 1; transform: scale(1.02) translateY(-4px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
.anim-jelly-in {
  animation: jelly-in 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes screens-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.anim-fade-in {
  animation: screens-fade-in 200ms ease-out both;
}
@media (prefers-reduced-motion: reduce) {
  .anim-jelly-in,
  .anim-fade-in {
    animation: screens-fade-in 150ms ease-out both;
  }
}
```

- [ ] **Step 2: Create `AppDrawer.tsx`**

vaul already animates with spring physics; this wrapper standardizes the tall-sheet shape.

```tsx
"use client";

import { Drawer, DrawerContent } from "@/components/ui/drawer";

interface AppDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tall sheet (playlist detail) vs slightly shorter (forms). */
  height?: "95vh" | "90vh";
  children: React.ReactNode;
}

/** The one drawer surface every screens flow uses — 90/95vh, spring by vaul. */
export default function AppDrawer({
  open,
  onOpenChange,
  height = "95vh",
  children,
}: AppDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={height === "95vh" ? "h-[95vh]" : "h-[90vh]"}>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-10 pt-2">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
```

- [ ] **Step 3: Verify build health**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/globals.css apps/web/components/studio/screens/AppDrawer.tsx
git commit -m "feat(studio): jelly motion utilities and AppDrawer base"
```

---

### Task 4: Shell components + route group layout

**Files:**
- Create: `apps/web/components/studio/screens/PageHeader.tsx`
- Create: `apps/web/components/studio/screens/BottomTabBar.tsx`
- Create: `apps/web/components/studio/screens/SideNav.tsx`
- Create: `apps/web/app/design-system/screens/(app)/layout.tsx`
- Modify: `apps/web/app/design-system/screens/layout.tsx`

Note: `GlobalPlayer` is added to the `(app)` layout in Task 5 — this task's layout ships without it so each commit builds.

- [ ] **Step 1: Create `PageHeader.tsx`**

```tsx
"use client";

import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useMockStudio } from "./MockStudioProvider";

const BASE = "/design-system/screens";

interface PageHeaderProps {
  title: string;
  /** Ghost icon buttons, right-aligned. */
  actions?: React.ReactNode;
}

/**
 * Shared screen header — avatar + title left, ghost controls right.
 * The avatar is the mobile way into Profile (desktop uses the SideNav footer),
 * so it hides at md+.
 */
export default function PageHeader({ title, actions }: PageHeaderProps) {
  const { user } = useMockStudio();
  return (
    <header className="flex items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href={user ? `${BASE}/profile` : `${BASE}/auth`}
          aria-label={user ? "Open profile" : "Sign in"}
          className="md:hidden click-spring rounded-full shrink-0"
        >
          <Avatar className="border border-border">
            <AvatarFallback className="bg-cobalt text-snow font-ui text-sm">
              {user ? user.initials : "?"}
            </AvatarFallback>
          </Avatar>
        </Link>
        <h1 className="type-h1 truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-1 shrink-0">{actions}</div>
    </header>
  );
}
```

(If `click-spring` doesn't exist in globals.css, drop that class — `PreviewMenu.tsx` uses it today, so it should.)

- [ ] **Step 2: Create `BottomTabBar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  MagnifyingGlassIcon,
  StackIcon,
} from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";

const BASE = "/design-system/screens";

const TABS = [
  { href: `${BASE}/home`, label: "Home", icon: HomeIcon },
  { href: `${BASE}/search`, label: "Search", icon: MagnifyingGlassIcon },
  { href: `${BASE}/library`, label: "Library", icon: StackIcon },
];

/** Mobile-only bottom navigation — Profile lives behind the header avatar. */
export default function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 md:hidden border-t border-border bg-card/95 backdrop-blur"
    >
      <div className="flex">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-2.5",
                "font-label text-[10px] uppercase tracking-wider transition-colors duration-fast",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Create `SideNav.tsx`**

```tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  MagnifyingGlassIcon,
  StackIcon,
} from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useMockStudio } from "./MockStudioProvider";

const BASE = "/design-system/screens";

const ITEMS = [
  { href: `${BASE}/home`, label: "Home", icon: HomeIcon },
  { href: `${BASE}/search`, label: "Search", icon: MagnifyingGlassIcon },
  { href: `${BASE}/library`, label: "Library", icon: StackIcon },
];

/** Desktop-only sidebar — nav on top, the avatar footer opens Profile. */
export default function SideNav() {
  const pathname = usePathname();
  const { user } = useMockStudio();
  return (
    <aside className="hidden md:flex sticky top-24 self-start w-52 shrink-0 flex-col gap-1 h-[calc(100vh-12rem)] min-h-[24rem]">
      <Link href={`${BASE}/home`} className="flex items-center gap-2 px-3 py-2 mb-3">
        <Image
          src="/svgs/logo_light.svg"
          width={20}
          height={20}
          alt="Yukirhythm"
          className="h-5 w-auto object-contain"
        />
        <span className="font-display font-bold tracking-tight">Yukirhythm</span>
      </Link>
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md font-ui text-sm",
              "transition-colors duration-fast hover:bg-secondary",
              active ? "bg-secondary text-primary font-medium" : "text-muted-foreground"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        );
      })}
      <Link
        href={user ? `${BASE}/profile` : `${BASE}/auth`}
        className="mt-auto flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary transition-colors duration-fast"
      >
        <Avatar className="w-8 h-8 border border-border">
          <AvatarFallback className="bg-cobalt text-snow font-ui text-xs">
            {user ? user.initials : "?"}
          </AvatarFallback>
        </Avatar>
        <span className="font-ui text-sm truncate">
          {user ? user.userName : "Sign in"}
        </span>
      </Link>
    </aside>
  );
}
```

- [ ] **Step 4: Create the `(app)` route-group layout**

`apps/web/app/design-system/screens/(app)/layout.tsx`:

```tsx
import SideNav from "@/components/studio/screens/SideNav";
import BottomTabBar from "@/components/studio/screens/BottomTabBar";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="md:flex md:items-start md:gap-8">
      <SideNav />
      <main className="min-w-0 flex-1 pb-44 md:pb-32">{children}</main>
      <BottomTabBar />
    </div>
  );
}
```

- [ ] **Step 5: Slim the screens layout to provider + toasts**

Replace `apps/web/app/design-system/screens/layout.tsx` with:

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
      <div className="relative">{children}</div>
      <Toaster />
    </MockStudioProvider>
  );
}
```

(`PreviewChrome` is no longer referenced; its files are deleted in Task 13 after the screens that replace it land.)

- [ ] **Step 6: Move the existing screens into the group**

```bash
git mv "apps/web/app/design-system/screens/home" "apps/web/app/design-system/screens/(app)/home"
git mv "apps/web/app/design-system/screens/profile" "apps/web/app/design-system/screens/(app)/profile"
```

URLs stay `/design-system/screens/home` etc. — route groups don't affect paths.

- [ ] **Step 7: Verify**

Run: `npm run lint` then `npm run test`
Expected: clean lint, all suites pass. Manually: `/design-system/screens/home` shows sidebar (desktop) / tab bar (mobile).

- [ ] **Step 8: Commit**

```bash
git add -A apps/web/app/design-system/screens apps/web/components/studio/screens
git commit -m "feat(studio): app shell — PageHeader, BottomTabBar, SideNav, (app) route group"
```

---

### Task 5: Global player — DevicePlayer, MiniPlayerBar, GlobalPlayer

**Files:**
- Create: `apps/web/components/studio/screens/DevicePlayer.tsx`
- Create: `apps/web/components/studio/screens/MiniPlayerBar.tsx`
- Create: `apps/web/components/studio/screens/GlobalPlayer.tsx`
- Test: `apps/web/components/studio/screens/GlobalPlayer.test.tsx`
- Modify: `apps/web/app/design-system/screens/(app)/layout.tsx`

- [ ] **Step 1: Write the failing test**

Create `GlobalPlayer.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider, { useMockStudio } from "./MockStudioProvider";
import GlobalPlayer from "./GlobalPlayer";
import { MOCK_TRACKS } from "./mock-data";

function PlayFirst() {
  const { play } = useMockStudio();
  return <button onClick={() => play(MOCK_TRACKS[0])}>seed</button>;
}

describe("GlobalPlayer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders nothing until a track plays, then expands and collapses", () => {
    render(
      <MockStudioProvider>
        <PlayFirst />
        <GlobalPlayer />
      </MockStudioProvider>
    );

    expect(screen.queryByLabelText("Expand player")).toBeNull();

    fireEvent.click(screen.getByText("seed"));
    act(() => vi.advanceTimersByTime(650));

    fireEvent.click(screen.getByLabelText("Expand player"));
    expect(screen.getByRole("dialog", { name: "Now playing" })).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Collapse player"));
    expect(screen.queryByRole("dialog", { name: "Now playing" })).toBeNull();
    expect(screen.getByLabelText("Expand player")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- GlobalPlayer`
Expected: FAIL — `./GlobalPlayer` not found.

- [ ] **Step 3: Create `DevicePlayer.tsx`**

The device card extracted from the old home screen (disc + titles + transport), minus the search form, plus a collapse control:

```tsx
"use client";

import { ChevronDownIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import Texture from "@/components/studio/Texture";
import DataText from "@/components/studio/DataText";
import { PlayerButton } from "@/components/studio/PlayerButton";
import Transport from "./Transport";
import { useMockStudio } from "./MockStudioProvider";
import { formatDuration } from "./mock-data";

interface DevicePlayerProps {
  onCollapse?: () => void;
}

/** The full device player — the app's signature surface, now a component. */
export default function DevicePlayer({ onCollapse }: DevicePlayerProps) {
  const { nowPlaying, isPlaying, progressSec } = useMockStudio();

  return (
    <section className="player_shadow bg-card relative w-full max-w-[320px] rounded-[42px] sm:rounded-[52px] p-6 sm:p-8 flex flex-col items-center gap-6">
      {onCollapse ? (
        <PlayerButton
          variant="ghost"
          size="sm"
          aria-label="Collapse player"
          onClick={onCollapse}
          className="absolute top-4 right-4"
        >
          <ChevronDownIcon />
        </PlayerButton>
      ) : null}

      <div className="relative w-52 h-52 flex items-center justify-center">
        <div
          className={cn(
            "relative w-52 h-52 rounded-full overflow-hidden disc_shadow",
            isPlaying && "animate-[spin_6s_linear_infinite]"
          )}
        >
          <Texture name="tx-k2-vinyl" className="absolute inset-0 w-full h-full" />
          <div className="absolute inset-0 m-auto w-16 h-16 rounded-full overflow-hidden border-4 border-card">
            {nowPlaying ? (
              <Texture name={nowPlaying.texture} className="w-full h-full" />
            ) : (
              <div className="w-full h-full bg-ink" />
            )}
          </div>
        </div>
      </div>

      <div className="text-center w-full">
        <div className="font-label text-[11px] uppercase tracking-[0.2em] text-primary truncate">
          {nowPlaying ? nowPlaying.artist : "Welcome!"}
        </div>
        <div className="font-ui font-semibold truncate mt-0.5">
          {nowPlaying ? nowPlaying.title : "Pick a track"}
        </div>
        {nowPlaying ? (
          <DataText className="text-xs text-muted-foreground mt-1 inline-block">
            {formatDuration(progressSec)} / {formatDuration(nowPlaying.durationSec)}
          </DataText>
        ) : null}
      </div>

      <Transport size="lg" />
    </section>
  );
}
```

If `PlayerButton` doesn't accept `className`, wrap it: `<span className="absolute top-4 right-4"><PlayerButton …/></span>`.

- [ ] **Step 4: Create `MiniPlayerBar.tsx`**

Adapted from `NowPlayingBar.tsx` — the whole info area is the expand trigger; sits above the mobile tab bar:

```tsx
"use client";

import Texture from "@/components/studio/Texture";
import DataText from "@/components/studio/DataText";
import { Slider } from "@/components/ui/slider";
import Transport from "./Transport";
import { useMockStudio } from "./MockStudioProvider";
import { formatDuration } from "./mock-data";

interface MiniPlayerBarProps {
  onExpand: () => void;
}

/** Compressed player — info left, controls right, tap to expand. */
export default function MiniPlayerBar({ onExpand }: MiniPlayerBarProps) {
  const { nowPlaying, progressSec, seek } = useMockStudio();
  if (!nowPlaying) return null;

  return (
    <div className="fixed inset-x-0 bottom-[4.25rem] md:bottom-4 z-30 flex justify-center px-4 pb-2 md:pb-0 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-3xl rounded-lg border border-border bg-card shadow-e3 px-4 py-3 flex items-center gap-4">
        <button
          type="button"
          aria-label="Expand player"
          onClick={onExpand}
          className="flex items-center gap-4 min-w-0 flex-1 text-left outline-none"
        >
          <span className="relative w-11 h-11 rounded-md overflow-hidden shrink-0">
            <Texture
              name={nowPlaying.texture}
              className="absolute inset-0 w-full h-full"
            />
          </span>
          <span className="min-w-0">
            <span className="block font-ui font-medium text-sm truncate text-primary">
              {nowPlaying.title}
            </span>
            <span className="block font-label text-[10px] uppercase tracking-wider text-muted-foreground truncate">
              {nowPlaying.artist}
            </span>
          </span>
        </button>
        <div className="hidden sm:flex flex-1 items-center gap-3 min-w-0">
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
        <div className="shrink-0">
          <Transport size="base" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `GlobalPlayer.tsx`**

```tsx
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
```

- [ ] **Step 6: Mount it in the `(app)` layout**

In `apps/web/app/design-system/screens/(app)/layout.tsx` add the import and render `<GlobalPlayer />` after `<BottomTabBar />`:

```tsx
import GlobalPlayer from "@/components/studio/screens/GlobalPlayer";
```

```tsx
      <BottomTabBar />
      <GlobalPlayer />
```

- [ ] **Step 7: Run to verify pass**

Run: `npm run test -- GlobalPlayer`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/studio/screens/DevicePlayer.tsx apps/web/components/studio/screens/MiniPlayerBar.tsx apps/web/components/studio/screens/GlobalPlayer.tsx apps/web/components/studio/screens/GlobalPlayer.test.tsx "apps/web/app/design-system/screens/(app)/layout.tsx"
git commit -m "feat(studio): global player with compressed and expanded states"
```

---

### Task 6: Small shared components

**Files (all Create, in `apps/web/components/studio/screens/`):**
`TagChip.tsx`, `ViewToggle.tsx`, `SortControl.tsx`, `TrackMenu.tsx`, `MenuList.tsx`, `StatCard.tsx`, `ProfileBadge.tsx`, `BackHeader.tsx`, `ToggleSwitch.tsx`, `SocialAuthButtons.tsx`, `SignInPrompt.tsx`

These are leaf presentational pieces; they're exercised by the screen tests in Tasks 7 and 10 and shown in the gallery in Task 12 — no dedicated unit tests.

- [ ] **Step 1: `TagChip.tsx`** (chip + chip row)

```tsx
"use client";

import { cn } from "@/lib/utils";

interface TagChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

/** Pill chip — library type filters, playlist tags, form kind pickers. */
export function TagChip({ label, active = false, onClick, className }: TagChipProps) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1",
        "font-label text-[10px] uppercase tracking-wider transition-colors duration-fast",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-muted-foreground border-border",
        onClick && "cursor-pointer hover:border-primary hover:text-primary",
        className
      )}
    >
      {label}
    </Tag>
  );
}

interface FilterChipRowProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** Single-select chip row — the Library's content-type filter. */
export function FilterChipRow<T extends string>({
  options,
  value,
  onChange,
  className,
}: FilterChipRowProps<T>) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="group">
      {options.map((o) => (
        <TagChip
          key={o.value}
          label={o.label}
          active={o.value === value}
          onClick={() => onChange(o.value)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `ViewToggle.tsx`**

```tsx
"use client";

import { RowsIcon, GridIcon } from "@radix-ui/react-icons";

import { PlayerButton } from "@/components/studio/PlayerButton";

export type TrackView = "rows" | "grid";

interface ViewToggleProps {
  view: TrackView;
  onChange: (view: TrackView) => void;
}

/** Rows ↔ grid switch for playlist track lists. */
export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-1">
      <PlayerButton
        variant={view === "rows" ? "primary" : "ghost"}
        size="sm"
        aria-label="Rows view"
        onClick={() => onChange("rows")}
      >
        <RowsIcon />
      </PlayerButton>
      <PlayerButton
        variant={view === "grid" ? "primary" : "ghost"}
        size="sm"
        aria-label="Grid view"
        onClick={() => onChange("grid")}
      >
        <GridIcon />
      </PlayerButton>
    </div>
  );
}
```

- [ ] **Step 3: `SortControl.tsx`**

```tsx
"use client";

import { CaretSortIcon } from "@radix-ui/react-icons";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TrackSort } from "./library-utils";

const LABELS: Record<TrackSort, string> = {
  recent: "Recently added",
  alpha: "Alphabetical",
};

interface SortControlProps {
  sort: TrackSort;
  onChange: (sort: TrackSort) => void;
}

/** Track-list sort picker. */
export default function SortControl({ sort, onChange }: SortControlProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Sort tracks">
          <CaretSortIcon className="mr-1.5 h-3.5 w-3.5" />
          {LABELS[sort]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(LABELS) as TrackSort[]).map((key) => (
          <DropdownMenuItem key={key} onClick={() => onChange(key)}>
            {LABELS[key]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 4: `TrackMenu.tsx`**

```tsx
"use client";

import {
  DotsHorizontalIcon,
  Share1Icon,
  PlusIcon,
  HeartIcon,
} from "@radix-ui/react-icons";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlayerButton } from "@/components/studio/PlayerButton";

interface TrackMenuProps {
  trackTitle: string;
}

/** The ⋯ menu on every track row — mock actions surface as toasts. */
export default function TrackMenu({ trackTitle }: TrackMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <PlayerButton variant="ghost" size="sm" aria-label={`More for ${trackTitle}`}>
          <DotsHorizontalIcon />
        </PlayerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => toast(`Link for “${trackTitle}” copied`)}>
          <Share1Icon className="mr-2 h-3.5 w-3.5" /> Share
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast(`“${trackTitle}” added to a playlist`)}>
          <PlusIcon className="mr-2 h-3.5 w-3.5" /> Add to playlist
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast(`“${trackTitle}” added to Liked Songs`)}>
          <HeartIcon className="mr-2 h-3.5 w-3.5" /> Like
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 5: `MenuList.tsx`** (MenuRow + MenuList)

```tsx
import Link from "next/link";
import { ChevronRightIcon } from "@radix-ui/react-icons";

interface MenuRowProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  hint?: string;
}

/** One hub row — icon, label + hint, chevron. */
export function MenuRow({ href, icon, label, hint }: MenuRowProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 px-4 py-3.5 hover:bg-secondary transition-colors duration-fast"
    >
      <span className="flex items-center justify-center w-9 h-9 rounded-md bg-secondary text-primary shrink-0 [&>svg]:w-4 [&>svg]:h-4">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-ui font-medium text-sm">{label}</span>
        {hint ? (
          <span className="block type-muted truncate mt-0.5">{hint}</span>
        ) : null}
      </span>
      <ChevronRightIcon className="w-4 h-4 text-muted-foreground shrink-0" />
    </Link>
  );
}

/** Card container for MenuRows — the Profile hub's spine. */
export function MenuList({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
      {children}
    </div>
  );
}
```

(If `type-muted` doesn't exist, use `text-xs text-muted-foreground`.)

- [ ] **Step 6: `StatCard.tsx`**

```tsx
import DataText from "@/components/studio/DataText";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
}

/** One listening-behavior number, framed. */
export default function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="font-label text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <DataText className="block text-2xl text-primary mt-1.5">{value}</DataText>
      {hint ? (
        <div className="text-xs text-muted-foreground mt-1">{hint}</div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 7: `ProfileBadge.tsx`**

```tsx
"use client";

import Link from "next/link";
import { ChevronRightIcon } from "@radix-ui/react-icons";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import DataText from "@/components/studio/DataText";
import type { MockUser } from "./mock-data";

const BASE = "/design-system/screens";

interface ProfileBadgeProps {
  user: MockUser;
}

/** Hub header card — tap to open the full view-profile screen. */
export default function ProfileBadge({ user }: ProfileBadgeProps) {
  return (
    <Link
      href={`${BASE}/profile/view`}
      className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:shadow-e3 hover:-translate-y-0.5 transition-all duration-base"
    >
      <Avatar className="w-14 h-14 border border-border">
        <AvatarFallback className="bg-cobalt text-snow font-ui text-lg">
          {user.initials}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="block font-display font-bold text-lg truncate">
          {user.userName}
        </span>
        <span className="flex items-center gap-3 mt-0.5">
          <DataText className="text-xs text-muted-foreground">
            {user.followers} followers
          </DataText>
          <DataText className="text-xs text-muted-foreground">
            {user.following} following
          </DataText>
        </span>
      </span>
      <ChevronRightIcon className="w-4 h-4 text-muted-foreground shrink-0" />
    </Link>
  );
}
```

- [ ] **Step 8: `BackHeader.tsx`**

```tsx
import Link from "next/link";
import { ChevronLeftIcon } from "@radix-ui/react-icons";

import { Button } from "@/components/ui/button";

interface BackHeaderProps {
  title: string;
  backHref: string;
}

/** Sub-screen header — back chevron + title. */
export default function BackHeader({ title, backHref }: BackHeaderProps) {
  return (
    <header className="flex items-center gap-2 mb-6">
      <Button variant="ghost" size="icon" asChild aria-label="Back">
        <Link href={backHref}>
          <ChevronLeftIcon className="w-5 h-5" />
        </Link>
      </Button>
      <h1 className="type-h2 truncate">{title}</h1>
    </header>
  );
}
```

(If the Button component has no `size="icon"`, use `size="sm"`.)

- [ ] **Step 9: `ToggleSwitch.tsx`**

```tsx
"use client";

import { cn } from "@/lib/utils";

interface ToggleSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  "aria-label": string;
}

/** Dependency-free switch for the privacy toggles. */
export default function ToggleSwitch({
  checked,
  onCheckedChange,
  "aria-label": ariaLabel,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-border",
        "transition-colors duration-base outline-none",
        checked ? "bg-primary" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "inline-block h-[1.125rem] w-[1.125rem] rounded-full bg-card shadow-e1",
          "transition-transform duration-base",
          checked ? "translate-x-[1.125rem]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
```

- [ ] **Step 10: `SocialAuthButtons.tsx`**

```tsx
"use client";

import Image from "next/image";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useMockStudio } from "./MockStudioProvider";

interface SocialAuthButtonsProps {
  /** Called after the mock session flips to signed-in (e.g. redirect home). */
  onAuthed?: () => void;
}

/** The whole auth surface: Google + Facebook. Firebase makes login = signup. */
export default function SocialAuthButtons({ onAuthed }: SocialAuthButtonsProps) {
  const { signIn } = useMockStudio();

  const continueWith = (provider: "Google" | "Facebook") => {
    signIn();
    toast(`Signed in with ${provider}`);
    onAuthed?.();
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <Button className="w-full" onClick={() => continueWith("Google")}>
        <Image
          src="/svgs/google.svg"
          width={16}
          height={16}
          alt=""
          className="mr-2 h-4 w-4"
        />
        Continue with Google
      </Button>
      <Button
        variant="secondary"
        className="w-full"
        onClick={() => continueWith("Facebook")}
      >
        <Image
          src="/svgs/facebook.svg"
          width={16}
          height={16}
          alt=""
          className="mr-2 h-4 w-4"
        />
        Continue with Facebook
      </Button>
    </div>
  );
}
```

- [ ] **Step 11: `SignInPrompt.tsx`**

```tsx
import Link from "next/link";

import EmptyState from "@/components/studio/EmptyState";
import { Button } from "@/components/ui/button";

const BASE = "/design-system/screens";

interface SignInPromptProps {
  title?: string;
  hint?: string;
}

/** Guest gate for Library and Profile. */
export default function SignInPrompt({
  title = "Sign in to continue",
  hint = "Your library, stats and history live behind one tap.",
}: SignInPromptProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <EmptyState title={title} hint={hint} texture="tx-k2-horizon" />
      <Button asChild>
        <Link href={`${BASE}/auth`}>Sign in</Link>
      </Button>
    </div>
  );
}
```

(Check `EmptyState`'s actual props in `components/studio/EmptyState.tsx` — it takes `title`, `hint`, `texture` per current usage in the old home screen.)

- [ ] **Step 12: Verify + commit**

Run: `npm run lint`
Expected: clean.

```bash
git add apps/web/components/studio/screens
git commit -m "feat(studio): shared IA components — chips, menus, stats, auth, toggles"
```

---

### Task 7: Auth screen (replaces login + signup)

**Files:**
- Create: `apps/web/app/design-system/screens/auth/page.tsx`
- Test: `apps/web/app/design-system/screens/auth/page.test.tsx`
- Delete: `apps/web/app/design-system/screens/login/`, `apps/web/app/design-system/screens/signup/`

- [ ] **Step 1: Write the failing test**

Create `auth/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider, { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import AuthScreen from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function SessionProbe() {
  const { user } = useMockStudio();
  return <div data-testid="session">{user ? user.userName : "guest"}</div>;
}

function SignOutFirst({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useMockStudio();
  if (user) signOut();
  return <>{children}</>;
}

describe("AuthScreen", () => {
  it("signs in with a social provider and redirects home", () => {
    render(
      <MockStudioProvider>
        <SignOutFirst>
          <AuthScreen />
          <SessionProbe />
        </SignOutFirst>
      </MockStudioProvider>
    );

    expect(screen.getByTestId("session").textContent).toBe("guest");
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(screen.getByTestId("session").textContent).toBe("Yuki Sato");
    expect(push).toHaveBeenCalledWith("/design-system/screens/home");
  });
});
```

(If calling `signOut` during render warns, replace `SignOutFirst` with a `useEffect`-based variant — the assertion stays the same.)

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- auth`
Expected: FAIL — `./page` has no such component yet.

- [ ] **Step 3: Create `auth/page.tsx`**

```tsx
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { AuroraBackground } from "@/components/ui/aurora-background";
import SocialAuthButtons from "@/components/studio/screens/SocialAuthButtons";

const BASE = "/design-system/screens";

/** One door for everyone — Firebase social sign-in creates accounts on first login. */
export default function AuthScreen() {
  const router = useRouter();

  return (
    <div className="rounded-lg overflow-hidden border border-border">
      <AuroraBackground className="!w-full !h-[72vh] p-6">
        <div className="relative w-full sm:max-w-[400px] flex flex-col items-center gap-4">
          <Image
            src="/svgs/logo_light.svg"
            width={24}
            height={24}
            alt="Yukirhythm"
            className="h-6 w-auto object-contain"
          />
          <h1 className="type-h2 text-center anim-sign-on">
            Listen your way
          </h1>
          <p className="type-small text-center text-muted-foreground">
            One account for everything — sign in or sign up in a single tap.
          </p>

          <SocialAuthButtons onAuthed={() => router.push(`${BASE}/home`)} />

          <p className="type-small text-muted-foreground text-center">
            By continuing you agree to the mock Terms — nothing here touches the
            network.
          </p>
        </div>
      </AuroraBackground>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- auth`
Expected: PASS.

- [ ] **Step 5: Delete the old routes**

```bash
git rm -r apps/web/app/design-system/screens/login apps/web/app/design-system/screens/signup
```

Then: `npm run lint` — fix any dangling imports (`PreviewMenu.tsx` links to `/login`; it is deleted in Task 13, so if lint flags it, update its link to `${BASE}/auth` for now).

- [ ] **Step 6: Commit**

```bash
git add -A apps/web/app/design-system/screens
git commit -m "feat(studio): merged social-only auth screen, drop login/signup"
```

---

### Task 8: PlaylistDrawer + CreatePlaylistDrawer

**Files:**
- Create: `apps/web/components/studio/screens/PlaylistDrawer.tsx`
- Create: `apps/web/components/studio/screens/CreatePlaylistDrawer.tsx`

Exercised by the Library screen test in Task 11.

- [ ] **Step 1: Create `PlaylistDrawer.tsx`**

```tsx
"use client";

import { useState } from "react";
import {
  ChevronLeftIcon,
  PlayIcon,
  PlusIcon,
  ShuffleIcon,
} from "@radix-ui/react-icons";
import { toast } from "sonner";

import { DrawerClose, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import DataText from "@/components/studio/DataText";
import MediaCard from "@/components/studio/MediaCard";
import TrackRow from "@/components/studio/TrackRow";
import EmptyState from "@/components/studio/EmptyState";
import { PlayerButton } from "@/components/studio/PlayerButton";
import AppDrawer from "./AppDrawer";
import TrackMenu from "./TrackMenu";
import ViewToggle, { type TrackView } from "./ViewToggle";
import SortControl from "./SortControl";
import { TagChip } from "./TagChip";
import { sortTracks, type TrackSort } from "./library-utils";
import { useMockStudio } from "./MockStudioProvider";
import {
  formatDuration,
  getCollectionTracks,
  type MockCollection,
} from "./mock-data";

interface PlaylistDrawerProps {
  collection: MockCollection | null;
  onOpenChange: (open: boolean) => void;
}

/** 95vh playlist detail — play, shuffle, tags, view/sort, tracks with menus. */
export default function PlaylistDrawer({
  collection,
  onOpenChange,
}: PlaylistDrawerProps) {
  const { play, nowPlaying, isPlaying } = useMockStudio();
  const [view, setView] = useState<TrackView>("rows");
  const [sort, setSort] = useState<TrackSort>("recent");

  const tracks = collection
    ? sortTracks(getCollectionTracks(collection), sort)
    : [];

  return (
    <AppDrawer open={collection !== null} onOpenChange={onOpenChange} height="95vh">
      {collection ? (
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2">
            <DrawerClose asChild>
              <PlayerButton variant="ghost" size="sm" aria-label="Back">
                <ChevronLeftIcon />
              </PlayerButton>
            </DrawerClose>
            <DrawerTitle className="type-h2 truncate">
              {collection.title}
            </DrawerTitle>
            <DataText className="text-sm text-muted-foreground ml-auto shrink-0">
              {tracks.length} tracks
            </DataText>
          </div>

          <p className="type-muted mt-2">{collection.desc}</p>

          <div className="flex items-center gap-3 mt-4">
            <PlayerButton
              variant="primary"
              size="lg"
              aria-label="Play collection"
              onClick={() => tracks[0] && play(tracks[0])}
            >
              <PlayIcon />
            </PlayerButton>
            <PlayerButton
              variant="outline"
              aria-label="Shuffle collection"
              onClick={() =>
                tracks.length &&
                play(tracks[Math.floor(Math.random() * tracks.length)])
              }
            >
              <ShuffleIcon />
            </PlayerButton>
            <div className="flex flex-wrap gap-1.5 ml-2">
              {collection.tags.map((tag) => (
                <TagChip key={tag} label={tag} />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mt-6 mb-2">
            <div className="flex items-center gap-2">
              <ViewToggle view={view} onChange={setView} />
              <SortControl sort={sort} onChange={setSort} />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast(`Pick tracks to add to “${collection.title}”`)}
            >
              <PlusIcon className="mr-1.5 h-3.5 w-3.5" /> Add to this playlist
            </Button>
          </div>

          {tracks.length === 0 ? (
            <EmptyState
              title="Nothing in here yet"
              hint="Add tracks with the button above."
              texture="tx-k2-static"
            />
          ) : view === "rows" ? (
            <div className="space-y-1">
              {tracks.map((track, i) => (
                <div key={track.id} className="flex items-center gap-1">
                  <div
                    className="flex-1 min-w-0"
                    onClick={() => play(track)}
                  >
                    <TrackRow
                      index={i + 1}
                      title={track.title}
                      artist={track.artist}
                      duration={formatDuration(track.durationSec)}
                      texture={track.texture}
                      playing={nowPlaying?.id === track.id && isPlaying}
                    />
                  </div>
                  <TrackMenu trackTitle={track.title} />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {tracks.map((track) => (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => play(track)}
                  className="text-left"
                >
                  <MediaCard
                    title={track.title}
                    artist={track.artist}
                    texture={track.texture}
                    size="sm"
                    playing={nowPlaying?.id === track.id && isPlaying}
                    className="w-full"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </AppDrawer>
  );
}
```

- [ ] **Step 2: Create `CreatePlaylistDrawer.tsx`**

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";

import { DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AppDrawer from "./AppDrawer";
import { TagChip } from "./TagChip";
import { useMockStudio } from "./MockStudioProvider";
import type { CollectionKind } from "./mock-data";

interface CreatePlaylistDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 90vh create-playlist form — the existing flow, rebranded and drawer-ized. */
export default function CreatePlaylistDrawer({
  open,
  onOpenChange,
}: CreatePlaylistDrawerProps) {
  const { createCollection } = useMockStudio();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [tags, setTags] = useState("");
  const [kind, setKind] = useState<CollectionKind>("music");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createCollection({
      title: title.trim(),
      desc: desc.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      kind,
    });
    toast(`Created “${title.trim()}”`);
    setTitle("");
    setDesc("");
    setTags("");
    setKind("music");
    onOpenChange(false);
  };

  return (
    <AppDrawer open={open} onOpenChange={onOpenChange} height="90vh">
      <form onSubmit={onSubmit} className="max-w-md mx-auto space-y-4">
        <DrawerTitle className="type-h2">Create playlist</DrawerTitle>

        <div className="space-y-1.5">
          <Label htmlFor="pl-title">Name</Label>
          <Input
            id="pl-title"
            required
            placeholder="Rainy Tapes"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pl-desc">Description</Label>
          <Input
            id="pl-desc"
            placeholder="What's the mood?"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Type</Label>
          <div className="flex gap-2">
            <TagChip
              label="Music"
              active={kind === "music"}
              onClick={() => setKind("music")}
            />
            <TagChip
              label="Podcast"
              active={kind === "podcast"}
              onClick={() => setKind("podcast")}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pl-tags">Tags (comma separated)</Label>
          <Input
            id="pl-tags"
            placeholder="lofi, night, focus"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>

        <Button type="submit" className="w-full">
          Create
        </Button>
      </form>
    </AppDrawer>
  );
}
```

- [ ] **Step 3: Verify + commit**

Run: `npm run lint`
Expected: clean.

```bash
git add apps/web/components/studio/screens/PlaylistDrawer.tsx apps/web/components/studio/screens/CreatePlaylistDrawer.tsx
git commit -m "feat(studio): playlist detail and create-playlist drawers"
```

---

### Task 9: Home screen

**Files:**
- Rewrite: `apps/web/app/design-system/screens/(app)/home/page.tsx`

- [ ] **Step 1: Replace the page content**

```tsx
"use client";

import { useState } from "react";
import { BellIcon } from "@radix-ui/react-icons";
import { toast } from "sonner";

import RailShelf from "@/components/studio/RailShelf";
import MediaCard from "@/components/studio/MediaCard";
import { PlayerButton } from "@/components/studio/PlayerButton";
import PageHeader from "@/components/studio/screens/PageHeader";
import PlaylistDrawer from "@/components/studio/screens/PlaylistDrawer";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import {
  MOCK_HISTORY,
  NEW_RELEASE_IDS,
  formatDuration,
  getTrack,
  recentCollections,
  type MockCollection,
} from "@/components/studio/screens/mock-data";

export default function HomeScreen() {
  const { user, collections, nowPlaying, isPlaying, play } = useMockStudio();
  const [openCollection, setOpenCollection] = useState<MockCollection | null>(
    null
  );

  const recents = recentCollections(MOCK_HISTORY, collections);

  return (
    <div>
      <PageHeader
        title="Home"
        actions={
          <PlayerButton
            variant="ghost"
            aria-label="Notifications"
            onClick={() => toast("No new notifications")}
          >
            <BellIcon />
          </PlayerButton>
        }
      />

      <div className="space-y-10">
        {user && recents.length > 0 ? (
          <RailShelf label="Recently played" title="Jump back in">
            {recents.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setOpenCollection(c)}
                className="text-left shrink-0"
              >
                <MediaCard
                  title={c.title}
                  artist={`${c.trackIds.length} tracks`}
                  texture={c.texture}
                  size="sm"
                />
              </button>
            ))}
          </RailShelf>
        ) : null}

        <RailShelf label="Fresh drops" title="New releases">
          {NEW_RELEASE_IDS.map((id) => {
            const track = getTrack(id);
            if (!track) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => play(track)}
                className="text-left shrink-0"
              >
                <MediaCard
                  title={track.title}
                  artist={track.artist}
                  texture={track.texture}
                  duration={formatDuration(track.durationSec)}
                  size="md"
                  playing={nowPlaying?.id === track.id && isPlaying}
                />
              </button>
            );
          })}
        </RailShelf>
      </div>

      <PlaylistDrawer
        collection={openCollection}
        onOpenChange={(o) => {
          if (!o) setOpenCollection(null);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run lint` and `npm run test`
Expected: clean; suites green. In the preview: signed-in shows both shelves, sign-out (via Settings later, or provider default) hides "Jump back in"; tapping a recent opens the drawer; tapping a release starts the mini player.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/design-system/screens/(app)/home/page.tsx"
git commit -m "feat(studio): home screen — jump back in + new releases"
```

---

### Task 10: Search screen

**Files:**
- Create: `apps/web/app/design-system/screens/(app)/search/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
"use client";

import { useState } from "react";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";

import RailShelf from "@/components/studio/RailShelf";
import MediaCard from "@/components/studio/MediaCard";
import TrackRow from "@/components/studio/TrackRow";
import EmptyState from "@/components/studio/EmptyState";
import Texture from "@/components/studio/Texture";
import { SkeletonRow } from "@/components/studio/Skeletons";
import { Input } from "@/components/ui/input";
import SectionLabel from "@/components/studio/SectionLabel";
import PageHeader from "@/components/studio/screens/PageHeader";
import PlaylistDrawer from "@/components/studio/screens/PlaylistDrawer";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import {
  EXPLORE_TILES,
  NEW_RELEASE_IDS,
  YOU_MIGHT_LIKE_IDS,
  formatDuration,
  getTrack,
  searchMockCollections,
  type MockCollection,
} from "@/components/studio/screens/mock-data";

function TrackShelf({
  label,
  title,
  ids,
}: {
  label: string;
  title: string;
  ids: string[];
}) {
  const { play, nowPlaying, isPlaying } = useMockStudio();
  return (
    <RailShelf label={label} title={title}>
      {ids.map((id) => {
        const track = getTrack(id);
        if (!track) return null;
        return (
          <button
            key={id}
            type="button"
            onClick={() => play(track)}
            className="text-left shrink-0"
          >
            <MediaCard
              title={track.title}
              artist={track.artist}
              texture={track.texture}
              duration={formatDuration(track.durationSec)}
              size="sm"
              playing={nowPlaying?.id === track.id && isPlaying}
            />
          </button>
        );
      })}
    </RailShelf>
  );
}

export default function SearchScreen() {
  const {
    search,
    searchResults,
    searching,
    hasSearched,
    clearSearch,
    play,
    nowPlaying,
    isPlaying,
  } = useMockStudio();
  const [q, setQ] = useState("");
  const [openCollection, setOpenCollection] = useState<MockCollection | null>(
    null
  );

  const onChange = (value: string) => {
    setQ(value);
    if (value.trim()) search(value);
    else clearSearch();
  };

  const collectionHits = q.trim() ? searchMockCollections(q) : [];
  const idle = !q.trim();

  return (
    <div>
      <PageHeader title="Search" />

      <div className="relative mb-8">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Tracks, artists, collections…"
          aria-label="Search"
          className="pl-9"
        />
      </div>

      {idle ? (
        <div className="space-y-10">
          <TrackShelf
            label="For you"
            title="You might like"
            ids={YOU_MIGHT_LIKE_IDS}
          />

          <section>
            <SectionLabel>Explore</SectionLabel>
            <h2 className="font-display font-bold text-2xl tracking-tight mt-0.5 mb-3">
              Browse by mood
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {EXPLORE_TILES.map((tile) => (
                <button
                  key={tile.label}
                  type="button"
                  onClick={() => onChange(tile.label)}
                  className="group relative h-24 rounded-lg overflow-hidden border border-border text-left hover:shadow-e3 hover:-translate-y-0.5 transition-all duration-base"
                >
                  <Texture
                    name={tile.texture}
                    className="absolute inset-0 w-full h-full"
                  />
                  <span className="absolute bottom-2 left-3 font-display font-bold text-snow drop-shadow">
                    {tile.label}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <TrackShelf
            label="Fresh drops"
            title="New releases"
            ids={NEW_RELEASE_IDS}
          />
        </div>
      ) : (
        <div className="space-y-8">
          {searching ? (
            <div className="space-y-1">
              {Array.from({ length: 6 }, (_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          ) : (
            <>
              {searchResults.length > 0 ? (
                <section>
                  <SectionLabel>Tracks</SectionLabel>
                  <div className="space-y-1 mt-2">
                    {searchResults.map((track, i) => (
                      <div key={track.id} onClick={() => play(track)}>
                        <TrackRow
                          index={i + 1}
                          title={track.title}
                          artist={track.artist}
                          duration={formatDuration(track.durationSec)}
                          texture={track.texture}
                          playing={nowPlaying?.id === track.id && isPlaying}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {collectionHits.length > 0 ? (
                <section>
                  <SectionLabel>Collections</SectionLabel>
                  <div className="space-y-2 mt-2">
                    {collectionHits.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setOpenCollection(c)}
                        className="w-full text-left"
                      >
                        <MediaCard
                          title={c.title}
                          artist={`${c.trackIds.length} tracks`}
                          texture={c.texture}
                          variant="extended"
                          size="sm"
                        />
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {hasSearched &&
              searchResults.length === 0 &&
              collectionHits.length === 0 ? (
                <EmptyState
                  title="No results"
                  hint="Try a different search — artist, title or tag."
                  texture="tx-k2-static"
                />
              ) : null}
            </>
          )}
        </div>
      )}

      <PlaylistDrawer
        collection={openCollection}
        onOpenChange={(o) => {
          if (!o) setOpenCollection(null);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run lint` and `npm run test`
Expected: clean. Preview: idle shows You-might-like / Explore / New releases; typing filters live; Explore tile fills the query.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/design-system/screens/(app)/search/page.tsx"
git commit -m "feat(studio): search screen with explore and live results"
```

---

### Task 11: Library screen

**Files:**
- Create: `apps/web/app/design-system/screens/(app)/library/page.tsx`
- Test: `apps/web/app/design-system/screens/(app)/library/page.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `library/page.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import LibraryScreen from "./page";

function renderLibrary() {
  return render(
    <MockStudioProvider>
      <LibraryScreen />
    </MockStudioProvider>
  );
}

describe("LibraryScreen", () => {
  it("shows Liked Songs first and filters by type chip", () => {
    renderLibrary();

    const rows = screen.getAllByRole("button", { name: /open collection/i });
    expect(rows[0].textContent).toContain("Liked Songs");

    fireEvent.click(screen.getByRole("button", { name: "Podcasts" }));
    expect(screen.getByText("Pixel Podcasts")).toBeTruthy();
    expect(screen.queryByText("Cobalt After Hours")).toBeNull();
  });

  it("opens the playlist drawer when a collection is tapped", () => {
    renderLibrary();

    fireEvent.click(
      screen.getByRole("button", { name: /open collection liked songs/i })
    );
    expect(screen.getByText("Every track you've hearted.")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- library/page`
Expected: FAIL — `./page` not found.

- [ ] **Step 3: Create `library/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { DrawingPinFilledIcon, PlusIcon } from "@radix-ui/react-icons";

import MediaCard from "@/components/studio/MediaCard";
import { PlayerButton } from "@/components/studio/PlayerButton";
import PageHeader from "@/components/studio/screens/PageHeader";
import SignInPrompt from "@/components/studio/screens/SignInPrompt";
import PlaylistDrawer from "@/components/studio/screens/PlaylistDrawer";
import CreatePlaylistDrawer from "@/components/studio/screens/CreatePlaylistDrawer";
import { FilterChipRow } from "@/components/studio/screens/TagChip";
import {
  LIBRARY_FILTERS,
  filterLibrary,
} from "@/components/studio/screens/library-utils";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import type { MockCollection } from "@/components/studio/screens/mock-data";

export default function LibraryScreen() {
  const { user, collections, libraryFilter, setLibraryFilter } =
    useMockStudio();
  const [openCollection, setOpenCollection] = useState<MockCollection | null>(
    null
  );
  const [creating, setCreating] = useState(false);

  if (!user) {
    return (
      <div>
        <PageHeader title="Your Library" />
        <SignInPrompt hint="Playlists, podcasts and Liked Songs live here." />
      </div>
    );
  }

  const visible = filterLibrary(collections, libraryFilter);

  return (
    <div>
      <PageHeader
        title="Your Library"
        actions={
          <PlayerButton
            variant="ghost"
            aria-label="Create playlist"
            onClick={() => setCreating(true)}
          >
            <PlusIcon />
          </PlayerButton>
        }
      />

      <FilterChipRow
        options={LIBRARY_FILTERS}
        value={libraryFilter}
        onChange={setLibraryFilter}
        className="mb-6"
      />

      <div className="space-y-2">
        {visible.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-label={`Open collection ${c.title}`}
            onClick={() => setOpenCollection(c)}
            className="relative w-full text-left"
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
          </button>
        ))}

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

      <PlaylistDrawer
        collection={openCollection}
        onOpenChange={(o) => {
          if (!o) setOpenCollection(null);
        }}
      />
      <CreatePlaylistDrawer open={creating} onOpenChange={setCreating} />
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- library/page`
Expected: PASS (2 tests). If the drawer content doesn't render in jsdom (vaul portal quirk), assert on `screen.getByText("Liked Songs")` inside a `dialog` role instead — but try the plain version first.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/design-system/screens/(app)/library"
git commit -m "feat(studio): library screen — chips, pinned collections, create flow"
```

---

### Task 12: Profile hub + subpages

**Files:**
- Rewrite: `apps/web/app/design-system/screens/(app)/profile/page.tsx`
- Create: `apps/web/app/design-system/screens/(app)/profile/view/page.tsx`
- Create: `apps/web/app/design-system/screens/(app)/profile/stats/page.tsx`
- Create: `apps/web/app/design-system/screens/(app)/profile/recents/page.tsx`
- Create: `apps/web/app/design-system/screens/(app)/profile/settings/page.tsx`
- Create: `apps/web/app/design-system/screens/(app)/profile/privacy/page.tsx`

All subpages start with `const BASE = "/design-system/screens";` and guard with `SignInPrompt` when signed out. The old tabbed profile page's content is fully replaced.

- [ ] **Step 1: Rewrite the hub (`profile/page.tsx`)**

```tsx
"use client";

import {
  BarChartIcon,
  CounterClockwiseClockIcon,
  GearIcon,
  LockClosedIcon,
} from "@radix-ui/react-icons";

import PageHeader from "@/components/studio/screens/PageHeader";
import ProfileBadge from "@/components/studio/screens/ProfileBadge";
import SignInPrompt from "@/components/studio/screens/SignInPrompt";
import { MenuList, MenuRow } from "@/components/studio/screens/MenuList";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";

const BASE = "/design-system/screens";

export default function ProfileHub() {
  const { user } = useMockStudio();

  if (!user) {
    return (
      <div>
        <PageHeader title="Profile" />
        <SignInPrompt hint="Your profile, stats and settings live here." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Profile" />
      <div className="space-y-6 max-w-xl">
        <ProfileBadge user={user} />
        <MenuList>
          <MenuRow
            href={`${BASE}/profile/stats`}
            icon={<BarChartIcon />}
            label="Listening stats"
            hint="Minutes, top artists, daily patterns"
          />
          <MenuRow
            href={`${BASE}/profile/recents`}
            icon={<CounterClockwiseClockIcon />}
            label="Recents"
            hint="Everything you've played lately"
          />
          <MenuRow
            href={`${BASE}/profile/settings`}
            icon={<GearIcon />}
            label="Settings"
            hint="Audio, language, account"
          />
          <MenuRow
            href={`${BASE}/profile/privacy`}
            icon={<LockClosedIcon />}
            label="Privacy"
            hint="What we collect and why"
          />
        </MenuList>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `profile/view/page.tsx`**

```tsx
"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import BackHeader from "@/components/studio/screens/BackHeader";
import SignInPrompt from "@/components/studio/screens/SignInPrompt";
import StatCard from "@/components/studio/screens/StatCard";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { MOCK_STATS } from "@/components/studio/screens/mock-data";

const BASE = "/design-system/screens";

export default function ViewProfileScreen() {
  const { user } = useMockStudio();
  if (!user) return <SignInPrompt />;

  return (
    <div className="max-w-xl">
      <BackHeader title="Your profile" backHref={`${BASE}/profile`} />
      <div className="flex flex-col items-center gap-3 py-6">
        <Avatar className="w-24 h-24 border border-border">
          <AvatarFallback className="bg-cobalt text-snow font-ui text-3xl">
            {user.initials}
          </AvatarFallback>
        </Avatar>
        <h2 className="font-display font-bold text-2xl">{user.userName}</h2>
        <p className="type-small text-muted-foreground">{user.email}</p>
        <p className="font-label text-[10px] uppercase tracking-wider text-muted-foreground">
          Joined March 2024
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Followers" value={String(user.followers)} />
        <StatCard label="Following" value={String(user.following)} />
        <StatCard
          label="Minutes"
          value={String(MOCK_STATS.minutesMonth)}
          hint="this month"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `profile/stats/page.tsx`**

```tsx
"use client";

import BackHeader from "@/components/studio/screens/BackHeader";
import SignInPrompt from "@/components/studio/screens/SignInPrompt";
import StatCard from "@/components/studio/screens/StatCard";
import SectionLabel from "@/components/studio/SectionLabel";
import DataText from "@/components/studio/DataText";
import TrackRow from "@/components/studio/TrackRow";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import {
  MOCK_STATS,
  formatDuration,
  getTrack,
} from "@/components/studio/screens/mock-data";

const BASE = "/design-system/screens";

export default function StatsScreen() {
  const { user, play, nowPlaying, isPlaying } = useMockStudio();
  if (!user) return <SignInPrompt />;

  return (
    <div className="max-w-xl space-y-10">
      <div>
        <BackHeader title="Listening stats" backHref={`${BASE}/profile`} />
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="This week" value={`${MOCK_STATS.minutesWeek} min`} />
          <StatCard label="This month" value={`${MOCK_STATS.minutesMonth} min`} />
          <StatCard
            label="All time"
            value={`${Math.round(MOCK_STATS.minutesAllTime / 60)} hrs`}
          />
          <StatCard
            label="Streak"
            value={`${MOCK_STATS.streakDays} days`}
            hint="listened every day"
          />
        </div>
      </div>

      <section>
        <SectionLabel>Top artists</SectionLabel>
        <div className="mt-2 rounded-lg border border-border bg-card divide-y divide-border">
          {MOCK_STATS.topArtists.map((artist, i) => (
            <div key={artist.name} className="flex items-center gap-3 px-4 py-2.5">
              <DataText className="text-sm text-muted-foreground w-6">
                {String(i + 1).padStart(2, "0")}
              </DataText>
              <span className="font-ui font-medium text-sm flex-1 truncate">
                {artist.name}
              </span>
              <DataText className="text-xs text-muted-foreground">
                {artist.plays} plays
              </DataText>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>Top tracks</SectionLabel>
        <div className="space-y-1 mt-2">
          {MOCK_STATS.topTrackIds.map((id, i) => {
            const track = getTrack(id);
            if (!track) return null;
            return (
              <div key={id} onClick={() => play(track)}>
                <TrackRow
                  index={i + 1}
                  title={track.title}
                  artist={track.artist}
                  duration={formatDuration(track.durationSec)}
                  texture={track.texture}
                  playing={nowPlaying?.id === track.id && isPlaying}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <SectionLabel>Genres</SectionLabel>
        <div className="space-y-2.5 mt-2">
          {MOCK_STATS.genreSplit.map((genre) => (
            <div key={genre.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-ui text-sm">{genre.name}</span>
                <DataText className="text-xs text-muted-foreground">
                  {genre.pct}%
                </DataText>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${genre.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>By hour</SectionLabel>
        <div
          className="flex items-end gap-1 h-24 mt-2"
          aria-label="Listening intensity by hour of day"
        >
          {MOCK_STATS.byHour.map((v, hour) => (
            <div
              key={hour}
              className="flex-1 rounded-sm bg-primary/80 min-h-[2px]"
              style={{ height: `${v * 100}%` }}
              title={`${hour}:00`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1 font-label text-[9px] uppercase tracking-wider text-muted-foreground">
          <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Create `profile/recents/page.tsx`**

```tsx
"use client";

import BackHeader from "@/components/studio/screens/BackHeader";
import SignInPrompt from "@/components/studio/screens/SignInPrompt";
import SectionLabel from "@/components/studio/SectionLabel";
import TrackRow from "@/components/studio/TrackRow";
import EmptyState from "@/components/studio/EmptyState";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import {
  HISTORY_GROUPS,
  MOCK_HISTORY,
  getTrack,
} from "@/components/studio/screens/mock-data";

const BASE = "/design-system/screens";

export default function RecentsScreen() {
  const { user, collections, play, nowPlaying, isPlaying } = useMockStudio();
  if (!user) return <SignInPrompt />;

  return (
    <div className="max-w-xl">
      <BackHeader title="Recents" backHref={`${BASE}/profile`} />
      {MOCK_HISTORY.length === 0 ? (
        <EmptyState
          title="Nothing played yet"
          hint="Your listening history shows up here."
          texture="tx-k2-static"
        />
      ) : (
        <div className="space-y-8">
          {HISTORY_GROUPS.map((group) => {
            const entries = MOCK_HISTORY.filter((e) => e.group === group);
            if (entries.length === 0) return null;
            return (
              <section key={group}>
                <SectionLabel>{group}</SectionLabel>
                <div className="space-y-1 mt-2">
                  {entries.map((entry, i) => {
                    const track = getTrack(entry.trackId);
                    if (!track) return null;
                    const source = collections.find(
                      (c) => c.id === entry.collectionId
                    );
                    return (
                      <div
                        key={`${entry.trackId}-${i}`}
                        onClick={() => play(track)}
                      >
                        <TrackRow
                          title={track.title}
                          artist={
                            source
                              ? `${track.artist} — from ${source.title}`
                              : track.artist
                          }
                          duration={entry.timeLabel}
                          texture={track.texture}
                          playing={nowPlaying?.id === track.id && isPlaying}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `profile/settings/page.tsx`**

```tsx
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import BackHeader from "@/components/studio/screens/BackHeader";
import SignInPrompt from "@/components/studio/screens/SignInPrompt";
import SectionLabel from "@/components/studio/SectionLabel";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";

const BASE = "/design-system/screens";

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <button
      type="button"
      onClick={() => toast(`“${label}” is mock-only for now`)}
      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-secondary transition-colors duration-fast text-left"
    >
      <span className="font-ui font-medium text-sm">{label}</span>
      <span className="text-xs text-muted-foreground">{value}</span>
    </button>
  );
}

export default function SettingsScreen() {
  const { user, signOut } = useMockStudio();
  const router = useRouter();
  if (!user) return <SignInPrompt />;

  return (
    <div className="max-w-xl space-y-8">
      <BackHeader title="Settings" backHref={`${BASE}/profile`} />

      <section>
        <SectionLabel>Playback</SectionLabel>
        <div className="mt-2 rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
          <SettingRow label="Audio quality" value="High" />
          <SettingRow label="Language" value="English" />
          <SettingRow label="Appearance" value="System" />
        </div>
      </section>

      <section>
        <SectionLabel>Account</SectionLabel>
        <div className="mt-2 rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Image
              src="/svgs/google.svg"
              width={16}
              height={16}
              alt=""
              className="h-4 w-4"
            />
            <span className="font-ui font-medium text-sm flex-1">
              Connected with Google
            </span>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
        </div>
      </section>

      <Button
        variant="destructive"
        className="w-full"
        onClick={() => {
          signOut();
          toast("Signed out");
          router.push(`${BASE}/auth`);
        }}
      >
        Sign out
      </Button>
    </div>
  );
}
```

- [ ] **Step 6: Create `profile/privacy/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import BackHeader from "@/components/studio/screens/BackHeader";
import SignInPrompt from "@/components/studio/screens/SignInPrompt";
import ToggleSwitch from "@/components/studio/screens/ToggleSwitch";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";

const BASE = "/design-system/screens";

function PrivacyRow({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="font-ui font-medium text-sm">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
      </div>
      <ToggleSwitch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  );
}

export default function PrivacyScreen() {
  const { user } = useMockStudio();
  const [history, setHistory] = useState(true);
  const [recs, setRecs] = useState(true);
  const [publicProfile, setPublicProfile] = useState(false);
  if (!user) return <SignInPrompt />;

  return (
    <div className="max-w-xl space-y-6">
      <BackHeader title="Privacy" backHref={`${BASE}/profile`} />

      <p className="type-small text-muted-foreground">
        Yukirhythm learns from what you play to shape recommendations. You
        control every signal below.
      </p>

      <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
        <PrivacyRow
          label="Save listening history"
          hint="Powers Recents and your stats."
          checked={history}
          onCheckedChange={setHistory}
        />
        <PrivacyRow
          label="Personalized recommendations"
          hint="Uses your listening behavior to suggest music."
          checked={recs}
          onCheckedChange={setRecs}
        />
        <PrivacyRow
          label="Public profile"
          hint="Let others see your playlists and stats."
          checked={publicProfile}
          onCheckedChange={setPublicProfile}
        />
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => toast("Listening history cleared (mock)")}
      >
        Clear listening history
      </Button>
    </div>
  );
}
```

- [ ] **Step 7: Verify**

Run: `npm run lint` and `npm run test`
Expected: clean; all suites green. Preview: hub rows navigate, back chevrons return, sign-out from Settings lands on auth and gates Library/Profile.

- [ ] **Step 8: Commit**

```bash
git add "apps/web/app/design-system/screens/(app)/profile"
git commit -m "feat(studio): profile hub with view, stats, recents, settings, privacy"
```

---

### Task 13: Categorized components gallery

**Files:**
- Move: `apps/web/app/design-system/components/page.tsx` → `apps/web/app/design-system/components/core/page.tsx`
- Create: `apps/web/app/design-system/components/page.tsx` (category index)
- Create: `apps/web/app/design-system/components/{shell,player,content,drawers,profile}/page.tsx`

Before writing the category pages, read `components/studio/ds/blocks.tsx` and `components/studio/ds/StatePanel.tsx` to confirm the `DsSection` / `StatePanel` APIs (used below as `<DsSection index title>` and `<StatePanel name signal views={{...}}>`); adjust the demos to the real props if they differ.

- [ ] **Step 1: Move the old gallery to `core/`**

```bash
git mv apps/web/app/design-system/components/page.tsx apps/web/app/design-system/components/core/page.tsx
```

Rename its default export to `CoreComponentsPage` and change the `<h1>` copy to "Core components". Everything else stays.

- [ ] **Step 2: Create the category index (`components/page.tsx`)**

```tsx
import Link from "next/link";
import Texture, { type TextureName } from "@/components/studio/Texture";
import SectionLabel from "@/components/studio/SectionLabel";

const CATEGORIES: {
  href: string;
  title: string;
  desc: string;
  texture: TextureName;
}[] = [
  { href: "core", title: "Core", desc: "Buttons, inputs, cards, rows — the primitives.", texture: "tx-k2-vinyl" },
  { href: "shell", title: "Shell & Navigation", desc: "PageHeader, BottomTabBar, SideNav.", texture: "tx-k2-topo" },
  { href: "player", title: "Player", desc: "DevicePlayer, MiniPlayerBar, GlobalPlayer states.", texture: "tx-k2-horizon" },
  { href: "content", title: "Content", desc: "Chips, view toggle, sort, track menu.", texture: "tx-k-marble" },
  { href: "drawers", title: "Drawers", desc: "AppDrawer, playlist detail, create playlist.", texture: "tx-k-silk" },
  { href: "profile", title: "Profile & States", desc: "ProfileBadge, menus, stats, auth, gates.", texture: "tx-k2-static" },
];

export default function ComponentsIndex() {
  return (
    <div>
      <SectionLabel>Living inventory</SectionLabel>
      <h1 className="type-h1 mt-1">Components</h1>
      <p className="type-p text-muted-foreground mt-2 max-w-2xl">
        Every component in its states, split by category so no single page has
        to render the whole system.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-8">
        {CATEGORIES.map((c) => (
          <Link
            key={c.href}
            href={`/design-system/components/${c.href}`}
            className="group rounded-lg border border-border bg-card overflow-hidden hover:shadow-e3 hover:-translate-y-0.5 transition-all duration-base"
          >
            <Texture name={c.texture} className="h-24 w-full" />
            <div className="p-5">
              <div className="flex items-center justify-between">
                <span className="type-h3">{c.title}</span>
                <span className="type-label text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-fast">
                  OPEN →
                </span>
              </div>
              <p className="type-muted mt-1.5">{c.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `components/shell/page.tsx`**

Shell pieces read `usePathname`/provider, so wrap the page content in `MockStudioProvider` (these gallery routes sit outside the screens layout). Pattern for all category pages:

```tsx
"use client";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import { DsSection } from "@/components/studio/ds/blocks";
import StatePanel from "@/components/studio/ds/StatePanel";
import PageHeader from "@/components/studio/screens/PageHeader";
import BottomTabBar from "@/components/studio/screens/BottomTabBar";
import SideNav from "@/components/studio/screens/SideNav";
import { PlayerButton } from "@/components/studio/PlayerButton";
import { BellIcon } from "@radix-ui/react-icons";

export default function ShellComponentsPage() {
  return (
    <MockStudioProvider>
      <div>
        <h1 className="type-h1 mb-8">Shell &amp; Navigation</h1>

        <DsSection index="01" title="PageHeader">
          <StatePanel
            name="PageHeader"
            signal="header_avatar → profile"
            views={{
              default: <PageHeader title="Home" />,
              "with actions": (
                <PageHeader
                  title="Home"
                  actions={
                    <PlayerButton variant="ghost" aria-label="Notifications">
                      <BellIcon />
                    </PlayerButton>
                  }
                />
              ),
            }}
          />
        </DsSection>

        <DsSection index="02" title="BottomTabBar">
          <StatePanel
            name="BottomTabBar (mobile)"
            signal="tab_switch"
            views={{
              default: (
                <div className="relative h-20 overflow-hidden rounded-lg border border-border [&>nav]:absolute [&>nav]:md:flex">
                  <BottomTabBar />
                </div>
              ),
            }}
          />
        </DsSection>

        <DsSection index="03" title="SideNav">
          <StatePanel
            name="SideNav (desktop)"
            signal="nav_switch"
            views={{
              default: (
                <div className="[&>aside]:static [&>aside]:h-auto [&>aside]:min-h-0 [&>aside]:flex">
                  <SideNav />
                </div>
              ),
            }}
          />
        </DsSection>
      </div>
    </MockStudioProvider>
  );
}
```

Note: the fixed/sticky/hidden classes are neutralized with arbitrary-variant overrides so the pieces render inline in the gallery. If the `[&>nav]`/`[&>aside]` overrides fight the component classes, add an optional `inGallery?: boolean` prop to `BottomTabBar`/`SideNav` that swaps `fixed`/`sticky`/`hidden` for `static flex` — small, explicit, and only the gallery uses it.

- [ ] **Step 4: Create `components/player/page.tsx`**

```tsx
"use client";

import MockStudioProvider, {
  useMockStudio,
} from "@/components/studio/screens/MockStudioProvider";
import { DsSection } from "@/components/studio/ds/blocks";
import StatePanel from "@/components/studio/ds/StatePanel";
import DevicePlayer from "@/components/studio/screens/DevicePlayer";
import MiniPlayerBar from "@/components/studio/screens/MiniPlayerBar";
import { Button } from "@/components/ui/button";
import { MOCK_TRACKS } from "@/components/studio/screens/mock-data";

function Seed() {
  const { play, nowPlaying } = useMockStudio();
  if (nowPlaying) return null;
  return (
    <Button size="sm" onClick={() => play(MOCK_TRACKS[0])}>
      Load a track
    </Button>
  );
}

export default function PlayerComponentsPage() {
  return (
    <MockStudioProvider>
      <div>
        <h1 className="type-h1 mb-8">Player</h1>
        <Seed />

        <DsSection index="01" title="DevicePlayer">
          <StatePanel
            name="DevicePlayer — expanded surface"
            signal="player_expand / transport"
            views={{
              default: (
                <div className="flex justify-center">
                  <DevicePlayer />
                </div>
              ),
              "with collapse": (
                <div className="flex justify-center">
                  <DevicePlayer onCollapse={() => undefined} />
                </div>
              ),
            }}
          />
        </DsSection>

        <DsSection index="02" title="MiniPlayerBar">
          <StatePanel
            name="MiniPlayerBar — compressed surface"
            signal="player_expand, seek"
            views={{
              default: (
                <div className="relative h-24 rounded-lg border border-border overflow-hidden [&>div]:absolute [&>div]:bottom-2">
                  <MiniPlayerBar onExpand={() => undefined} />
                </div>
              ),
            }}
          />
        </DsSection>
      </div>
    </MockStudioProvider>
  );
}
```

Same caveat as Step 3 applies to `MiniPlayerBar`'s `fixed` root here — if the `[&>div]:absolute` override loses the specificity race, give `MiniPlayerBar` the same optional `inGallery?: boolean` prop swapping `fixed` for `absolute`.

- [ ] **Step 5: Create `components/content/page.tsx`**

```tsx
"use client";

import { useState } from "react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import { DsSection } from "@/components/studio/ds/blocks";
import StatePanel from "@/components/studio/ds/StatePanel";
import { TagChip, FilterChipRow } from "@/components/studio/screens/TagChip";
import ViewToggle, { type TrackView } from "@/components/studio/screens/ViewToggle";
import SortControl from "@/components/studio/screens/SortControl";
import TrackMenu from "@/components/studio/screens/TrackMenu";
import { LIBRARY_FILTERS, type LibraryFilter, type TrackSort } from "@/components/studio/screens/library-utils";

function Demos() {
  const [filter, setFilter] = useState<LibraryFilter>("playlists");
  const [view, setView] = useState<TrackView>("rows");
  const [sort, setSort] = useState<TrackSort>("recent");

  return (
    <div>
      <h1 className="type-h1 mb-8">Content</h1>

      <DsSection index="01" title="Chips">
        <StatePanel
          name="TagChip / FilterChipRow"
          signal="library_filter, tag_tap"
          views={{
            default: (
              <FilterChipRow
                options={LIBRARY_FILTERS}
                value={filter}
                onChange={setFilter}
              />
            ),
            static: (
              <div className="flex gap-2">
                <TagChip label="lofi" />
                <TagChip label="night" active />
              </div>
            ),
          }}
        />
      </DsSection>

      <DsSection index="02" title="List controls">
        <StatePanel
          name="ViewToggle + SortControl"
          signal="view_switch, sort_switch"
          views={{
            default: (
              <div className="flex items-center gap-3">
                <ViewToggle view={view} onChange={setView} />
                <SortControl sort={sort} onChange={setSort} />
              </div>
            ),
          }}
        />
      </DsSection>

      <DsSection index="03" title="TrackMenu">
        <StatePanel
          name="TrackMenu"
          signal="row_share, row_add, row_like"
          views={{ default: <TrackMenu trackTitle="Midnight Snowfall" /> }}
        />
      </DsSection>
    </div>
  );
}

export default function ContentComponentsPage() {
  return (
    <MockStudioProvider>
      <Demos />
    </MockStudioProvider>
  );
}
```

- [ ] **Step 6: Create `components/drawers/page.tsx`**

```tsx
"use client";

import { useState } from "react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import { DsSection } from "@/components/studio/ds/blocks";
import StatePanel from "@/components/studio/ds/StatePanel";
import { Button } from "@/components/ui/button";
import PlaylistDrawer from "@/components/studio/screens/PlaylistDrawer";
import CreatePlaylistDrawer from "@/components/studio/screens/CreatePlaylistDrawer";
import {
  LIKED_SONGS,
  type MockCollection,
} from "@/components/studio/screens/mock-data";

function Demos() {
  const [collection, setCollection] = useState<MockCollection | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <h1 className="type-h1 mb-8">Drawers</h1>

      <DsSection index="01" title="PlaylistDrawer">
        <StatePanel
          name="PlaylistDrawer — 95vh detail"
          signal="collection_open"
          views={{
            default: (
              <Button onClick={() => setCollection(LIKED_SONGS)}>
                Open Liked Songs
              </Button>
            ),
          }}
        />
      </DsSection>

      <DsSection index="02" title="CreatePlaylistDrawer">
        <StatePanel
          name="CreatePlaylistDrawer — 90vh form"
          signal="collection_create"
          views={{
            default: (
              <Button onClick={() => setCreating(true)}>Open create form</Button>
            ),
          }}
        />
      </DsSection>

      <PlaylistDrawer
        collection={collection}
        onOpenChange={(o) => {
          if (!o) setCollection(null);
        }}
      />
      <CreatePlaylistDrawer open={creating} onOpenChange={setCreating} />
    </div>
  );
}

export default function DrawersComponentsPage() {
  return (
    <MockStudioProvider>
      <Demos />
    </MockStudioProvider>
  );
}
```

- [ ] **Step 7: Create `components/profile/page.tsx`**

```tsx
"use client";

import { useState } from "react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import { DsSection } from "@/components/studio/ds/blocks";
import StatePanel from "@/components/studio/ds/StatePanel";
import ProfileBadge from "@/components/studio/screens/ProfileBadge";
import { MenuList, MenuRow } from "@/components/studio/screens/MenuList";
import StatCard from "@/components/studio/screens/StatCard";
import ToggleSwitch from "@/components/studio/screens/ToggleSwitch";
import SocialAuthButtons from "@/components/studio/screens/SocialAuthButtons";
import SignInPrompt from "@/components/studio/screens/SignInPrompt";
import { MOCK_USER } from "@/components/studio/screens/mock-data";
import { BarChartIcon } from "@radix-ui/react-icons";

function Demos() {
  const [on, setOn] = useState(true);

  return (
    <div>
      <h1 className="type-h1 mb-8">Profile &amp; States</h1>

      <DsSection index="01" title="ProfileBadge">
        <StatePanel
          name="ProfileBadge"
          signal="profile_open"
          views={{ default: <ProfileBadge user={MOCK_USER} /> }}
        />
      </DsSection>

      <DsSection index="02" title="MenuList">
        <StatePanel
          name="MenuRow / MenuList"
          signal="hub_navigate"
          views={{
            default: (
              <MenuList>
                <MenuRow
                  href="#"
                  icon={<BarChartIcon />}
                  label="Listening stats"
                  hint="Minutes, top artists, daily patterns"
                />
              </MenuList>
            ),
          }}
        />
      </DsSection>

      <DsSection index="03" title="StatCard">
        <StatePanel
          name="StatCard"
          signal="—"
          views={{
            default: (
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <StatCard label="This week" value="312 min" />
                <StatCard label="Streak" value="9 days" hint="listened every day" />
              </div>
            ),
          }}
        />
      </DsSection>

      <DsSection index="04" title="ToggleSwitch">
        <StatePanel
          name="ToggleSwitch"
          signal="privacy_toggle"
          views={{
            default: (
              <ToggleSwitch
                checked={on}
                onCheckedChange={setOn}
                aria-label="Demo toggle"
              />
            ),
          }}
        />
      </DsSection>

      <DsSection index="05" title="Auth & gates">
        <StatePanel
          name="SocialAuthButtons / SignInPrompt"
          signal="auth_continue"
          views={{
            auth: (
              <div className="max-w-sm">
                <SocialAuthButtons />
              </div>
            ),
            gate: <SignInPrompt />,
          }}
        />
      </DsSection>
    </div>
  );
}

export default function ProfileComponentsPage() {
  return (
    <MockStudioProvider>
      <Demos />
    </MockStudioProvider>
  );
}
```

- [ ] **Step 8: Verify + commit**

Run: `npm run lint` and `npm run test`
Expected: clean. Preview `/design-system/components` → six category cards, each subpage renders fast.

```bash
git add apps/web/app/design-system/components
git commit -m "feat(studio): categorized components gallery with new IA components"
```

---

### Task 14: Screens index, chrome cleanup, final verification

**Files:**
- Modify: `apps/web/app/design-system/screens/page.tsx`
- Delete: `apps/web/components/studio/screens/NowPlayingBar.tsx`, `PreviewChrome.tsx`, `PreviewMenu.tsx`

- [ ] **Step 1: Update the screens index cards**

Replace the `SCREENS` array in `screens/page.tsx`:

```tsx
const SCREENS: {
  href: string;
  title: string;
  mirrors: string;
  texture: TextureName;
}[] = [
  {
    href: "home",
    title: "Home",
    mirrors: "Jump back in + new releases, global player.",
    texture: "tx-k2-vinyl",
  },
  {
    href: "search",
    title: "Search",
    mirrors: "Live results, you-might-like, explore tiles.",
    texture: "tx-k2-static",
  },
  {
    href: "library",
    title: "Library",
    mirrors: "Type chips, pinned Liked Songs, playlist drawers.",
    texture: "tx-k-marble",
  },
  {
    href: "profile",
    title: "Profile",
    mirrors: "Hub → view, stats, recents, settings, privacy.",
    texture: "tx-k-silk",
  },
  {
    href: "auth",
    title: "Auth",
    mirrors: "One aurora door — Google or Facebook, no forms.",
    texture: "tx-k2-horizon",
  },
  {
    href: "credits",
    title: "Credits",
    mirrors: "Aurora author card + social badges.",
    texture: "tx-k2-topo",
  },
];
```

- [ ] **Step 2: Delete the superseded chrome**

```bash
git rm apps/web/components/studio/screens/NowPlayingBar.tsx apps/web/components/studio/screens/PreviewChrome.tsx apps/web/components/studio/screens/PreviewMenu.tsx
```

Then `npm run lint` — nothing should import them anymore (Task 4 removed the layout usage).

- [ ] **Step 3: Full verification**

Run, in order:

1. `npm run test` — all suites pass.
2. `npm run lint` — clean.
3. `npx tsc --noEmit` (or `npm run build` if a typecheck script is absent) — no type errors.
4. Preview walkthrough (use the browser preview tools, mobile AND desktop widths):
   - `/design-system/screens` → six cards.
   - Auth: Continue with Google → lands on Home signed in.
   - Home: shelves render; play a release → mini bar appears; tap bar → device player jelly-in; backdrop tap collapses.
   - Search: idle shelves; type "aoi" → track results; explore tile fills query.
   - Library: chips filter; Liked Songs first with pin; open drawer (back, play, shuffle, tags, view toggle, sort, menus); create playlist → appears in list.
   - Profile: hub rows; each subpage renders; settings sign-out → auth; Library/Profile now gated; Home hides "Jump back in".
   - Credits: unchanged.

- [ ] **Step 4: Commit**

```bash
git add -A apps/web
git commit -m "feat(studio): new screens index, retire preview chrome"
```

---

## Spec coverage checklist (self-review)

- Route map incl. `profile/view` — Tasks 4, 7, 9–12 ✓
- Merged social-only auth, mock session flip — Task 7 ✓
- 3-tab mobile bar, avatar-in-header → profile, desktop sidebar with avatar footer — Task 4 ✓
- Global player compressed/expanded, jelly motion, reduced-motion fallback — Tasks 3, 5 ✓
- Guest browsing (Home/Search open, Library/Profile gated, recents hidden) — Tasks 9–12 ✓
- Library chips, pinned Liked Songs, playlist drawer (back/count/play/shuffle/tags/view/sort/add/menus), create drawer — Tasks 8, 11 ✓
- Profile hub + stats/recents/settings/privacy with rich listening-behavior mock data — Tasks 1, 12 ✓
- Categorized gallery, every new component registered — Task 13 ✓
- Credits untouched — no task touches it ✓
- Mock data & provider slices, tests following existing patterns — Tasks 1, 2, 5, 7, 11 ✓
