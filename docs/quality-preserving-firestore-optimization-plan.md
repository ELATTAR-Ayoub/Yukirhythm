# Quality-Preserving Firestore Optimization Plan

Status: Ready for execution  
Priority: Emergency  
Created: 2026-08-12

## Objective

Restore the complete original recommendation quality, eliminate N+1 reads and
per-track HTTP fan-out, render large playlists from one Firestore document, and
keep playback persistence to at most one meaningful request per song
transition.

The optimization must change when data is loaded and where complete results are
materialized. It must not remove scoring, affinity, filtering, recommendation
reasons, release-date verification, or artist diversification.

## Non-negotiable rules

- Preserve the original recommendation algorithms.
- Normal Home loading must never regenerate feeds.
- Feed generation runs only for first generation or explicit user refresh.
- Same-device cached Home loading performs zero API and Firestore operations.
- Cross-device Home loading reads one complete materialized feed document.
- A playlist must never resolve its tracks with one request per track.
- Playlist membership entries must contain enough metadata to render and play.
- Playback, progress, queue, volume, shuffle, seek, preview, and fullscreen are
  browser-local.
- A meaningful listen produces at most one HTTP request on transition; pending
  events may be batched.
- No GET request writes to Firestore.
- No read-after-write when the server already knows the response.
- Every query and array must have an explicit bound.
- Every active endpoint must have an emulator-enforced operation budget.

## Persistence boundaries

### Persistence preservation rule

The implementation must not convert existing durable user data into cache-only
data. If an action currently creates cross-device user state, the optimized
version must continue to persist that state in Firestore. Optimization may
change the schema, batch operations, remove redundant reads, or create a
materialized view, but it must not silently remove durability.

The only data allowed to become cache-only is replaceable provider/discovery
data that is not user-owned state. Canonical catalog persistence may be moved
out of interactive GET routes into an explicit ingestion process, but it must
not be confused with or replace browser/server response caching.

### Authoritative Firestore data

These are durable user-owned records:

- user profile and privacy settings;
- owned collections;
- complete collection membership entries;
- saved-collection references or materialized summaries;
- likes, if cross-device likes are required;
- meaningful listening events for permanent cross-device history, recents, and
  statistics.

### Materialized Firestore views

These documents are durable, replaceable projections. They exist to provide
one-read cross-device loading and are not independent sources of truth:

- `users/{uid}/views/homeFeed`;
- `users/{uid}/views/taste`;
- `users/{uid}/views/library`;
- paginated Liked Songs view pages, if required by size.

They may be rebuilt from authoritative data or replaced atomically.

### Cache-only data

These must not be written to Firestore:

- playback position;
- current queue;
- volume, shuffle, repeat, seek, and fullscreen state;
- previews;
- provider search responses;
- similar-song responses;
- transient candidate pools used during feed generation;
- in-flight request deduplication;
- same-device copies of Home feeds and playlist data.

Cache layers may include browser storage, in-process server TTL caches, CDN
caches where authentication permits, or an external KV cache. Cache entries are
replaceable and never authoritative.

## Phase 1: Complete playlist memberships (Option A)

### Target membership schema

Replace ID-only membership entries with compact, renderable snapshots:

```ts
type CollectionTrack = {
  trackId: string;
  type: "track" | "episode";
  title: string;
  artists: { artistId: string; name: string }[];
  album: { albumId: string; name: string } | null;
  durationSec: number | null;
  artwork: { url: string; width: number; height: number }[];
  texture: TextureName;
  source: {
    provider: "youtube";
    videoId: string;
    url: string;
  };
  isEmbeddable: boolean;
  isLive: boolean;
  isFamilySafe: boolean;
  publishedAt: Timestamp | null;
  labels: TrackLabel[];
  preview?: {
    startSec: number;
    durationSec: 10;
    source: "provider_heatmap" | "provider_highlight" | "energy" | "fallback";
    confidence: number;
    version: number;
  };
  addedAt: Timestamp;
  addedBy: string;
};
```

This stores all stable data needed by a row, card, queue item, artwork preview,
recommendation input, and player. The audio/video bytes are never stored; the
player uses the persisted YouTube `videoId`.

`isLiked` is intentionally not authoritative membership data. It is a mutable,
viewer-specific overlay: two users viewing the same shared playlist can have
different like states, and a like can change without the playlist changing.
The API/UI must merge `isLiked` from the authenticated user's cached like-ID set
or materialized like summary in one operation, never through one lookup per
track. A response DTO may expose `isLiked`, but the stored collection membership
must not treat it as the source of truth.

### Required changes

- [ ] Add the new membership schema and runtime validation.
- [ ] Add `schemaVersion: 2` to migrated collections.
- [ ] Add `toStudioTrackFromMembership()`.
- [ ] Merge `isLiked` from the local/one-read user like overlay for every row.
- [ ] Render playlist tracks directly from `collection.tracks`.
- [ ] Stop using the global track registry as the playlist source of truth.
- [ ] Remove `trackIds.map(backend.catalog.track)` from playlist playback.
- [ ] Build the complete queue from membership metadata already in memory.
- [ ] Ensure next, previous, shuffle, and reorder require no API calls.
- [ ] Add a serialized-size guard before every collection write.
- [ ] Warn near 750 KiB and reject growth near 900 KiB.
- [ ] Retain an explicit maximum track count.

### Target budget

| Operation | Firestore budget | API budget |
| --- | ---: | ---: |
| Open a 170-track playlist | 1 read | 1 request or cached |
| Render all 170 tracks | 0 | 0 |
| Start playback | 0 | 0 |
| Next, previous, shuffle | 0 | 0 |
| Reorder playlist | 1 read, 1 write | 1 request |

## Phase 2: Playlist mutation optimization

### Add one track

1. Authenticate.
2. Read the collection once.
3. Resolve or validate only the new track.
4. Append a complete membership entry.
5. Increment `trackCount` and `totalDurationSec`.
6. Write the collection once.
7. Return the known membership and aggregate patch without rereading.

- [ ] Remove all playlist-wide track rereads on add.
- [ ] Keep the operation at no more than 2 reads and 1 write.

### Remove one track

1. Authenticate.
2. Read the collection once.
3. Locate the membership entry.
4. Subtract its stored `durationSec`.
5. Remove the entry and decrement `trackCount`.
6. Write once and return the known patch.

- [ ] Remove all catalog reads on removal.
- [ ] Keep the operation at 1 read and 1 write.

### Create playlist

- [ ] Accept complete canonical track summaries from the trusted application
  response shape.
- [ ] If server validation is required, use a bounded batch `getAll()` rather
  than sequential reads.
- [ ] Calculate aggregates in memory.
- [ ] Write the complete collection once.
- [ ] Return the created object without a read-after-write.

### Edit and reorder

- [ ] Read the collection once for authorization and current state.
- [ ] Update existing memberships without resolving track documents.
- [ ] Return the known result without rereading.

## Phase 3: Existing playlist migration

This migration is mandatory. The feature is not complete until every existing
Firestore collection has complete membership metadata and passes verification.

### Controlled migration

For every legacy playlist:

1. Read the playlist once.
2. Identify membership entries missing display metadata.
3. Resolve catalog documents using bounded `getAll()` batches.
4. Use the provider only for catalog misses.
5. Preserve exact ID order, `addedAt`, and `addedBy`.
6. Recalculate aggregates once.
7. Write the migrated playlist once with `schemaVersion: 2`.

- [ ] Implement a dry-run report.
- [ ] Implement the migration as a resumable, idempotent script under
  `apps/web/scripts/`.
- [ ] Require explicit project/environment selection so the script cannot
  accidentally target the wrong Firebase project.
- [ ] Record a checkpoint after each bounded batch so an interrupted run can
  resume without starting over.
- [ ] Make repeated execution safe: already-valid schema-version-2 collections
  must be verified and skipped without rewriting.
- [ ] Export a pre-migration manifest containing collection ID, owner ID, track
  count, ordered track IDs, aggregates, schema version, and document size.
- [ ] Report projected document sizes before writing.
- [ ] Migrate the 170-song playlist first as the canary.
- [ ] Verify count, order, IDs, duration, and required metadata.
- [ ] Migrate remaining collections in controlled batches.
- [ ] Rate-limit provider fallbacks and Firestore batches to stay inside quota.
- [ ] Write failures to a machine-readable retry file; do not silently skip
  unresolved tracks or partially rewrite a playlist.
- [ ] Run a final read-only audit over every collection after migration.
- [ ] Fail the audit if any collection remains below schema version 2, contains
  an incomplete membership, changes track order, changes track count, exceeds
  the size guard, or has inconsistent aggregates.
- [ ] Produce a final migration report with totals for scanned, migrated,
  already-valid, failed, unresolved, oversized, reads, writes, and provider
  requests.
- [ ] Do not perform automatic request-time migrations.
- [ ] Retain a temporary legacy read fallback behind a feature flag.
- [ ] Remove the fallback after verification.

### Required migration commands

The implementation must provide separate modes similar to:

```text
npm run migrate:collection-memberships -- --project <project-id> --dry-run
npm run migrate:collection-memberships -- --project <project-id> --canary <collection-id>
npm run migrate:collection-memberships -- --project <project-id> --execute
npm run migrate:collection-memberships -- --project <project-id> --verify
```

The exact CLI may differ, but dry-run, canary, execute, resume, retry, and
verification capabilities are required.

## Phase 4: Restore original recommendation quality

The following pure algorithms must remain active:

- `buildRecentTasteProfile`;
- engagement weighting;
- recency decay;
- liked-song boost;
- track, artist, and genre/label affinity;
- diverse seed selection;
- `scoreNewReleases`;
- publication-date validation;
- popularity tie-breaking;
- `blendYouMightLike`;
- known-track exclusion;
- `diversifyByArtist`;
- recommendation IDs and human-readable reasons.

- [ ] Restore the original scoring pipeline.
- [ ] Remove only Firestore-backed candidate acquisition and fan-out.
- [ ] Keep provider candidates in memory during generation.
- [ ] Never ingest provider candidates from a GET or refresh request.
- [ ] Never resolve final feed IDs with individual track reads.

## Phase 5: Compact taste view

Create `users/{uid}/views/taste`:

```ts
type TasteView = {
  schemaVersion: 1;
  version: number;
  updatedAt: Timestamp;
  recentEvents: Array<{
    eventId: string;
    trackId: string;
    listenedSec: number;
    startedAtMs: number;
    engagement: Engagement;
    artists: ArtistSummary[];
    labels: LabelSummary[];
    durationSec: number;
  }>;
  likedTracks: TrackTasteSummary[];
  excludedTrackIds: string[];
};
```

Bounds:

- 50-100 recent meaningful events;
- 50-100 relevant likes;
- a bounded exclusion set;
- one document below the Firestore size limit.

- [ ] Build the original taste profile from this one document.
- [ ] Do not scan all `playEvents` during Home or feed refresh.
- [ ] Do not scan the complete `trackState` subcollection.
- [ ] Do not read referenced track documents to recover artist and label data.

## Phase 6: Materialized Home feed

Create `users/{uid}/views/homeFeed`:

```ts
type HomeFeedView = {
  schemaVersion: 1;
  generatedAt: Timestamp;
  expiresAt: Timestamp;
  tasteVersion: number;
  newReleases: { items: FeedItem[] };
  youMightLike: { items: FeedItem[] };
};
```

Every `FeedItem` must contain a complete canonical track object. No item may
require a follow-up catalog read.

### Same-device Home load

Browser key: `yukirhythm:home-feed:v1:{uid}`

- [ ] Read and render browser cache synchronously.
- [ ] Validate schema version and expiration.
- [ ] Make zero API requests when valid.

### Cross-device or cleared-cache Home load

`GET /api/feed/home`:

- [ ] Authenticate.
- [ ] Read `homeFeed` once.
- [ ] Return the complete document.
- [ ] Store it in browser cache.
- [ ] Perform no provider calls and no computation.

Budget: 1 Firestore read, 0 writes.

### Explicit refresh

`POST /api/feed/home/refresh`:

1. Authenticate.
2. Read `views/taste` once.
3. Request bounded provider candidates.
4. Run the complete original algorithms in memory.
5. Build both complete shelves.
6. Write `views/homeFeed` once.
7. Return the exact in-memory object without rereading.
8. Replace the browser cache.

- [ ] Add single-flight deduplication keyed by UID and taste version.
- [ ] Ensure repeated clicks and multiple tabs run one refresh.
- [ ] Do not reload Home or the library after refresh.

Budget: 1 Firestore read, 1 Firestore write, bounded provider requests.

## Phase 7: Listening persistence

### Browser behavior

- [ ] Track elapsed listening locally.
- [ ] Send no progress requests.
- [ ] Discard sessions under 5 seconds.
- [ ] Optionally retain 5-30 second quick-skip signals.
- [ ] Persist meaningful sessions locally until acknowledged.
- [ ] Flush at most once when the song changes, ends, or the session closes.
- [ ] Batch multiple pending events into one request.
- [ ] Send nothing when history saving is disabled.

### Backend behavior

`POST /api/events` may write durable history and/or the compact taste view. It
must not read privacy, track metadata, event existence, or track-state
existence for every event.

- [ ] Use client-generated event IDs for idempotency.
- [ ] Avoid a separate duplicate-existence read.
- [ ] Accept the bounded canonical metadata needed by the taste view.
- [ ] Return an acknowledgement without reading written documents.

A meaningful listen uses durable Firestore persistence. It may use two writes:
one authoritative event and one compact taste projection. The implementation
must not replace durable listening history with cache-only storage.

## Phase 8: Fix remaining N+1 paths

### Liked Songs

Current issue: one track read per liked entry.

- [ ] Store complete liked membership summaries.
- [ ] Return only the Liked Songs count/summary during Home initialization.
- [ ] Load tracks only when the Liked Songs screen opens.
- [ ] Paginate if the view approaches document-size limits.

### Saved collections

Current issue: one collection read per saved reference.

- [ ] Store complete saved collection card summaries.
- [ ] Materialize bounded library summaries in `users/{uid}/views/library`.
- [ ] Render Library without resolving saved collection IDs.

### Library search

Current issue: one track read per liked result candidate.

- [ ] Search browser-loaded summaries and loaded liked pages locally.
- [ ] If server search remains necessary, query a materialized search view.
- [ ] Do not resolve liked IDs individually.

### Catalog track route

Current issue: a catalog miss can fetch provider data, ingest it, then reread
the track.

- [ ] Return the canonical provider object already in memory.
- [ ] Move canonical catalog ingestion into an explicit administrative or
  mutation workflow rather than an interactive GET request.
- [ ] Ensure interactive GET routes never mutate Firestore.

## Existing persistence preservation matrix

| Current durable behavior | Optimized durable behavior | May become cache-only? |
| --- | --- | --- |
| User profile/privacy writes | Remain authoritative user document writes | No |
| Collection create/edit/delete | Remain authoritative collection writes | No |
| Playlist memberships | Remain authoritative complete membership writes | No |
| Likes and pins | Remain authoritative cross-device preference writes | No |
| Meaningful listening history | Remain authoritative event writes | No |
| Taste derived from listening | Persist compact `views/taste` projection | No |
| Final per-user Home feeds | Persist complete `views/homeFeed` projection | No |
| Library summaries | Persist `views/library` projection | No |
| Canonical catalog records | Persist through explicit ingestion/mutations | No, if canonical persistence is required |
| Playback position/queue/volume | Browser-local session state | Yes; not durable user library data |
| Provider search response cache | Browser/server TTL cache | Yes |
| Similar-song response cache | Browser/server TTL cache | Yes |
| Feed candidate pool before ranking | In-memory during explicit refresh | Yes |

## Endpoint persistence matrix

| Endpoint/action | Firestore write? | Cache write? | Purpose |
| --- | --- | --- | --- |
| `GET /api/feed/home` | No | Browser cache | Cross-device materialized feed load |
| `POST /api/feed/home/refresh` | Yes: one `homeFeed` view | Browser + server TTL | Explicit feed replacement |
| `GET /api/catalog/search` | No | Browser/server TTL | Provider search response |
| `GET /api/feed/similar` | No | Browser/server TTL | Provider related-track response |
| `POST /api/events` | Optional 1-2 writes | Pending browser queue | Meaningful history/taste update |
| Open playlist | No | Browser memory/storage | Read complete collection |
| Add playlist track | Yes: collection | Invalidate playlist cache | Authoritative membership mutation |
| Remove playlist track | Yes: collection | Invalidate playlist cache | Authoritative membership mutation |
| Reorder playlist | Yes: collection | Replace playlist cache | Authoritative membership mutation |
| Like/unlike | Yes | Update local caches | Cross-device user preference |
| Pin/unpin | Yes | Update local caches | Cross-device library preference |
| Playback/queue/progress | No | Browser only | Local session state |

## Operation budgets

| Action | Maximum Firestore operations |
| --- | ---: |
| Warm Home, same device | 0 |
| Home, different device | 1 read |
| Explicit feed refresh | 1 read, 1 write |
| Open 170-track playlist | 1 read |
| Render/start/navigate playlist | 0 |
| Meaningful listen | 1-2 writes |
| Short listen | 0 |
| Add playlist track | 2 reads, 1 write |
| Remove playlist track | 1 read, 1 write |
| Reorder playlist | 1 read, 1 write |
| Like/unlike | 0 reads, 1-2 writes |
| Pin/unpin | 0 reads, 1 write |
| Search | 0 Firestore operations |
| Similar songs | 0 Firestore operations |

## Verification checklist

### Large playlist

- [ ] A 170-track fixture renders all 170 rows.
- [ ] Opening it performs one playlist request/read.
- [ ] It performs zero per-track catalog requests.
- [ ] Clicking track 100 starts immediately.
- [ ] Queue contains all 170 tracks.
- [ ] Next, previous, and shuffle perform zero API calls.
- [ ] Add/remove/reorder stay within budgets.
- [ ] Worst-case serialized playlist remains below the size guard.

### Recommendations

- [ ] Likes influence ranking.
- [ ] Recent meaningful listens influence ranking.
- [ ] Quick skips reduce affinity.
- [ ] Old releases are rejected by the date gate.
- [ ] Known tracks are excluded.
- [ ] Artist diversity is enforced.
- [ ] Recommendation reasons are preserved.
- [ ] Same-device Home performs zero requests.
- [ ] Cross-device Home reads one feed document.
- [ ] Only explicit refresh invokes the provider.
- [ ] Concurrent refreshes are deduplicated.
- [ ] Refresh writes one complete feed document.

### Listening

- [ ] Progress, seek, volume, queue, and previews produce zero requests.
- [ ] Under-threshold sessions produce zero requests.
- [ ] A meaningful transition produces at most one HTTP request.
- [ ] Offline events retry exactly once after acknowledgement logic.
- [ ] Duplicate event IDs do not duplicate durable history.
- [ ] Privacy disabled produces zero history/taste writes.

### CI enforcement

- [ ] Add emulator operation counters around active routes.
- [ ] Fail CI when a declared budget is exceeded.
- [ ] Run full unit and integration suites.
- [ ] Run a production build.
- [ ] Verify browser network logs on cold and warm loads.
- [ ] Verify Firestore usage before and after deployment.

## Safe execution order

1. Complete playlist membership schema and converters.
2. Playlist mutation updates and size guards.
3. Controlled playlist migration, beginning with the 170-track canary.
4. Playlist rendering and playback without the track registry or fan-out.
5. Large-playlist regression and budget tests.
6. Compact taste view and meaningful-listen batching.
7. Restore the original recommendation algorithms.
8. Materialized Home feed and explicit refresh endpoint.
9. Browser Home-feed cache and cross-device one-read fallback.
10. Liked Songs, saved collection, and library-search N+1 removal.
11. GET-side catalog mutation removal.
12. Emulator budget enforcement and full verification.
13. Feature-flagged deployment and migration verification.
14. Run the mandatory production migration for every existing collection.
15. Run the full production read-only audit and resolve every failure.
16. Remove the legacy fallback only after the audit reports zero incomplete
    collections.

## Definition of done

- [ ] The 170-song playlist renders completely from one Firestore read.
- [ ] Playlist playback makes no per-track requests.
- [ ] Original recommendation quality is restored.
- [ ] Recommendations compute only on first generation or explicit refresh.
- [ ] Complete feed results are stored in one materialized document.
- [ ] Same-device Home makes zero requests.
- [ ] Cross-device Home performs one read.
- [ ] Meaningful listening performs at most one request per song transition.
- [ ] No progress or playback state reaches Firestore.
- [ ] No active endpoint contains sequential document-resolution loops.
- [ ] No GET request writes to Firestore.
- [ ] Every active endpoint has an enforced operation budget.
- [ ] Existing playlists are migrated without losing order or metadata.
