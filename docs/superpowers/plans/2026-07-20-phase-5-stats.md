# Phase 5 — Stats Implementation Plan

**Goal:** Turn the play-event stream into the numbers `/profile/stats` and `/profile/recents`
render — minutes windows, streak, top artists/tracks, genre split, hour histogram, and a
paginated history with provenance. Backend, verified against the real emulator.

**Spec:** §5.10, §6.5, §8 (Me → stats/recents). Roadmap phase 5.

**Design decision — compute on read.** The spec floats a cached rollup refreshed by a scheduled
job. For correctness and current scale, stats are computed from `playEvents` on each read: the
rolling windows (`minutesWeek`) then naturally *decrease* as events age out — the exact problem a
cached rollup needs a sweep to avoid. The rollup cache is a scale optimization, deferred and
noted. The aggregation is a pure function, unit-tested independently of Firestore.

**Timezone.** `byHour` uses the `clientHourOfDay` already captured local to the user at event
time — no tz needed at read. The streak needs local *dates*, so the endpoint takes `?tz=<IANA>`
(default UTC) and derives each event's local date with `Intl.DateTimeFormat`.

---

## Task 1: Pure aggregation — `lib/catalog/stats.ts`

`computeStats(events, tracksById, nowMs, tz)` → `StatsRollup`-shaped result:

- `minutesWeek/Month/Year/AllTime` — sum `listenedSec` within `now - window`, ÷60, floored.
- `streakDays` — distinct local dates (in `tz`) with ≥1 **completed** event, counted consecutively
  back from today (today with no play yet does not break a streak that includes yesterday).
- `topArtists` — completed events → track → artists; `plays` = completed count; top 10.
- `topTrackIds` — top 10 by completed count.
- `genreSplit` — sum `listenedSec` per track `labelIds`, normalised to 100; tracks with no label
  excluded from the denominator (percentages describe known genres honestly). Empty until
  enrichment populates labels — correct, not fabricated.
- `byHour` — completed plays per `clientHourOfDay`, normalised so the peak hour is 1.0.

Add `StatsRollup` to `model.ts` (§5.10). Unit-test `computeStats` with a fixed `nowMs` and a
constructed event set: window boundaries (a 8-day-old play drops from `minutesWeek`), a streak
broken by a missing day, top-artist ranking, and the genre denominator excluding unlabelled
tracks.

## Task 2: `GET /api/me/stats?tz=`

Reads the caller's `playEvents`, loads the referenced tracks, calls `computeStats`, returns it.

Integration test (real emulator): post events, assert minutes/streak/top/byHour; a manually
labelled track produces a `genreSplit`; 401 without a token.

## Task 3: `GET /api/me/recents?cursor=&limit=`

Reads `playEvents` ordered `startedAt` desc, paginated by a cursor (the last `startedAt` millis),
each row resolved to its track and, when present, its collection (the `— from {collection}`
provenance). Returns `{ items, nextCursor }`.

Integration test: newest-first order; provenance resolved; pagination via cursor returns the next
page without overlap.

Composite index needed (`playEvents`: `userId` + `startedAt` desc) — add to
`firestore.indexes.json`.

## Task 4: Client + demo + verify

`endpoints.me.stats`/`recents` exist. Add `backend.me.stats(tz)` and `backend.me.recents(cursor)`.
`scripts/demo-stats.ts`: real plays → read stats and recents back. Full suite + build green.
Update roadmap: Stats and Recents rows closed at the data layer; the screens render them in
phase 8.

## Not in this phase

The cached rollup + scheduled sweep (scale optimization), and wiring `/profile/stats` and
`/profile/recents` to these routes — phase 8.
