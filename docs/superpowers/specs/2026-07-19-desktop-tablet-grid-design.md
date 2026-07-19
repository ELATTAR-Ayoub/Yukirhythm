# Desktop & Tablet Grid Shell — Design

Date: 2026-07-19
Branch: `v2_2026`
Status: approved, ready for implementation planning

## Problem

The mobile UI in the design studio (`/design-system/screens/**`) is good. The desktop
and tablet experience is not — it is the phone layout centered in a `max-w-6xl`
column. Responsive treatment across the whole studio-screens tree is 7 Tailwind
breakpoint occurrences plus one `hidden md:flex` sidebar.

Desktop needs a real multi-column application shell: a persistent library, a routed
content surface, a persistent now-playing panel, and a full-width playback bar.

## Scope

**In scope:** the design studio only — `app/design-system/screens/(app)/**` and
`components/studio/**`, running on `MockStudioProvider`.

**Out of scope:** the production app (`app/page.tsx`, `/login`, `/profile/[id]`,
`/credits`), Firebase wiring, the Zustand `usePlayerStore`. Porting this shell to
production data is a separate, later phase.

**Mobile is not redesigned.** Below `md` (768px) the existing layout — bottom tab
bar, drawers, `MiniPlayerBar` — must behave exactly as it does today. Any change to
mobile behavior is a regression.

## Frame

Viewport is locked to `100vh` with `overflow: hidden`. Three fixed chrome elements
frame one flexible middle band. Nothing scrolls the document; each column owns its
own scroll container.

```
┌──────────────────────────────────────────────────────────┐
│ HEADER  56px   [logo]   [home][search bar]   [avatar▾]   │
├──────────┬────────────────────────────┬──────────────────┤
│          │                            │                  │
│ LIBRARY  │      PAGE  (routed)        │   NOW PLAYING    │
│  340px   │        flex-1              │      340px       │
│          │                            │                  │
│ scrolls  │        scrolls             │     scrolls      │
├──────────┴────────────────────────────┴──────────────────┤
│ PLAYBACK BAR  88px    art │ ◀ ▶ ▶▶ seek │ vol queue ▤    │
└──────────────────────────────────────────────────────────┘
```

Each column is its own rounded surface (`rounded-2xl`, `bg-card`) on the
`background`, separated by `gap-2`, with an `8px` page inset. The visible gap
between panels — not internal dividers — is what makes the grid read as a panel
system.

The middle band is `flex` with `min-h-0` so that flex children can actually scroll.
Each column is `overflow-y-auto` wrapped in the existing `FadeScrollArea` for edge
fades.

### Breakpoints

`1440px` is the three-column threshold, registered as a custom `3xl` breakpoint in
`globals.css`. It is deliberately above `xl`: with two 340px rails, 1280px leaves
the middle column ~570px, too narrow for the playlist track table.

| Range | Layout |
|---|---|
| `< md` (768) | Untouched mobile: bottom tabs, drawers, `MiniPlayerBar` |
| `md – 1440` | Library 340 + Page. No right rail. Bottom bar expands into `DevicePlayer`. |
| `≥ 1440` | Library 340 + Page + Now Playing 340. Bottom bar does **not** expand. |

Rationale for the bottom bar rule: at `3xl` the right rail *is* the player, so the
fullscreen overlay would be redundant. Below `3xl` there is no right rail, so
expansion remains the only route to the vinyl player.

### System routes

`/profile`, `/profile/view`, `/profile/stats`, `/profile/recents`,
`/profile/settings`, `/profile/privacy`, `/credits`, `/terms`.

On these routes the `(app)` layout drops **both** rails and renders the page
centered at `max-w-[880px]`. Header and playback bar remain, so playback continues
and the user can navigate back. The intent is that "serious" pages read as a
distinct context, not as another music surface.

## Architecture

### Route swapping

The middle column swaps by **real routes**, not in-shell view state. Clicking a
playlist navigates to `/playlist/[id]`; the URL reflects what is displayed, the
back button works, and refresh survives.

New route: `app/design-system/screens/(app)/playlist/[id]/page.tsx`.
Existing routes reused as-is: `home`, `search`, `library`, all profile pages.

Mobile keeps using `PlaylistDrawer` — it is not routed. Both surfaces render the
same `CollectionDetail` body.

### Drawer / panel duality

Mobile presents playlist, queue, and add-music as vaul drawers. Desktop needs the
same content inline. CSS alone cannot do this swap: a vaul drawer either mounts or
it does not, and rendering both would double-mount state (two seek sliders, two
spinning vinyls).

Resolution: feature bodies are extracted from their drawer wrappers into plain
presentational components (`QueuePanel`, `AddMusicPanel`), so each feature has
exactly one definition. The drawers become thin wrappers that mobile keeps using;
the desktop rails render the same panels inline. Because the rails themselves are
gated by a Tailwind `3xl:` class, no runtime breakpoint check is needed to choose
between the two presentations.

A `useIsDesktop()` matchMedia hook still exists, for the two places where the
*shape* of a render differs rather than its styling: swapping `MiniPlayerBar` for
`PlaybackBar`, and switching home shelves from drag-scroller to grid.

`useIsDesktop()` must be SSR-safe: it returns `false` on the server and on the
first client render, then updates in an effect. First paint is therefore the mobile
layout; this is acceptable and avoids hydration mismatch. The layout shell itself
uses Tailwind breakpoint classes (not the hook) so the *grid* has no flash — the
hook governs only drawer-vs-inline mounting.

### New files

```
app/design-system/screens/(app)/
  layout.tsx                    ← rewritten: the grid
  playlist/[id]/page.tsx        ← new route

components/studio/shell/
  StudioHeader.tsx              logo · Home + search · avatar menu
  LibraryRail.tsx               left column
  NowPlayingRail.tsx            right column
  PlaybackBar.tsx               full-width bottom bar
  useIsDesktop.ts               matchMedia hook, SSR-safe
  routes.ts                     route constants + isSystemRoute predicate
```

### Extractions (behavior-preserving)

- `AddMusicDrawer` → body extracted as `AddMusicPanel`; the drawer becomes a thin
  wrapper around it.
- `QueueDrawer` → body extracted as `QueuePanel`; same wrapper treatment.
- `DevicePlayer` → gains a `docked` prop. `docked` swaps `fixed inset-0 z-50` for
  `relative w-full`, drops the collapse chevron, and drops the Escape/focus-restore
  modal behavior. Vinyl, arc transition, seek, and transport internals are
  unchanged.
- `CollectionDetail` is already the shared playlist body and needs no extraction —
  the new route consumes it directly.
- `TrackRow` → gains a desktop variant (see below).
- `RailShelf` → gains a desktop mode that wraps into a grid instead of a horizontal
  drag-scroller.

## Column contents

### Header (56px, full width)

- **Left:** logo.
- **Center:** Home icon-button and a search field capped at `max-w-[480px]`.
  Focusing the field or typing routes the middle column to `/search`. With an empty
  query the search page shows recent searches, playable directly; results appear as
  the user types.
- **Right:** avatar. Clicking opens a dropdown: Profile, Stats, Recents, Settings,
  Privacy, Credits, Sign out. Every item routes the middle column, and because all
  of them are system routes, choosing one collapses the rails.

### Library rail (340px)

The existing `/library` page content, docked: `BadgeSwitcher` filter
(All / Playlists / Artists / Albums), search-within-library, `SortControl`, then the
collection list. Rows use `MediaCard variant="extended"` at size `sm`.

- Clicking a row routes the middle column to `/playlist/[id]`. It does **not** start
  playback.
- The row matching the current route holds a persistent selected state.
- Pinned collections sort first, as they do today.
- A `+ Create` button in the rail header opens `CreatePlaylistDrawer` unchanged.

### Page column (flex-1)

- `/home` — recently played, made for you, shelves. `RailShelf` in grid mode.
- `/playlist/[id]` — see below.
- `/search` — existing search page at a wider grid.
- system routes — rails collapse, page centers at `max-w-[880px]`.

### Now Playing rail (340px)

One scroll container, top to bottom:

1. `DevicePlayer docked` — vinyl, arc transition, seek, transport.
2. **Up Next** — queue preview, reorderable. "Open queue" expands to the full
   `QueuePanel` in place.
3. **Add Music** — `AddMusicPanel`, targeting whichever collection the page column
   is currently showing. When the page column is home, search, or a system route,
   the panel renders disabled with a hint explaining that a playlist must be open.

### Playback bar (88px, full width)

Spotify-shaped: art + title + artist on the left, transport centered above a seek
slider, and volume / queue toggle / right-rail toggle on the right. At `≥ 3xl` it
does not expand on click. Below `3xl` it retains today's tap-to-expand behavior.

## Playlist page

The single deliberate deviation from Spotify: the hero is a **vinyl**, not a square
card.

```
┌────────────────────────────────────────────┐
│  ╭─────╮                                   │
│  │ ◉   │   PUBLIC PLAYLIST                 │
│  │     │   Late Night Drive                │
│  ╰─────╯   34 tracks · 2 hr 11 min         │
│            [▶]  [⇄]  [+]  [···]            │
├────────────────────────────────────────────┤
│  #  TITLE            ALBUM      ADDED   ⏱  │
│  1  ...                                    │
```

- **Hero vinyl:** 200px, reusing `SpinningDisc` with the collection art on the
  label, tilted slightly. It spins only when this collection is the active
  `playingCollection`; otherwise it is static.
- **Hero background:** a gradient sampled from the collection art, overlaid with
  `AnimatedTexture`'s dithered treatment rather than a plain fade — this is the
  brand's existing texture language.
- **Track rows:** desktop `TrackRow` variant with album and date-added columns,
  hover row highlight, index→play-button swap on hover via `IconSwap`, and
  `TrackMenu` at the right edge. Single click selects; double click plays. The
  currently-playing row replaces its index with `EqIndicator`.

## Design constraints

- All numerals render through `DataText` (OffBit Dot face). No exceptions.
- Any alternating icon uses `IconSwap`.
- Colors come from the semantic tokens in `globals.css`; no raw hex in components.
- Motion uses the existing `--dur-*` and `--ease-*` tokens.
- `globals.css` restores Tailwind v3 bare-`border` color behavior and forces
  `outline: none !important` on popper/dialog/menu surfaces. Both are deliberate —
  do not "fix" them.
- Dark is the product default; every new surface must be checked in both themes.

## Testing

- Unit tests (Vitest) for `useIsDesktop` — SSR default, threshold crossing,
  listener cleanup.
- Unit test for the system-route predicate that decides rail collapse.
- Existing tests for `mock-data`, `slots`, and `choreography-math` must keep
  passing.
- Manual verification via the browser preview at three widths — 375, 1024, 1600 —
  in both themes, confirming: mobile is byte-for-byte unchanged in behavior, the
  tablet band has no right rail and an expanding bottom bar, and the desktop band
  has three independently scrolling columns with a non-expanding bottom bar.

## Deferred

- Keyboard shortcuts (space to play, `/` to focus search).
- Drag-and-drop of tracks from the page column into library rows.
- Collapsed icon-strip library mode.
- Porting the shell to the production app.
