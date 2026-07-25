# First-run experience & player fixes

**Date:** 2026-07-24
**Status:** approved for planning

Nine changes to how the app receives a brand-new user and how the player
responds to direct interaction, approved as a batch. The first-run items exist
because today a signed-out visitor can browse the whole app and a brand-new
account lands on an empty queue; the player items exist because two of its
controls look interactive but aren't wired to anything real.

No playlist is seeded for new users — the owner explicitly rejected filling
the library without consent. The library starts empty.

---

## A. Login gate — signed out means the login page, nothing else

### The defect

`app/page.tsx` sends signed-out visitors to `/home`, and every `(studio)`
route renders happily without a user. The login screen at `/auth` is entirely
optional.

### Design

Auth is client-side Firebase (no session cookie), so the gate is client-side
to match — a server middleware cannot verify a token it never receives.

**`components/studio/shell/AuthGate.tsx`** (new, client): reads
`useAuthState()`.

- `loading` → render the shell's loading presentation (reuse the
  `app/loading.tsx` treatment), never children. Treating "not yet known" as
  signed out would bounce every returning user through `/auth` on a cold load.
- settled, no user → `router.replace(AUTH)` and keep rendering the loading
  state (never children, no flash of gated content).
- settled, user → children.

Mounted inside `(studio)/layout.tsx` wrapping the Shell, so every studio
route — home, search, library, playlist, queue, create, profile — is gated by
one component. Signing out while inside the app trips the same gate and lands
on `/auth`.

**Root `app/page.tsx`:** signed out → `replace(AUTH)` (today: `/home`).

**`app/auth/page.tsx`:** an already-signed-in visitor is redirected to `/`
(effect on `useAuthState`, same "wait for `loading` to settle" rule).

**Stays public:** `/terms` (the login page links to it), `/credits`,
`/design-system` and `/deck-lab` (dev galleries, not linked from the app).

## B. New accounts land on Search

### Design

Root `app/page.tsx` already distinguishes a cold account (no playback
`trackId`, empty queue). Its cold destination changes from `QUEUE` to
`SEARCH`. Warm accounts keep going to `HOME`, failed reads keep going to
`HOME`.

`app/auth/page.tsx`'s `onAuthed` pushes `/` instead of `/home`, so the one
root decision applies to fresh sign-ins too: new → Search, returning → Home.

## C. "You might like" and "New releases" actually produce music

### The defect

Both feed routes' cold-start paths query the `tracks` collection ordered by
`stats.viewCount`. That query needs the composite index
(`isEmbeddable ASC, stats.viewCount DESC`) — present in
`firestore.indexes.json` but likely **not deployed** — and on a thin catalogue
the pool is empty even when the index exists. Every failure is swallowed:
server-side the routes just return few/no items, client-side
`StudioProvider`'s `.then(…, () => {})` drops the error. The shelves render
blank and nobody finds out why.

### Design

**`lib/catalog/cold-start.ts`** (new): curated fallback queries and one
helper.

- `coldStartTracks(provider, queries, limit)` — runs provider searches for
  the given queries through the same `cacheKey`/`readCache`/`writeCache`
  helpers the catalog search route uses (so cold loads don't hammer the
  scraper), filters to `isEmbeddable`, ingests via `ingestTracks`, returns
  deduped `Track[]`.
- Query lists per feed, e.g. new releases: "new music this week",
  "new songs 2026"; you-might-like: "top hits", "popular songs". Constants,
  tunable later.

**`app/api/feed/new-releases/route.ts`:** the popular-tracks Firestore
fallback is wrapped — on throw (missing index) or a result below the existing
`< 6` threshold, call `coldStartTracks` and feed those into the candidate
pool. Failures are `console.error`ed with the route name, never swallowed
silently.

**`app/api/feed/you-might-like/route.ts`:** same treatment around
`coldSeed()` — when no seed exists (empty catalogue) or the related-tracks
radio comes back empty, `coldStartTracks` fills the pool directly so the
route still answers with music.

The feeds become self-priming: the first cold call ingests real tracks into
Firestore, which warms every later call and the catalogue itself.

**Client (`StudioProvider`)**: feed failures get a `console.warn` instead of
`() => {}` so a broken feed is diagnosable from the browser console.

**Owner step (not Claude's):** `firebase deploy --only firestore:indexes` —
non-destructive, separate from the rules deploy, which stays rules-last.

## D. Skeletons while the shelves load

### Design

`MockStudioValue` gains `feedsLoading: boolean` (one flag: the three feed
fetches start together in the same effect; per-feed flags buy nothing the UI
shows). `StudioProvider` sets it true when the fetch effect starts for a
signed-in user and false when the you-might-like/new-releases pair settle
(`Promise.allSettled` around the existing calls). The mock provider
(`MockStudioProvider`) supplies `feedsLoading: false`.

Search's two shelves and Home's "New releases" render `SkeletonCard` rows
(6 per shelf) inside the existing `RailShelf` while `feedsLoading`. A feed
that settles empty renders one quiet muted line ("Nothing here yet — play
something and check back.") instead of a bare heading over nothing.

## E. Search idle order

You might like → New releases → Browse by mood. (Today: You might like →
mood → New releases.) Pure JSX reorder in `(studio)/search/page.tsx`.

## F. Shelf click → playback visible in the right rail

Clicking a shelf card already calls `play(track)`, and the rail's docked
`DevicePlayer` reads the same context — at ≥1440px (`3xl`) this should
already work end-to-end. The browser walkthrough verifies it; anything found
broken is expected to share item H's root cause (the seek/ref wiring), not to
need new design. Below `3xl` the rail is hidden by design; playback shows in
the bottom bar (desktop) or MiniPlayerBar (mobile) instead.

## G. Like replaces Loop in the device player

### The context

What the owner calls "shuffle" is the **Loop** button (crossed-arrows icon) —
leftmost in `Transport`'s cluster, and decorative today: local `useState`,
wired to nothing. `LikeButton` already exists and takes `trackId`/
`trackTitle`.

### Design

`Transport` gains `leading?: "loop" | "like"` (default `"loop"`, preserving
every current call site). With `"like"` the loop slot renders
`<LikeButton trackId={nowPlaying.id} trackTitle={nowPlaying.title} />`,
disabled-looking placeholder (`LikeButton` with no track renders nothing, so
an inert outline heart `PlayerButton disabled` holds the slot) when idle so
the cluster keeps its width.

- `DevicePlayer` (docked rail player **and** its fullscreen overlay form on
  smaller screens) passes `leading="like"`.
- `PlaybackBar` (desktop bottom bar) keeps the default — Loop stays there.
- `MiniPlayerBar` uses `compact`, which drops the slot entirely — unchanged.

Mobile consequence, accepted: with the overlay player showing Like, mobile
has no Loop control — it was non-functional anyway.

## H. Click-to-jump on the seek bar

### The defect

The seek bar is a Radix slider; clicking the track already moves the thumb
and fires `onValueChange` → `seek()`. Yet clicking doesn't land playback at
the clicked second. The suspected root cause is downstream: `StudioProvider`
loads `react-player` (v2, class component) via `next/dynamic` and calls
`playerRef.current?.seekTo(...)` — if that ref never attaches through the
dynamic wrapper, every seek silently no-ops and the bar snaps back on the
next `onProgress`, which reads as "clicking does nothing".

### Design

Diagnose empirically in the browser first (log whether the ref attaches and
whether `seekTo` exists), then fix the actual break. Candidate fixes, in
preference order: attach the ref correctly through the dynamic wrapper; or
import `react-player` directly in a small client-only child component so the
class ref attaches natively. The acceptance test is behavioural, not
structural: click (desktop) and tap (mobile) at any point of the bar in both
`PlaybackBar` and `DevicePlayer` → playback audibly continues from that
minute:second and the thumb stays where it was put.

## I. Search fires on Enter

### Design

`(studio)/search/page.tsx`: the input becomes a `<form>` submit —
`type="search"`, `enterKeyHint="search"`, so mobile keyboards offer a
Search/Go key. Typing only updates local state; clearing the field (or
submitting it empty) calls `clearSearch()`. Submit calls `search(q)`. Mood
tiles keep searching immediately on click (a click is an explicit act).

`StudioProvider.search()`'s 550 ms debounce exists only because the old page
searched per keystroke. Once no caller fires per keystroke it is pure added
latency — the plan verifies the remaining callers (`PlayerSearchDrawer`,
`AddMusicPanel` use `searchTracks`, which is separate) and then removes the
timer, keeping the async shape. The desktop header's search field gets the
same treatment — it routes to /search on focus as before, but only searches
on Enter; the provider-side 550 ms debounce is removed outright since no
caller fires per keystroke anymore.

---

## Mobile

Every item must work at the mobile layout (below `md`: no rails, no header,
BottomTabBar + MiniPlayerBar chrome):

- The gate and redirects are route-level — width-independent by construction,
  verified at 375×812 anyway.
- Search shelves are horizontal scrollers below desktop; skeletons render in
  the same scroller shape (fixed-width `SkeletonCard`s), so no layout jump.
- The Like control reaches mobile through the fullscreen `DevicePlayer`
  overlay (item G) — no separate mobile wiring.
- Seek click-to-jump is tap-to-jump; Radix handles pointer events, item H's
  acceptance check runs on the mobile viewport too.
- Enter-to-search on mobile is the keyboard's Search key (`enterKeyHint`).

## Error handling

- Gate: auth errors surface as Firebase's `loading→settled` transitions —
  never render gated content while unsettled; a failed playback read on the
  root page still lands somewhere sane (`HOME`).
- Feeds: server logs on fallback failure; client `console.warn`; UI shows the
  quiet empty line, never a spinner that spins forever (`feedsLoading` is
  cleared in a `finally`-equivalent settle).
- Seek: out-of-range clicks clamp (existing `seek()` already clamps).

## Testing

- Unit: root-page redirects (signed out → `/auth`, cold → `/search`, warm →
  `/home`); AuthGate render states; auth-page signed-in redirect; feed-route
  fallbacks (mock provider — throw-index case and thin-catalogue case);
  `Transport leading` variants; search page Enter-submit/clear/order;
  skeleton rendering under `feedsLoading`.
- Existing suites updated where behaviour changed (`page.test.tsx`,
  `(studio)/layout.test.tsx`, `auth/page.test.tsx`, `search/page.test.tsx`,
  `DevicePlayer.test.tsx`, `PlaybackBar.test.tsx`, feed integration tests).
- Browser walkthrough against the emulator, desktop and 375×812: fresh
  sign-in → lands on Search → both shelves skeleton then fill → click a card
  → rail/mini player shows it → like it from the player → click mid-seek-bar
  → playback jumps.
