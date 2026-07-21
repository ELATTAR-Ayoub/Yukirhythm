# Phase 4 — Events Implementation Plan

**Goal:** The play-history pipeline everything downstream needs. Batched play events land in an
append-only store, gated on consent, and roll their counters into the per-user overlay. Backend,
verified against the real emulator.

**Spec:** §5.9, §6.5, §8 (Events). Roadmap phase 4.

**Scope.** Backend: the `playEvents` store, `POST /api/events`, the completion threshold, the
`trackState` counter updates, and `DELETE /api/me/history` (moved from phase 2). The client-side
event *transport* (batching, flush on unload) is UI plumbing wired in phase 8; its shape is fixed
here by the endpoint contract so it can be written against now.

---

## Task 1: `PlayEvent` in the model

Add to `lib/catalog/model.ts` (spec §5.9): `PlayEvent` with `userId, trackId, collectionId,
startedAt, listenedSec, completed, skipped, source, recommendationId, deviceId, clientHourOfDay`,
plus `COMPLETION_MIN_SEC = 30` and a pure `isCompleted(listenedSec, durationSec)` helper
implementing `listenedSec >= min(30, durationSec * 0.5)`. Unit-test the helper (a 20s play of a
6-hour mix is a skip; a 45s play is complete; a 10s play of a 20s clip is complete at 50%).

## Task 2: `POST /api/events`

`app/api/me/events/route.ts` — wait, standardize: events are the caller's own, so
`app/api/events/route.ts` per spec §8. Accepts `{ events: RawEvent[] }`, a batch. For each:

- Derive `completed`/`skipped` from the threshold against the track's `durationSec`.
- Write `playEvents/{autoId}`.
- Update `users/{uid}/trackState/{trackId}` counters transactionally: `playCount +1`,
  `completedCount`/`skipCount +1`, `totalListenedSec += listenedSec`, `lastPlayedAt`.
- **Gate on `privacy.saveHistory`** — if false, accept the request (200) but write nothing.

Global `tracks.stats.playCount` increment is deferred (spec §14 hotspot); note it, do not inline.

**Integration test** (real emulator): a batch writes N events and updates counters; a completed
vs skipped play increments the right counter; `saveHistory: false` writes nothing but still 200s;
malformed events in a batch are skipped, not fatal; 401 without a token.

## Task 3: `DELETE /api/me/history`

`app/api/me/history/route.ts` — deletes the caller's `playEvents` and clears the `trackState`
counters (keeps `isLiked`/`likedAt` — clearing history is not unliking). Integration test proves
events gone and counters zeroed while likes survive.

## Task 4: Client + registry + demo

`endpoints.events.ingest` and `endpoints.me.history` already exist. Add `backend.events.ingest`
and `backend.me.clearHistory`. `scripts/demo-events.ts`: play some real tracks, post events, read
back the counters and a completed/skipped split, then clear history — real emulator.

## Verification

- `npm run typecheck && npm test && npm run test:integration && npm run build`
- Update roadmap: rows 33 (play history), 17 (clear history) closed; row 34 (`shelf_see_all`) is
  UI → phase 8.

## Not in this phase

The client event transport wiring, `shelf_see_all`, and the new social signals' emitters — UI,
phase 8. Stats rollups consume these events in phase 5.
