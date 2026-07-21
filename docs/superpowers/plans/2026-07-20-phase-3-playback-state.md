# Phase 3 — Playback State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development or executing-plans.

**Goal:** Persist playback so it survives a reload and follows the user across devices — the
current queue, position, shuffle/repeat modes, and volume — plus queue mutations (enqueue, play
next, remove). Backend, verified against the real emulator.

**Spec:** §5.8, §8 (Me → playback). Roadmap phase 3.

**Scope.** Backend only, matching phases 1–2. The player-UI rows — a real volume control in
`Transport`, shuffle/repeat as real modes, queue reorder/remove UI, replacing the wall-clock
ticker with a media element — are screen changes and land in **phase 8**, when the screens move
off `MockStudioProvider`. This phase builds the state document and routes those controls will
drive, so nothing is thrown away.

---

## Task 1: `PlaybackState` in the model

Add to `lib/catalog/model.ts` (spec §5.8), plus a default factory:

```ts
export type PlaybackState = {
  trackId: string | null;
  sourceType: "collection" | "library" | "search" | "radio";
  sourceId: string | null;

  queue: string[];          // resolved trackIds, in play order
  queueIndex: number;       // -1 when nothing is playing
  manualQueue: string[];    // "play next" entries, consumed before queue

  positionSec: number;
  isPlaying: boolean;
  shuffleMode: boolean;
  repeatMode: "off" | "all" | "one";
  volume: number;           // 0..1

  deviceId: string;         // last writer, for multi-device handoff
  updatedAt: Timestamp;
};

export const EMPTY_PLAYBACK: Omit<PlaybackState, "updatedAt"> = {
  trackId: null, sourceType: "library", sourceId: null,
  queue: [], queueIndex: -1, manualQueue: [],
  positionSec: 0, isPlaying: false, shuffleMode: false,
  repeatMode: "off", volume: 1, deviceId: "",
};
```

Typecheck.

---

## Task 2: `GET/PUT /api/me/playback`

`app/api/me/playback/route.ts`, `runtime = "nodejs"`, doc at `users/{uid}/playback/current`.

- `GET` — returns the stored state, or `EMPTY_PLAYBACK` (with a fresh `updatedAt`) when none.
- `PUT` — a throttled partial write. Validates and clamps each field: `volume` to `[0,1]`,
  `positionSec >= 0`, `repeatMode` in the enum, `queueIndex >= -1`, arrays of strings only.
  Ignores unknown fields. Stamps `updatedAt` and `deviceId` from the body.

**Integration test** (real emulator): 401 without token; GET returns empty default first;
PUT persists queue+index+modes and reads back; volume clamps (`1.5 → 1`, `-1 → 0`); repeatMode
rejects garbage (stays previous); a second PUT merges without wiping unset fields.

---

## Task 3: Queue mutations

`app/api/me/playback/queue/route.ts` (POST) and
`app/api/me/playback/queue/[index]/route.ts` (DELETE).

- `POST` body `{ trackId, mode: "next" | "end" }` — `next` pushes onto `manualQueue` (played
  before the main queue), `end` appends to `queue`. Returns the updated state.
- `DELETE /queue/[index]` — removes the entry at that position in `queue`; if it is at or before
  `queueIndex`, decrement `queueIndex` so the current track does not shift. 400 on an out-of-range
  index.

**Integration test**: enqueue-next lands in `manualQueue`; enqueue-end appends to `queue`;
removing an item before the cursor decrements `queueIndex`; removing the current or a later item
leaves the cursor on the same track; out-of-range → 400.

---

## Task 4: Client + registry

`endpoints.me.playback/playbackQueue/playbackQueueItem` already exist. Add `backend.me.playback`
methods: `get()`, `save(patch)`, `enqueue(trackId, mode)`, `removeFromQueue(index)`. Extend the
client E2E notion in the demo.

---

## Task 5: Demo + verification

- `scripts/demo-playback.ts`: live search → build a queue → save state → enqueue next → remove →
  read back, against the real emulator, input matching output.
- `npm run typecheck && npm test && npm run test:integration && npm run build` all green.
- Update roadmap §10: ledger rows 29 (enqueue/play-next), 30 (reorder/remove — API side), 32
  (resume — persisted) closed at the data layer; rows 26/27/28/31 (loop, shuffle, volume,
  row_queue UI) remain for phase 8.

## Not in this phase

Volume control widget, shuffle/repeat mode toggles wired to real behaviour, queue drag/remove UI,
and swapping the wall-clock ticker for a real media element — all phase 8.
