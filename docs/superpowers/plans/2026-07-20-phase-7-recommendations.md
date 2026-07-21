# Phase 7 — Recommendations Implementation Plan

**Goal:** The three feeds that fill Home and Search — Jump back in, New releases, You might like —
each personalized, each with a cold-start path, every item tagged with a `recommendationId` and a
human `reason`. Backend, verified against the real emulator.

**Spec:** §6.1–6.3, §8 (Feeds). Roadmap phase 7.

**Design.** Scoring/blending logic is pure and unit-tested (`lib/catalog/recommend.ts`). The routes
assemble candidates from real Firestore (events, collections, tracks) and the `CatalogProvider`
(radio via `getRelatedTracks`), then apply the pure scorers. Integration tests inject a
deterministic provider via `setCatalogProvider` (the seam built in phase 1) over **real** emulator
data — the algorithm is tested with controlled input, the storage is real.

**Honest data limits, stated in code:** enrichment has not populated `labelIds` yet (label
affinity is a weak signal today) and `publishedAt` is null for most tracks (basic_info carries no
date), so New-releases recency leans on what data exists and the provider. Both improve for free
when enrichment and the primary_info date-fetch land — the scorers already read the fields.

Every feed excludes non-embeddable tracks, the user's own library, and anything played in the last
7 days. When personalization is off (`privacy.personalization === false`) or the user is cold, the
non-personalized variant runs rather than returning empty.

---

## Task 1: Pure scorers — `lib/catalog/recommend.ts`

- `pickJumpBackIn(events, nowMs)` → ordered `collectionId[]`: distinct collections from the last 30
  days of events, most-recent first, capped 12.
- `scoreNewReleases(candidates, artistAffinity, nowMs)` → ranked: `0.5·artistAffinity +
  0.3·recency + 0.2·log(views)`, recency linear over 90 days (0 when no date).
- `blendYouMightLike(radio, coListen, labelMatch, exclude)` → deduped, ranked list with a `reason`
  per item; weights 0.5 / 0.3 / 0.2; drops anything in `exclude`.
- `artistAffinityFrom(events, tracksById)` → `Map<artistId, 0..1>` normalised play share.

Unit-test each: jump-back dedup + recency order + cap; new-release weighting; blend dedup, exclude,
and reason; affinity normalisation.

## Task 2: `GET /api/feed/jump-back-in`

Reads the caller's 30-day events, resolves the distinct collections (owned or saved), returns them
newest-first. Cold pad: if < 3, append most-recently-created/saved collections. Integration test.

## Task 3: `GET /api/feed/you-might-like`

Seed = the caller's 5 most-played tracks. `radio` = provider `getRelatedTracks` on the seeds;
`coListen` = tracks co-occurring with the caller's liked tracks in other users' public collections;
`labelMatch` = tracks whose `labelIds` match the caller's top labels. Blend, exclude library +
7-day-recent, tag each with `recommendationId` + `reason` (e.g. "Because you played X"). Cold start:
provider radio from a globally-popular seed. Integration test with a stub provider.

## Task 4: `GET /api/feed/new-releases`

Candidates = related tracks of the caller's top artists (+ artists in saved collections). Score with
`scoreNewReleases`. Cold start: globally popular tracks by `viewCount`. Each item carries a
`recommendationId` + `reason`. Integration test.

## Task 5: Client + demo + verify

`endpoints.feed.*` exist. Add `backend.feed.jumpBackIn/newReleases/youMightLike`. `recommendation_play`
is already accepted by `POST /api/events` (phase 4) — a played recommendation records its
`recommendationId`, closing the loop. `scripts/demo-recommend.ts`: real plays → all three feeds with
real YouTube radio. Full suite + build. Update roadmap.

## Not in this phase

Wiring Home/Search rails to these feeds, and the notifications bell — phase 8. Weight tuning from
`recommendation_play` outcomes is future work once real usage exists.
