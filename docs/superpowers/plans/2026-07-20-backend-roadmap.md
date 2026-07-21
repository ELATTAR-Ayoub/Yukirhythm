# Yukirhythm Backend — Master Roadmap

> **For agentic workers:** this is the phase map, not an execution plan. Each phase gets its own
> TDD plan in `docs/superpowers/plans/` written when the phase starts. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Take every screen in `/design-system/screens` from mock to real, close every stub, and
end with those screens as the actual application.

**Spec:** `docs/superpowers/specs/2026-07-20-yukirhythm-backend-design.md`

**The rule:** *no orphan UI.* Every control either does the real thing or is deleted. §10 is the
ledger — 39 stubs, each assigned to the phase that closes it. A phase is not done until its
ledger rows are green.

---

## Phase map

| # | Phase | Depends on | Closes |
|---|---|---|---|
| 0 | Pre-flight fixes | — | 8 stubs, no backend needed |
| 1 | Catalog core | 0 | search, browse, taxonomy |
| 2 | Identity & collections | 1 | library, likes, create, membership |
| 3 | Playback state | 2 | queue, shuffle, repeat, resume, volume |
| 4 | Events | 3 | history capture |
| 5 | Stats | 4 | `/profile/stats`, `/profile/recents` |
| 6 | Social | 2 | follow, public profiles, saved playlists |
| 7 | Recommendations | 4, 6 | the three home/search feeds |
| 8 | Migration | 1–7 | screens become the app |

Phases 1→2→3 are a chain. 4 needs 3. 5 and 7 need 4. **6 runs in parallel with 4–5.** 8 is last.

---

## Phase 0 — Pre-flight fixes

Real bugs in the screens, fixable today with no backend. Doing them first means later phases
build on correct UI rather than inheriting defects.

- [ ] `searchMockCollections` reads the module constant `MOCK_COLLECTIONS`, so Liked Songs and
      anything the create wizard makes can **never** appear in search. Take collections as a
      parameter from provider state.
- [ ] `seek()` is unclamped at the upper bound — seeking past `durationSec` instantly trips the
      auto-advance effect. Clamp to `[0, durationSec]`.
- [ ] `DiscDeck` emits `data-signal="disc_next, disc_prev"` — two values in one attribute, which
      will parse as garbage. Split into two elements.
- [ ] `AddMusicPanel` rows leave `TrackRow playable` at its `true` default, rendering a hover play
      button with no handler. Pass `playable={false}`.
- [ ] Search results nest a `<button aria-label="Play">` inside a `role="button"` div — the exact
      nesting `TrackRow`'s docstring warns against. Pass `playable={false}`.
- [ ] Recents calls `play(track)` without `entry.collectionId`, so playing from history does not
      restore the source collection's queue. Pass it.
- [ ] `createCollection` ids are `local-${collections.length + 1}` — collides after any removal.
      Use `crypto.randomUUID()` until phase 2 issues server ids.
- [ ] Sign-out is inconsistent: Settings toasts and redirects, the header dropdown does neither.
      Unify on one helper.
- [x] ~~Delete the superseded drawers.~~ **Withdrawn.** `QueueDrawer`, `PlaylistDrawer`,
      `CreatePlaylistDrawer`, and `CreatePlaylistForm` are imported by the design-system docs
      gallery — they are documented components, not dead code. `AddMusicDrawer` has no importer,
      but its own route file records a deliberate decision to keep it ("left in place rather than
      deleted unilaterally"), so it stays until someone chooses otherwise.

**Gate:** `npm run typecheck && npm run lint && npm test && npm run build`.

**Phase 0 complete — 2026-07-20.** 271 tests across 59 files pass; typecheck and build clean.
Two pre-existing `react-hooks/purity` lint errors remain in `components/studio/deck/Disc.tsx`;
they are present at the base commit `a5ca6ea` and are unrelated to this phase.

---

## Phase 1 — Catalog core

Detailed plan: `2026-07-20-phase-1-catalog-core.md`.

- [x] `lib/catalog/types.ts` + `provider.ts` — the interface, no implementation
- [x] Install `youtubei.js`; record fixtures (song, video info, long video, artist, playlist)
- [x] `youtube/map.ts` — song, video info, artist, playlist, `mergeTrack` (17 unit tests vs. real fixtures)
- [x] `youtube/client.ts` + `index.ts` — the provider (5 live contract tests)
- [x] `model.ts` — Firestore document types (rev-2 shapes)
- [x] `ingest.ts` — idempotent upsert, alias collapse, user-label protection
- [x] `cache.ts` — persistent 24h search cache
- [x] `taxonomy.ts` — controlled vocabulary, `resolveLabel`, explore tiles
- [x] `texture.ts` — deterministic `hash(trackId) % TEXTURE_NAMES.length`
- [x] Routes: `/api/catalog/search`, `/suggest`, `/tracks/[id]`, `/artists/[id]`, `/browse?label=`
- [x] Network-gated provider contract test
- [→] `/api/library/search` — moved to **phase 2**; it needs collections to exist
- [→] Wire Search screen to real endpoints — moved to **phase 8** (the migration); wiring
      half the screens onto a still-moving backend means doing it twice

**Closes:** ledger row 9 (explore tiles returning nothing — `/browse` now serves them from the
taxonomy). Row 10 (library search) moves to phase 2 with its endpoint.

**Phase 1 complete — 2026-07-20.** Verified with **real data, no mocks**: 298 unit tests (map
against recorded fixtures, 5 live YouTube contract checks) and **20 integration tests against
the real Firestore + Auth emulators** — real writes, transactions, `array-contains`, token
verification, and cache hits. `scripts/demo-catalog-pipeline.ts` runs the whole path on live
YouTube data: search in, Firestore docs out, input matching output. Typecheck and build clean.

**Backend delivered, screens still on mock data — that is deliberate (phase 8 migrates them).**
Exercising the routes against **production** Firestore needs `FIREBASE_SERVICE_ACCOUNT_B64` in
`apps/web/.env.local`, which only the owner can generate (Firebase console → Service accounts).
Until then everything runs against the local emulator.

---

## Phase 2 — Identity & collections

Detailed plan: `2026-07-20-phase-2-identity-collections.md`. **Backend delivered.** UI wiring
(marked → below) stays for phase 8, matching the phase 1 discipline.

- [x] `users/{uid}` with `authProvider`, `privacy`, `settings`, `counts`, `createdAt`
- [x] Capture the auth provider — `POST /api/me` persists `authProvider` honestly (immutable after)
- [x] `/api/me` GET/POST/PATCH — privacy and settings persist
- [→] Settings: audio quality and language inputs → phase 8 (routes persist them now)
- [x] Privacy: three toggles persist via PATCH; `saveHistory` gate enforced in phase 4
- [→] `DELETE /api/me/history` — belongs with the event store; **moved to phase 4**
- [x] `collections/{id}` with `role` + `contentType`, `cover`/`texture`, timestamped `tracks[]`
- [x] `POST /api/collections` accepting all seven wizard fields atomically
- [x] `PUT/DELETE /api/collections/[id]/tracks/[trackId]` — transactional `stats`
- [x] `PATCH /api/collections/[id]/order` — reorder (permutation-checked)
- [→] **Remove-track UI** in `CollectionDetail` → phase 8 (DELETE route exists)
- [→] **Drag-reorder UI** in `CollectionDetail` → phase 8 (order route exists)
- [x] `TrackState.isLiked` + `PUT /api/me/track-state/[trackId]`
- [x] Liked Songs as a **virtual** collection from the overlay, ordered by `likedAt` (`GET /api/me/liked`)
- [x] ~~`TrackMenu` Like / Add / Share~~ — already real (closed by earlier screen work; wiring to
      these routes in phase 8)
- [x] `collectionState.isPinned` (`PUT /api/me/collection-state/[id]`); the Library pin control
      already exists via `CollectionMenu`
- [→] `"Joined March 2024"` reads `user.createdAt` → phase 8 (field exists)
- [→] Redirect guard on `/auth` → phase 8

**Also delivered:** `GET /api/library/search` (ledger row 10, moved from phase 1) — searches the
caller's own collections and liked tracks; and `firestore.indexes.json` declaring the two
production composite indexes the emulator does not enforce.

**Phase 2 complete — 2026-07-20.** Backend verified with **real data, no mocks**: 51 integration
tests against the real Firestore + Auth emulators (real transactions, real token verification,
concurrent-add consistency, virtual Liked Songs ordering). `scripts/demo-collections.ts` runs
the whole flow on live YouTube data through the real routes — create, add, remove, reorder, like,
read — input matching output. Typecheck and build clean.

**Backend closes ledger rows 10, 11–17, 22, 23 at the data layer; their UI wiring lands in
phase 8** (screens still on `MockStudioProvider`). Row 17 (clear history) reassigned to phase 4.

---

## Phase 3 — Playback state

Detailed plan: `2026-07-20-phase-3-playback-state.md`. **Backend delivered.** Player-UI rows
(marked → below) land in phase 8.

- [x] `users/{uid}/playback/current` document (spec §5.8), `PlaybackState` + `EMPTY_PLAYBACK`
- [x] `GET/PUT /api/me/playback` — restore on load; PUT is a throttled, clamped partial write
- [→] Replace the derived queue with the persisted one → phase 8 (state + routes exist)
- [x] `POST /api/me/playback/queue` — enqueue and **play next** (`manualQueue`)
- [x] `DELETE /api/me/playback/queue/[index]` — remove, cursor-preserving
- [→] **Queue reorder + remove UI** → phase 8 (remove API exists; reorder rides the PUT queue)
- [→] `TrackMenu` "Add to queue" / "Play next" (`row_queue`) → phase 8 (enqueue API exists)
- [→] **`shuffleMode` as a real mode** → phase 8 (field persisted)
- [→] **`repeatMode` as a real mode** (`off`/`all`/`one`) → phase 8 (field persisted, enum-checked)
- [→] **Volume control in `Transport`** → phase 8 (`volume` persisted, clamped `[0,1]`)
- [x] `resumeSec` persisted via `positionSec`; restored by `GET /api/me/playback`
- [→] Replace the wall-clock ticker with a real media `currentTime` → phase 8

**Phase 3 complete — 2026-07-20.** Backend verified with **real data, no mocks**: 12 integration
tests against the real emulator (field clamping, mode validation, partial-merge, queue-cursor
logic), the four client methods verified over real HTTP, and `scripts/demo-playback.ts` building
a queue from live YouTube, mutating it, and resuming it across a simulated reload. 63 integration
+ 301 unit green; typecheck and build clean.

**Closes ledger rows 29 (enqueue/play-next), 30 (queue remove — API), 32 (resume) at the data
layer.** Rows 26/27/28/31 (loop, shuffle, volume, `row_queue` UI) are UI and land in phase 8.

**Closes:** 8 stubs. This is the phase where the player stops being a simulation.

---

## Phase 4 — Events

Detailed plan: `2026-07-20-phase-4-events.md`. **Backend delivered.**

- [→] Client event transport: batch, debounce, flush on `visibilitychange`/`beforeunload` → phase 8
- [→] Bind the reconciled `data-signal` vocabulary to the transport → phase 8
- [x] `POST /api/events` — batched write, **gated on `privacy.saveHistory`**
- [x] `playEvents/{id}` with `listenedSec`, `completed`, `skipped`, `collectionId`,
      `clientHourOfDay` (local to the user), `recommendationId`
- [x] Completion threshold `min(30s, durationSec * 0.5)` (`isCompleted`, unit-tested)
- [x] Update `trackState` counters: `playCount`, `completedCount`, `skipCount`, `totalListenedSec`
- [~] Global `tracks.stats.playCount` — deferred (per-doc hotspot, spec §14); noted, not inlined
- [→] Wire `shelf_see_all` → phase 8
- [→] New signals (`follow`, `collection_save`, …) — emitted by the transport → phase 8
- [x] `DELETE /api/me/history` (moved from phase 2) — clears events + counters, keeps likes

**Phase 4 complete — 2026-07-20.** Backend verified with **real data, no mocks**: 6 integration
tests + a unit-tested completion threshold, all against the real emulator; `scripts/demo-events.ts`
posts real play events off a live YouTube search and reads the counters and completed/skipped
split back, then clears history. 69 integration + 305 unit green; typecheck and build clean.

**Closes ledger rows 33 (play history) and 17 (clear history).** Row 34 (`shelf_see_all`) and the
transport are UI → phase 8. Stats rollups consume these events in phase 5.

---

## Phase 5 — Stats

Detailed plan: `2026-07-20-phase-5-stats.md`. **Backend delivered** — compute-on-read.

- [~] Cached `stats/rollup` + scheduled sweep — **deferred** (scale optimization); computed on
      read instead, so the rolling windows decrease as events age out with no sweep needed
- [x] Timezone handled per-request (`?tz=`); `byHour` uses the event's stored local hour
- [x] `minutesWeek` / `minutesMonth` / **`minutesYear`** / `minutesAllTime`
- [x] `streakDays` — consecutive days with ≥1 completed play, in the user's timezone
- [x] `topArtists`, `topTrackIds`, `genreSplit`, `byHour[24]`
- [x] `GET /api/me/stats` — computed from real events
- [x] `GET /api/me/recents?cursor=` — provenance + cursor pagination
- [→] Derive Today/Yesterday/This week for the screen → phase 8 (recents returns `startedAtMs`)

**Phase 5 complete — 2026-07-20.** Backend verified with **real data, no mocks**: a 10-test
pure-aggregation unit suite (window boundaries, tz-aware streak, ranking, genre denominator) plus
6 integration tests against the real emulator; `scripts/demo-stats.ts` computes a week of real
plays into stats (streak 3, top artist, genre split, peak hour) and paginated recents with
provenance. Adds the `playEvents` composite index for production. 75 integration + 315 unit green.

**Closes ledger rows implied by Stats/Recents at the data layer.** The screens render them in
phase 8.

---

## Phase 6 — Social

Runs in parallel with 4–5.

- [ ] `following/` + `followers/` edges, both directions, transactional with `counts`
- [ ] `PUT/DELETE /api/users/[id]/follow` — idempotent, self-follow rejected
- [ ] `GET /api/users/[id]/followers` / `/following` — paginated
- [ ] `GET /api/users/[id]` — 404 unless `publicProfile`
- [ ] `handle` uniqueness and reservation (spec §14 open question)
- [ ] `savedCollections/` + `PUT/DELETE /api/collections/[id]/save`
- [ ] `GET /api/collections/public?ownerId=`
- [ ] Library merges owned + saved; a collection turning private drops out without deleting the record
- [ ] **New route `/profile/followers`** — the count on `/profile/view` is dead text today
- [ ] **New route `/profile/following`**
- [ ] **New route `/user/[handle]`** — public profile, their public collections, follow button
- [ ] **Save button** on another user's collection
- [ ] **"Saved" filter chip** in Library alongside Playlists / Podcasts / Liked
- [ ] **Profiles section** in Search, so users are findable
- [ ] Render `stats.saveCount` — collection `likes` is stored today and displayed nowhere

**Closes:** 7 stubs plus 3 new routes. The entire social surface currently has zero backing.

---

## Phase 7 — Recommendations

- [ ] `GET /api/feed/jump-back-in` — distinct collections from 30 days of events, recency-ordered
- [ ] `GET /api/feed/new-releases` — personalized: `0.5·artistAffinity + 0.3·recency + 0.2·popularity`
- [ ] `GET /api/feed/you-might-like` — blend provider radio, co-occurrence, label affinity
- [ ] Cold-start paths for every feed — a new user must never see an empty rail
- [ ] `recommendationId` + human-readable `reason` on every item
- [ ] Record `recommendation_play` so the blend can be evaluated rather than guessed at
- [ ] Fall back to non-personalized variants when `privacy.personalization === false`
- [ ] Wire the notifications bell — `toast("No new notifications")` today

**Closes:** Home's two rails and Search's "You might like".

---

## Phase 8 — Migration

Gets its own spec. The screens become the application.

- [ ] Move routes from `/design-system/screens/*` to the app root
- [ ] Delete the landing page and the legacy dashboard
- [ ] Replace `MockStudioProvider` with real data hooks against the phase 1–7 APIs
- [ ] `/design-system` reverts to documentation only, pointing at live components
- [ ] Delete `mock-data.ts` and every fixture import
- [ ] Delete `pages/api/searchEngine.ts`, `lib/search/*`, `lib/api/shape.ts`, the old
      `Audio`/`Collection`/`User` interfaces, and `@fabricio-191/youtube`
- [ ] Reset Firestore (clean break, D1)
- [ ] Deploy `firestore.rules` last — deny-all stays

Deliberately final: migrating UI onto a backend that is still moving means doing it twice.

---

## §10 — Stub ledger

Every piece of UI that currently does nothing real, and the phase that closes it. **Nothing may
remain in this table when phase 8 ships.**

| # | Stub | Today | Phase |
|---|---|---|---|
| 1 | ~~`searchMockCollections`~~ | ~~can't see own or created collections~~ | **0 ✅** |
| 2 | ~~`seek`~~ | ~~unclamped, overshoot auto-advances~~ | **0 ✅** |
| 3 | ~~`DiscDeck` signal~~ | ~~two values comma-joined in one attribute~~ | **0 ✅** |
| 4 | ~~AddMusicPanel rows~~ | ~~dead hover play button~~ | **0 ✅** |
| 5 | ~~Search result rows~~ | ~~nested interactive elements~~ | **0 ✅** |
| 6 | ~~Recents play~~ | ~~drops `collectionId`, loses queue source~~ | **0 ✅** |
| 7 | ~~`createCollection` id~~ | ~~`local-${n}` collides~~ | **0 ✅** |
| 8 | ~~Sign-out~~ | ~~inconsistent between Settings and header~~ | **0 ✅** |
| — | ~~TrackMenu Like / Add / Share~~ | ~~toasts~~ | **closed by screen work** |
| — | ~~Library pin~~ | ~~`togglePin` unreachable~~ | **closed by screen work** |
| 9 | Explore tiles | 6 of 8 return zero results | 1 |
| 10 | Library search | no endpoint | 1 |
| 11 | Settings → audio quality | toast | 2 |
| 12 | Settings → language | toast | 2 |
| 13 | Settings → connected account | hardcoded "Google" | 2 |
| 14 | Privacy → save history | local state only | 2 |
| 15 | Privacy → personalization | local state only | 2 |
| 16 | Privacy → public profile | local state, no consumer | 2 |
| 17 | Privacy → clear history | toast | 2 |
| 18 | TrackMenu → Like | toast, writes nothing | 2 |
| 19 | TrackMenu → Add to playlist | toast, no picker | 2 |
| 20 | TrackMenu → Share | toast, copies nothing | 2 |
| 21 | Library pin | `togglePin` unreachable from UI | 2 |
| 22 | Remove track from collection | no UI, no API | 2 |
| 23 | Reorder tracks | no UI, no API | 2 |
| 24 | "Joined March 2024" | string literal | 2 |
| 25 | `/auth` when signed in | no redirect guard | 2 |
| 26 | Transport → loop | inert local boolean | 3 |
| 27 | Shuffle | one-shot random start, not a mode | 3 |
| 28 | Volume | **no control exists at all** | 3 |
| 29 | Queue enqueue / play next | no representation | 3 |
| 30 | Queue reorder / remove | no representation | 3 |
| 31 | `row_queue` signal | documented, never emitted | 3 |
| 32 | Resume playback | nothing persists | 3 |
| 33 | Play history | nothing written | 4 |
| 34 | `shelf_see_all` | never fires, no `seeAllHref` | 4 |
| 35 | Followers / following counts | dead text, no lists | 6 |
| 36 | Other users' profiles | no route | 6 |
| 37 | Save someone's playlist | no UI, no API | 6 |
| 38 | Collection `likes` / `saveCount` | stored, never rendered | 6 |
| 39 | Notifications bell | `toast("No new notifications")` | 7 |

**Coverage:** phase 0 → 8 · phase 1 → 2 · phase 2 → 15 · phase 3 → 7 · phase 4 → 2 ·
phase 6 → 4 · phase 7 → 1. **Total 39, all assigned.**

---

## Verification gates

Every phase ends with:

- [ ] `npm run typecheck && npm run lint && npm test && npm run build` all pass
- [ ] Its ledger rows demonstrated working in the running app, not just unit-tested
- [ ] No new `toast("…mock…")` or dead handler introduced
- [ ] Privacy gates re-checked — `saveHistory: false` still writes nothing

Final gate for phase 8:

- [ ] The stub ledger is empty
- [ ] `grep -r "mock-data\|MockStudio" apps/web --include=*.tsx` returns nothing outside `/design-system` docs
- [ ] No document in Firestore contains a `userData` or `collectionData` wrapper
