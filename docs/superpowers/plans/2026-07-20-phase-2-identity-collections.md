# Phase 2 — Identity & Collections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or
> executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The backend for users, collections, likes, and per-user overlays — every route
authenticated, transactional where it must be, and verified against the real Firestore emulator.

**Spec:** `docs/superpowers/specs/2026-07-20-yukirhythm-backend-design.md` (§5.3–5.7, §8)

**Scope.** Backend only, same discipline as phase 1. The UI-only ledger rows — remove-track
affordance, drag-reorder affordance, wiring Settings/Privacy inputs to persist, the `/auth`
redirect guard — are screen changes and belong to **phase 8** (the migration), where the screens
move off `MockStudioProvider`. This phase builds and proves the routes those screens will call.

**Verification.** No mocks. Every route has an integration test against the real Firestore + Auth
emulators, using `mintIdToken` for real token verification (`lib/catalog/__integration__/`).

---

## Task 1: `/api/me` — profile, privacy, settings

**Files:**
- Create: `apps/web/app/api/me/route.ts` (replaces the legacy version)
- Create: `apps/web/app/api/me/me.integration.test.ts`

Behaviour:
- `GET` returns the caller's user doc, 404 if absent.
- `POST` ensure-user: uid from the token, never the body; privacy/settings defaults; idempotent
  (a second POST returns the existing doc unchanged).
- `PATCH` partial update of `privacy`, `settings`, `displayName`, `bio`, `handle` only. Identity
  fields (`userId`, `email`, `authProvider`, `counts`, `createdAt`) are immutable.

Integration test proves: 401 without token; POST creates with `DEFAULT_PRIVACY`/`DEFAULT_SETTINGS`
and the token's uid even when the body lies; second POST is idempotent; PATCH persists a privacy
toggle and a settings change through a real read-back; PATCH cannot change `userId` or `email`.

---

## Task 2: `authProvider` captured at sign-in

The client sign-in currently discards which provider was used, so Settings hardcodes "Google".
`POST /api/me` accepts `authProvider` in the body **only on first creation** (it is immutable
after). Document that the client must send `"google"` or `"facebook"`; default `"google"` if
absent/invalid. Covered by the Task 1 test (a Facebook POST persists `authProvider: "facebook"`).

---

## Task 3: Collections — create, read, edit, delete

**Files:**
- Create: `apps/web/app/api/collections/route.ts` (GET list, POST create)
- Create: `apps/web/app/api/collections/[collectionId]/route.ts` (GET, PATCH, DELETE)
- Create: `apps/web/app/api/collections/collections.integration.test.ts`

- `POST` accepts all seven wizard fields — `title, description, tags, contentType, texture, cover,
  trackIds` — in one call, server-issued id, `role: "playlist"`, `stats` computed from the initial
  tracks, `updatedAt`/`createdAt` set. Bumps the owner's `counts.collectionCount` transactionally.
- `GET /api/collections` returns the caller's owned collections.
- `GET /api/collections/[id]` — owner sees any; others see it only if `visibility !== "private"`.
- `PATCH` — owner-only; title, description, tags, visibility, cover, texture.
- `DELETE` — owner-only; decrements `counts.collectionCount`; refuses the reserved `liked` id.

Integration test proves each against real Firestore, including the `collectionCount` staying
consistent across create then delete.

---

## Task 4: Collection membership — add, remove, reorder

**Files:**
- Create: `apps/web/app/api/collections/[collectionId]/tracks/[trackId]/route.ts` (PUT, DELETE)
- Create: `apps/web/app/api/collections/[collectionId]/order/route.ts` (PATCH)
- Create: `apps/web/app/api/collections/membership.integration.test.ts`

Membership runs in a **real transaction** because `stats.trackCount` and `totalDurationSec` are
denormalised and the Library renders them directly.

- `PUT` appends `{ trackId, addedAt, addedBy }` if not already present; refuses past
  `MAX_TRACKS_PER_COLLECTION`; recomputes `stats`.
- `DELETE` removes the entry; recomputes `stats`.
- `PATCH order` takes a `trackIds` array that must be a permutation of the current membership;
  reorders, preserving each entry's `addedAt`/`addedBy`; rejects a non-permutation with 400.

Integration test proves: concurrent add/remove leaves `trackCount === tracks.length`; a duplicate
add is a no-op; reorder is a real permutation and preserves timestamps; non-owner gets 403.

---

## Task 5: Likes overlay and virtual Liked Songs

**Files:**
- Create: `apps/web/app/api/me/track-state/[trackId]/route.ts` (PUT)
- Create: `apps/web/app/api/me/liked/route.ts` (GET — the virtual collection)
- Create: `apps/web/app/api/me/overlay.integration.test.ts`

- `PUT track-state` sets `isLiked` (+ `likedAt`) and/or `resumeSec` on
  `users/{uid}/trackState/{trackId}`; creates the doc on first touch with `addedAt`.
- `GET /api/me/liked` returns the virtual Liked Songs collection (spec D8): a synthetic
  `Collection` shape with id `"liked"`, its `tracks` drawn from `trackState` where
  `isLiked == true`, ordered by `likedAt` desc, resolved against `tracks/`.

Integration test proves: liking writes the overlay; the virtual collection lists liked tracks
newest-first; unliking removes it; there is no stored `collections/liked` document (D8 — one
source of truth).

---

## Task 6: Pin overlay

**Files:**
- Create: `apps/web/app/api/me/collection-state/[collectionId]/route.ts` (PUT)
- Add to `overlay.integration.test.ts`

`PUT` sets `isPinned` / `lastOpenedAt` on `users/{uid}/collectionState/{collectionId}`. Per-user
so it works for owned and (phase 6) saved collections alike. Test proves pin persists and reads
back.

---

## Task 7: Library search (ledger row 10, moved from phase 1)

**Files:**
- Create: `apps/web/app/api/library/search/route.ts` (GET)
- Create: `apps/web/app/api/library/library-search.integration.test.ts`

`GET /api/library/search?q=` searches the caller's own collections by title and tag, and their
liked tracks by title and artist — the thing `searchMockCollections` could never do against the
seed constant. Owner-scoped: results are only the caller's collections plus their liked tracks.

Integration test seeds real collections and liked tracks, then proves a query matches by title and
by tag, is case-insensitive, and never returns another user's private collection.

---

## Verification

- [ ] `npm run typecheck && npm test && npm run build` pass
- [ ] `npm run test:integration` — all phase 1 + phase 2 suites green against the real emulator
- [ ] A runnable demo (`scripts/demo-collections.ts`): create a user, create a collection with
      real catalog tracks, add/remove/reorder, like a track, read the virtual Liked Songs — all
      against the real emulator, input matching output
- [ ] Update roadmap §10: mark ledger rows 10, 11–17, 22, 23 closed at the backend level; note
      the UI wiring for 11–17/22/23 lands in phase 8

## Not in this phase

UI affordances and screen wiring (remove-track button, drag handles, Settings/Privacy persistence
inputs, `/auth` redirect guard) — phase 8. Social graph, saved collections, public profiles —
phase 6. Play events and history writes — phase 4.
