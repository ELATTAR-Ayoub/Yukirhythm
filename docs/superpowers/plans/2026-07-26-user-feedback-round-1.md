# User Feedback Round 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.

**Goal:** Ten fixes/features reported by real users after launch: player-like→playlist dialog, dialog feedback + mobile fit, working create-flow search with feedback, the "Collection not found" race, queue-preserving play, edge-disabled transport, cached+refreshable independent feeds (both on Home, Liked Songs in Jump back in), and search "See more".

**Branch:** `v2_2026`. Conventions from `docs/superpowers/plans/2026-07-24-first-run-and-player-fixes.md` (TDD, commit per task, run from `apps/web`, emulator for integration). All quality gates (`test`, `typecheck`, `lint`, `format:check`) must stay at zero errors.

**Key components (read before each task):** `StudioProvider.tsx` (real provider), `MockStudioProvider.tsx` (context type + mock), `screens/LikeButton.tsx`, `screens/AddToPlaylistDialog.tsx`, `screens/PlaylistDrawer.tsx`, `screens/CreatePlaylistFlow.tsx`/`CreatePlaylistForm.tsx`, `screens/AddMusicPanel.tsx` (the canonical add-music row UX), `screens/Transport.tsx`, `screens/queue-utils.ts`, `app/(studio)/search/page.tsx`, `app/(studio)/home/page.tsx`, `app/(studio)/create/page.tsx`, `RailShelf.tsx`, `FeedShelf.tsx`, api routes under `app/api/feed/` and `app/api/catalog/search/`.

---

### Task B1: Player ♥ second click opens Add to playlist

**Files:** `screens/LikeButton.tsx` (new optional prop), `screens/Transport.tsx`, `screens/AddToPlaylistDialog.tsx` (only if its trigger API needs a controlled-open variant), tests.

- `LikeButton` gains `onAlreadyLiked?: () => void` (WHY comment: the player's heart doubles as the door to playlists once a track is already saved). Behavior: not liked → toggleLike as today; already liked AND `onAlreadyLiked` present → call it INSTEAD of unliking (unliking then happens inside the dialog via the Liked Songs row). Call sites without the prop keep exact current toggle behavior (rows, queue etc. unchanged).
- `Transport` (leading="like" branch) renders LikeButton with `onAlreadyLiked` opening `AddToPlaylistDialog` for `nowPlaying` (controlled `open` state local to Transport). Check AddToPlaylistDialog's current API (likely trigger-child based) — add a controlled variant if needed without breaking existing call sites.
- Tests: Transport.test — when track already liked, clicking the heart opens the dialog (assert dialog title visible) and does NOT unlike; when not liked, clicking likes as before. LikeButton.test — prop absent → toggles; prop present + liked → callback fired, no toggle.

Commit: `feat(player): a liked track's heart opens Add to playlist`

### Task B2: Add-to-playlist dialog — feedback + mobile fit

**Files:** `screens/AddToPlaylistDialog.tsx`, its test; possibly `MockStudioProvider.tsx`/`StudioProvider.tsx` if toggle functions need to return promises.

- Every playlist row's check control shows a pending state while its mutation is in flight (row-scoped spinner replacing the checkbox, control disabled) and settles to the new state. `toggleTrackInCollection`/`toggleLike` in StudioProvider currently fire-and-forget → make them return the promise (context type update in MockStudioValue; mock provider resolves immediately). Row tracks its own pending id set.
- **Owner directive:** the Add-to-playlist surface must be the shadcn **Dialog** (`components/ui/dialog`) on every viewport — if it currently renders as (or falls back to) a Drawer/sheet anywhere, convert it. Not a drawer.
- Mobile: the dialog must fit 375×812 — constrain (`max-h-[80dvh]`, internal scroll list, `w-[calc(100vw-2rem)] max-w-md`), verify no horizontal overflow. Check both this dialog AND `PlaylistDrawer` (bug 3 says "the actual playlist dialogue on mobile ... way overflowing") — read PlaylistDrawer and apply the same discipline (drawer content taller than viewport → internal scroll).
- Tests: pending state appears on click and resolves (deferred mock promise); a second row can be toggled while the first is pending.

Commit: `fix(playlists): add-to-playlist gives feedback and fits small screens`

### Task B3: Create-playlist step 2 — real search, canonical rows, always feedback

**Files:** `screens/CreatePlaylistFlow.tsx` (and whatever step-2 renders — read it), reuse `screens/AddMusicPanel.tsx` or extract its row list into a shared component if it is not already shared; tests.

- Step 2's search must use the SAME engine as everything else: context `searchTracks(query)` (catalog search, Enter-to-search semantics with a form, `type="search"`, `enterKeyHint`).
- Result rows: the same component/pattern AddMusicPanel uses for queue/playlist adds (TrackRow + trailing add control). If AddMusicPanel's list is page-coupled, extract a shared `AddTrackList` used by both (one owner for this UX, like FeedShelf did for shelves).
- Add button per row: pending spinner while the add applies (for the create flow the add is local state → still show the transition; keep the API pending-capable), then switches to an added/check state. Clicking the check REMOVES the track (with feedback if async). The picked tracks render as a removable list at the bottom of the step ("Added — N tracks"), each row with the checked control to remove.
- Tests: search fires on submit; add → row flips to added + appears in the bottom list; clicking check removes from both; pending states shown for deferred promises.

Commit: `fix(create): step two searches for real, adds with feedback, removes with a tap`

### Task B4: "Collection not found" after create

**Files:** `StudioProvider.tsx` (`createCollection`), `screens/CreatePlaylistFlow.tsx` / `create/page.tsx` (navigation on finish), `MockStudioValue` type, tests.

- Root cause to verify then fix: `createCollection` returns an optimistic `pending-<uuid>` object and the flow navigates to `playlistHref(optimistic.id)`; when `refreshLibrary` replaces it with the server id, the page looks up a collection that no longer exists → "Collection not found".
- Fix: `createCollection` becomes async — await the server create (`backend.collections.create` returns the created collection/id — check `lib/api/backend.ts`), then refreshLibrary, then return the REAL collection; the flow awaits it (button shows its pending state meanwhile — it likely already has one; verify) and navigates to the real id. Keep an optimistic entry in the rail if cheap, but the navigation target must be the server id. Mock provider: keep synchronous create but return the same shape (Promise).
- Integration-flavored test: flow finish → navigation called with the SERVER id, not a `pending-` id; collection detail resolves.

Commit: `fix(create): navigate to the playlist the server actually created`

### Task B5: Loose play appends to the running queue

**Files:** `StudioProvider.tsx` (`play`), `screens/queue-utils.ts` if a helper fits, `MockStudioProvider.tsx` (mirror the semantics for the mock), tests (`StudioProvider.test.tsx` + `MockStudioProvider.test.tsx`).

- New semantics for `play(track)` with NO `from` collection: if a queue is already loaded AND `playingCollection` is null (the user's own ad-hoc queue), do NOT replace the queue — append the track to the END (dedupe: if it's already in the queue, jump to its position instead) and start playing it (persist via the existing enqueue endpoint + playback save). If `playingCollection` is set (a collection is playing), current behavior stands (loose play starts a fresh [track] queue replacing the collection context).
- Cold state (no queue): unchanged, [track].
- Tests: queue [a,b] ad-hoc, play(c) loose → queue [a,b,c], index 2, playing; play(b) loose again → jumps to index 1, no duplicate; collection playing → loose play(c) replaces with [c] as today.

Commit: `fix(queue): loose plays join the queue instead of wiping it`

### Task B6: Playback semantics — smart Prev, wrapping Next, working Shuffle

**SUPERSEDES the original bug 7 ("disable at edges") per owner items 12–14 (2026-07-26): Next wraps, Prev is smart, nothing disables while a queue is loaded.**

**Files:** `StudioProvider.tsx` + `MockStudioProvider.tsx` (+ `MockStudioValue` type), `screens/queue-utils.ts` (pure helpers + tests), `screens/Transport.tsx` only if wiring changes, `screens/CollectionDetail.tsx` + the queue page (`app/(studio)/queue/page.tsx`) for shuffle triggers, tests throughout.

- **Smart Prev (item 12):** `prev()` — if `progressSec >= 5`, seek to 0 of the current track (keep playing, flush the listen event as a restart? keep simple: seek(0), do not change index). If `progressSec < 5`, go to the previous track; at index 0 with <5s, wrap to the LAST track (mirror of wrapping next).
- **Wrapping Next (item 13):** `next()` at the last index goes to index 0 (the modulo behavior — verify it still does; `onEnded` uses next() so a finished playlist restarts from the top).
- **Shuffle that works (item 14):** context gains `shuffled: boolean` and `toggleShuffle()`. On enable: Fisher–Yates the queue with the CURRENT track moved to position 0 (playback never interrupts), remember the pre-shuffle order in a ref; the wrap order IS the shuffled order (next from last shuffled → first shuffled). On disable: restore the remembered order (current track keeps playing; index re-derived by id). Persist the ACTIVE order via the existing playback save (the queue array saved is whatever order is live). Pure reorder helpers live in `queue-utils.ts` with exhaustive unit tests (shuffle keeps current first, is a permutation; restore maps index correctly even after dequeues — on dequeue while shuffled, drop the id from both orders).
- **Triggers:** the queue page and `CollectionDetail`'s existing shuffle buttons (read them — CollectionDetail's shuffle currently plays the collection; it should play the collection then enable shuffle, i.e. shuffled from the start) wire to `toggleShuffle`/shuffled state (button shows active state). PlaybackBar's Loop button is untouched.
- Tests: prev at 6s seeks 0 same index; prev at 3s index 2 → index 1; prev at 3s index 0 → last; next at last → 0; toggleShuffle keeps nowPlaying, produces permutation, active flag; disable restores order; onEnded at last wraps to first.

Commit: `feat(player): smart previous, wrap-around next, and shuffle that actually shuffles`

### Task B10: Back buttons go back (owner item 11)

**Files:** `screens/BackHeader.tsx` (read it — likely takes an href), every page using it (`app/(studio)/queue/page.tsx` "Up next", queue/add, playlist add, profile subpages — grep `BackHeader`), tests.

- Every back control meant as "go back" must perform `router.back()` — with a fallback: if there is no in-app history (the page was a direct load, `window.history.length <= 1` or Next's back would leave the app), fall back to the page's current hardcoded destination (keep it as `fallbackHref`). Implement once in BackHeader (`href` becomes `fallbackHref`; button click → `router.back()` when safe, else `router.push(fallbackHref)`); update call sites' prop name. Grep for OTHER ad-hoc back arrows outside BackHeader and give them the same treatment.
- Tests: BackHeader test — with history, clicking calls router.back; without, pushes the fallback.

Commit: `fix(nav): back buttons return to the previous page, not home`

### Task B7: Independent feeds + client cache + Refresh buttons + Home parity + Liked in Jump back in

**Files:** `StudioProvider.tsx`, `MockStudioProvider.tsx` (type: split flags + refresh fns), `RailShelf.tsx` (optional header action slot), `FeedShelf.tsx` (pass-through), `search/page.tsx`, `home/page.tsx`, tests across those.

- **Split loading:** `feedsLoading` → `youMightLikeLoading` + `newReleasesLoading` (independent set/clear per fetch; each shelf renders the moment ITS feed settles). Keep the never-stuck guarantees per flag. Update all consumers; remove the old flag from the type.
- **Cache:** feed results persist in `localStorage` keyed by uid (`yuki:feeds:<uid>` = { youMightLike, newReleases, savedAt }) storing the API payloads (track objects). On sign-in: hydrate synchronously if cache exists (shelves render instantly, no skeleton), and skip the network fetch when the cache is younger than 6 hours; otherwise fetch and overwrite the cache. `absorb` the hydrated tracks so registries resolve.
- **Refresh:** context gains `refreshYouMightLike()` / `refreshNewReleases()` — set that shelf's loading flag, refetch its route, overwrite its slice of the cache. `RailShelf` gains an optional `action?: React.ReactNode` rendered right-aligned in the header row (space-between with the title, same slot style as `seeAllHref`); `FeedShelf` passes it through. Both shelves on BOTH pages get a Refresh button (ReloadIcon + "Refresh" label, PlayerButton/Button ghost sm) wired to the matching refresh fn; button disabled+spinner while that shelf loads.
- **Home parity:** Home renders You might like (grid, size md — same FeedShelf props as its New releases) ABOVE New releases, below Jump back in.
- **Liked Songs in Jump back in:** the shelf prepends the user's Liked Songs collection (from `collections`, id `liked`) when it has ≥1 track — it is a real playlist to users. Dedupe if the feed ever returns it.
- Tests: independent flags (one feed settling renders its shelf while the other still skeletons — page-level test with the mock's `feeds` override extended to per-feed loading); refresh button calls the fn and shows per-shelf loading; cache hydrate path (localStorage seeded → no fetch call, shelves filled — StudioProvider test with mocked backend asserting feed routes NOT called within TTL, called after TTL); Jump back in contains Liked Songs when non-empty.

Commit: `feat(feeds): independent cached shelves with refresh, on Home too`

### Task B8: Search "See more"

**Files:** `app/api/catalog/search/route.ts` (accept `limit` up to 60, default 20 — cacheKey must incorporate the limit; check `cacheKey` signature and extend safely e.g. key on `${q}#${limit}` without breaking existing entries), `lib/api/backend.ts` + `endpoints`, `StudioProvider.tsx` (`search` keeps page state: `searchLimit`, `loadMoreResults()` refetches with limit+20, appends/replaces results; `canLoadMore` false when the last fetch returned fewer than the limit), `MockStudioValue` type + mock, `search/page.tsx` (a centered "See more" Button under the Tracks list with pending state), tests (unit + one integration test for the route limit).

Commit: `feat(search): see more results`

### Task B9: Verification round

- All gates zero: unit, integration (emulator), typecheck, lint, format:check.
- Browser walkthrough (web-emu, desktop + 375×812): liked-heart → dialog; dialog checkbox feedback; dialog fits mobile; create flow end-to-end (search, add w/ feedback, remove, finish → lands on REAL playlist, no "not found"); queue-preserving loose play; edge-disabled transport; per-shelf skeletons/refresh; Home shelves + Liked in Jump back in; See more.
- Push `v2_2026`, deploy production via `npx vercel deploy --prod --yes --logs`, verify 200.
