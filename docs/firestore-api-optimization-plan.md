# Firestore and API Optimization Plan

Status: Ready for execution  
Priority: Emergency  
Created: 2026-08-11

## Objective

Reduce normal application usage to a small, predictable number of Firestore operations, remove all database activity from playback, eliminate read amplification and N+1 queries, and enforce route-level budgets so regressions cannot reach production.

The target for a returning user opening Home is approximately one Firestore document read and zero writes. Playback, previews, queue changes, feed browsing, similar-song discovery, and search must not write to Firestore.

## Non-negotiable rules

- GET requests must never write to Firestore.
- Playback, queue state, progress, volume, shuffle, previews, and listening history remain browser-local.
- No polling, snapshot listeners, or timed database requests.
- No unbounded queries.
- No N+1 document resolution.
- Automatic page loads must not scan event history, all track state, public playlists, or catalog candidates.
- Browser caches must prevent repeated unchanged reads.
- Concurrent identical API calls must be deduplicated.
- Every database-backed endpoint must have a tested read/write budget.
- A route exceeding its budget must fail CI.

## Target operation budgets

| Operation | Firestore budget | API budget |
| --- | ---: | ---: |
| Warm Home load | At most 1 read, 0 writes | 1 bootstrap request |
| Cold Home load | At most 4 reads, 0 writes | 1 bootstrap plus required feed requests |
| New releases | 0 reads, 0 writes | Provider/cache only |
| You might like | 0 reads, 0 writes | Provider/cache only |
| Jump back in | 0 reads, 0 writes | Browser-local |
| Search | 0 Firestore operations | 1 provider request |
| Similar songs | 0 Firestore operations | 1 cached provider request |
| Preview, playback, progress, and queue | 0 reads, 0 writes | 0 |
| Like or unlike | 0 reads, 1-2 atomic writes | 1 request |
| Pin or unpin | 0 reads, 1 write | 1 request |
| Add a playlist track | At most 2 reads, 1-2 writes | 1 request |
| Remove a playlist track | At most 1 read, 1-2 writes | 1 request |

## Phase 1: Emergency containment

### Actions

1. Disable the expensive personalized feed context on automatic page loads.
2. Remove automatic scans of:
   - `playEvents`;
   - the complete `trackState` subcollection;
   - taste-track documents;
   - owned collections for recommendation exclusion;
   - public collections for co-listening.
3. Disable the unused playback, event ingestion, stats, recents, and history routes with an explicit feature gate or `410 Gone` response.
4. Ensure feed and catalog GET routes cannot ingest or update tracks, artists, search caches, or related-song caches.
5. Add strict limits and pagination to every remaining query.
6. Remove read-after-write responses where the server already has the resulting patch.

### Acceptance criteria

- No production timer can reach Firestore.
- No automatic Home request reads `playEvents` or scans public collections.
- No GET request performs a Firestore write.
- Dormant playback and history APIs cannot be triggered accidentally.

## Phase 2: Rebuild feeds without Firestore fan-out

### New releases

- Fetch directly from the catalog provider.
- Cache the final global response for 6-12 hours.
- Return no more than 20 tracks.
- Do not persist provider results during the request.
- Use the browser cache until expiration or an explicit manual refresh.
- Deduplicate concurrent identical provider requests with a single-flight cache.

### You might like

- Accept only 3-5 browser-local recent or liked seed IDs.
- Use no more than three seeds per request.
- Fetch related tracks directly from the provider.
- Deduplicate results and return no more than 20 candidates.
- Cache the final response by a stable seed hash.
- Remove public-playlist scanning, event-history reads, label queries, and candidate-document fan-out.
- Perform zero Firestore reads and writes.

### Jump back in

- Build the shelf from browser-local recent collection IDs.
- Resolve those IDs against the library already loaded in memory.
- Do not call a feed endpoint.
- Do not query listening history.

### Similar songs

- Cache provider results by seed track ID for seven days.
- Resolve no more than 20 tracks.
- Do not ingest tracks or update a seed document during the GET request.
- Store the result in browser/server response cache, not Firestore.

### Acceptance criteria

- Every feed endpoint performs zero Firestore operations.
- Cached feeds render without an API request.
- A manual refresh causes at most one provider request.
- Feed generation never mutates catalog data.

## Phase 3: Replace sign-in fan-out with one bootstrap

### Actions

1. Create one `/api/bootstrap` request containing:
   - the user profile;
   - library and likes version numbers;
   - small collection summaries;
   - like and pin summaries;
   - privacy and feature settings.
2. Persist the bootstrap result in browser storage with its version numbers.
3. On later loads:
   - read one lightweight bootstrap/version document;
   - compare server versions with browser versions;
   - reuse cached library and like data when versions match;
   - fetch only the resource whose version changed.
4. Remove the current parallel initialization calls for profile, collections, likes, and three personalized feeds.
5. Abort initialization requests when the user signs out or navigates away.

### Acceptance criteria

- Warm Home initialization makes one Firestore read and zero writes.
- Initialization uses one application bootstrap request.
- Unchanged collections and likes are not downloaded again.
- Navigating between application routes does not repeat bootstrap work.

## Phase 4: Add optimized read models

### Documents

- `users/{uid}/views/library`
- `users/{uid}/views/preferences`
- Paginated Liked Songs view pages, created only when needed.

### Library view contents

- Collection card summaries.
- Collection counts and updated versions.
- Pin state.
- Small artwork previews.
- No full track documents.
- No unbounded arrays.

### Liked Songs

- Do not load every liked track during Home initialization.
- Load the first page only when the Liked Songs screen opens.
- Use stable cursor pagination.
- Store enough immutable card metadata in the read model to prevent an additional track-document lookup for every row.

### Migration strategy

1. Introduce dual-read support behind a feature flag.
2. Build read models with a controlled one-time migration after quota availability is confirmed.
3. Switch reads to the new model.
4. Keep a temporary fallback for accounts that have not been migrated.
5. Remove the fallback after migration verification.

### Acceptance criteria

- Rendering the Library does not perform one read per saved collection or track.
- Liked Songs is paginated and does not produce a track-resolution N+1 query.
- Read models remain below Firestore document-size limits.

## Phase 5: Optimize every mutation

### Like and unlike

- Remove the track-state existence read.
- Use one atomic merge write with a server timestamp.
- Update the browser state and caches optimistically.
- Remove the `refreshLibrary()` call after the mutation.
- Invalidate only the affected liked page and version.

### Pin and unpin

- Keep the operation at one merge write.
- Update local state immediately.
- Do not reload the library.

### Add and remove playlist tracks

- Store duration and minimal track metadata in each playlist membership entry.
- Stop rereading every playlist track to recompute total duration.
- On add, read the collection and changed track only, then increment aggregate values.
- On remove, use the duration already stored in the membership entry and decrement aggregate values.
- Update the library read model in the same transaction or batch.
- Do not call `refreshLibrary()` after the mutation.

### Create a playlist

- Batch any required initial-track validation.
- Avoid sequential document reads.
- Write the playlist and library summary atomically.
- Return the created object directly without a read-after-write request.

### Edit, reorder, and delete

- Read each affected collection at most once.
- Return the known mutation result instead of reading it again.
- Update collection summaries and version metadata atomically.
- Prevent full library reloads after success.

### Acceptance criteria

- Like and pin actions never trigger collection or Liked Songs reloads.
- Adding or removing one track never reads every track in the playlist.
- No mutation route performs a read solely to construct its response.

## Phase 6: Remove Firestore-backed catalog caching from user GET requests

### Actions

- Remove `searchCache` reads and writes from interactive search.
- Replace Firestore catalog response caching with:
  - browser cache;
  - server response cache;
  - CDN cache headers where authentication permits;
  - external KV if a shared multi-instance cache is required;
  - in-process single-flight request deduplication.
- Return provider results directly in the canonical application track shape.
- Separate catalog persistence into an explicit administrative ingestion job.
- Never run ingestion from search, feeds, or similar-song GET requests.

### Acceptance criteria

- Search performs zero Firestore operations.
- Repeated identical searches use cached responses.
- Provider discovery cannot produce unexpected database writes.

## Phase 7: Audit dormant and social APIs

### Actions

- Keep playback, event history, recents, and stats disabled until an intentional server-sync design is approved.
- Limit followers and following pages to 20 rows with cursor pagination.
- Return paginated public collection summaries rather than full collection documents.
- Never scan hundreds of complete public playlists for recommendations.
- Cache artist and taxonomy exploration responses without Firestore writes during GET requests.
- Require explicit pagination on every collection-returning endpoint.

### Acceptance criteria

- Every query has a visible maximum result count.
- No social or discovery endpoint performs a full collection scan.
- Unused endpoints are inaccessible rather than silently consuming quota.

## Phase 8: Instrumentation and enforcement

### Per-request metrics

Record:

- route and HTTP method;
- UI trigger;
- document reads;
- query documents returned;
- writes and deletes;
- cache hit or miss;
- provider requests;
- request duration;
- user/session correlation using non-sensitive identifiers.

Expose the counters in development logs and diagnostic response headers.

### CI database budgets

| Endpoint | Maximum permitted operations |
| --- | ---: |
| Bootstrap | 4 reads, 0 writes |
| New releases | 0 reads, 0 writes |
| You might like | 0 reads, 0 writes |
| Similar songs | 0 reads, 0 writes |
| Search | 0 reads, 0 writes |
| Like/unlike | 0 reads, 2 writes |
| Pin/unpin | 0 reads, 1 write |
| Playlist membership mutation | 2 reads, 2 writes |

CI must fail whenever an endpoint exceeds its declared budget.

### Production protection

- Configure Firestore quota and billing alerts.
- Alert on abnormal reads or writes per active user.
- Add endpoint-level rate limiting for expensive mutations and provider calls.
- Add a database kill switch for nonessential discovery features.
- Maintain a dashboard of operations per route and application version.

## Verification plan

1. Add emulator-backed operation-count tests for every active route.
2. Run the complete unit and integration test suites.
3. Test cold and warm Home loads with network logging enabled.
4. Test repeated route navigation and verify that bootstrap is not repeated.
5. Play audio for an extended simulated period and verify zero database calls.
6. Exercise preview, queue, volume, shuffle, and fullscreen actions and verify zero database calls.
7. Test search, feeds, and similar songs and verify zero Firestore operations.
8. Test each mutation against its declared budget.
9. Verify cache invalidation across two browser sessions.
10. Compare Firebase usage before and after deployment.

## Execution order

1. Emergency containment and route kill switches.
2. Remove all writes from GET routes.
3. Replace New releases, You might like, Jump back in, and Similar songs.
4. Build the bootstrap and browser version cache.
5. Optimize likes, pins, and playlist mutations.
6. Introduce read models and controlled migration.
7. Audit dormant and social endpoints.
8. Add metrics, rate limits, operation-budget tests, and alerts.
9. Run full automated and browser verification.
10. Produce a final before-and-after Firestore cost report.

## Definition of done

- A normal returning user opening Home causes approximately one Firestore read and zero writes.
- No playback or preview behavior contacts Firestore.
- Feed browsing, feed refreshes, search, and similar-song discovery perform zero Firestore operations.
- No GET route writes to Firestore.
- No endpoint contains an unbounded query or N+1 document loop.
- Every active endpoint has an enforced read/write budget.
- Full automated tests and manual browser verification pass.
- Production alerts and a database kill switch are active.
