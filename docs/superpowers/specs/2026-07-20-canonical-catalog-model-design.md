# Canonical Catalog Model — Design

**Date:** 2026-07-20
**Status:** Approved (design)
**Scope:** Subsystem #1 of 5 in the backend advancement program

---

## 1. Why

The design-system screens (`apps/web/app/design-system/screens/`) render a data surface the
backend cannot supply. The screens show listening history with provenance, minute totals,
streaks, top artists with play counts, a genre split, a 24-hour histogram, mood tiles,
"You might like", and "Jump back in". Firestore currently stores none of it.

The blocker is not missing fields. It is that **tracks have no independent existence**. They
are embedded as whole objects inside `users.lovedSongs` and `collections.audio`. A track that
lives only inside its containers cannot be counted, ranked, joined, or recommended. Every
downstream feature — stats, history, recommendations — is impossible until tracks become
first-class records.

This spec covers only that: the canonical data model. Four further subsystems build on it and
are explicitly out of scope here (see §10).

## 2. Decisions taken

These were settled during brainstorming and are inputs to this design, not open questions.

| # | Decision | Rationale |
|---|---|---|
| D1 | **Clean break, no migration.** Production holds only the author's own test accounts. | Removes dual-write, backfill, and legacy-shape adapters entirely. |
| D2 | **Global shared catalog + per-user overlay.** | Shared records carry impersonal metadata and aggregates; the overlay carries personal behaviour. Maps exactly onto the privacy screen: "Clear listening history" wipes the overlay and leaves the catalogue intact. |
| D3 | **One `media` entity, discriminated by `type`.** | The UI already renders tracks and episodes through the same `TrackRow`/`MediaCard`. A discriminated union keeps that true in the data layer. Podcasts are aspirational, so the episode block stays thin. |
| D4 | **Labels carry provenance:** `{ label, source, confidence }`, never bare strings. | Mixing an inferred label with a sourced fact in one array is a one-way door — enrichment can never be re-run safely and user corrections can never win. |
| D5 | **Catalog provider is `youtubei.js`, behind an interface.** | Verified live: 0% failure over 30 searches, versus 90% failure for the incumbent. See §3. |

## 3. Provider evaluation (evidence)

Three providers were tested live on 2026-07-20.

**`@fabricio-191/youtube` 0.0.4 (incumbent) — rejected.**
`search()` failed 41 of 46 attempts (~89%). `getVideo()` and `getPlaylist()` are entirely
dead. Failures are parser crashes at `lib/parser/main.js:160` and `lib/parser/utils.js:14`,
not rate limiting — slower pacing did not help. YouTube changed its response markup and the
package has been unmaintained since 0.0.4. It returns no keywords, no category, no genre, and
an always-empty description.

**YouTube Data API v3 (official) — rejected as primary.**
Verified working with a real key. Rich metadata, but `search.list` costs **100 of 10,000 daily
quota units**, giving **~100 searches per day for the entire application, all users combined**.
Not viable for a consumer music app. There is no paid tier; quota increases require a
discretionary written audit. `relatedToVideoId` was removed by Google in 2023, so it cannot
supply a relatedness signal either.

**`youtubei.js` 17.2.0 — selected.**
30 of 30 searches succeeded with no delay and no quota. Verified working: `getInfo` (28
keywords, category, like count, full description, real dates), `getPlaylist` (960-item
playlist, 100 items per page), `music.search` across song/album/artist/playlist,
`music.getUpNext` (50 related songs), `music.getArtist` (bio plus "Fans might also like"),
`music.getExplore` ("Moods & genres"), and `music.getSearchSuggestions`.

Two properties of `music.search` are load-bearing for this design:

1. It returns **structured entities** — `artists: [{name}]`, `album: {name}`, and a clean
   title — instead of a video title string like
   `"Daft Punk - Instant Crush (Official Video) ft. Julian Casablancas"`.
2. It **collapses duplicates**. A plain video search for one song returned five separate
   videos (official, two lyric reuploads, a fan upload, a reaction cut). Keyed by video ID
   those become five tracks with five split play counts, fragmenting every aggregate. The
   Music entity is one canonical song.

**Accepted risks.** `youtubei.js` is an unofficial client of YouTube's internal API, the same
posture as the incumbent — no better, no worse, but actively maintained so it does not rot.
It can break on a YouTube change. §6 mitigates this with a provider interface so a swap is
bounded work rather than a rewrite.

## 4. Naming

The existing model is hostile to programming against: documents wrap their payload in
`{ userData: {...} }` and `{ collectionData: {...} }`; fields use `ID`, `docID`, `URL`,
`private: Boolean`. Under D1 there is no compatibility cost to fixing this.

Rules, applied without exception:

- **No wrapper objects.** Document fields sit at the document root.
- **`camelCase`,** initialisms lowercased except at a word boundary: `id`, `url`, `trackId`,
  `youtubeVideoId`.
- **Booleans read as assertions:** `isEmbeddable`, `isPinned`, `hasLyrics`.
- **Timestamps are `Timestamp`, suffixed `At`:** `createdAt`, `lastPlayedAt`. Never a
  display string. Relative strings like `"4 years ago"` are parsed at ingest or dropped.
- **Durations are integer seconds, suffixed `Sec`:** `durationSec`, `resumeSec`.
- **Counts are suffixed `Count`:** `trackCount`, `playCount`, `followerCount`.
- **No field named `private`** (reserved word in several targets). Use `visibility`.

## 5. Firestore model

Seven collections. Shared catalogue first, then per-user state.

### 5.1 `tracks/{trackId}` — canonical, shared, impersonal

`trackId` is the YouTube **Music** song id where one exists, otherwise the video id.

```ts
type Track = {
  trackId: string;
  type: "track" | "episode";          // D3 discriminator

  title: string;                       // clean: "Instant Crush", not "… (Official Video)"
  artists: { artistId: string; name: string }[];
  album?: { albumId: string; name: string };
  durationSec: number | null;          // null for live streams
  artwork: { url: string; width: number; height: number }[];

  source: {
    provider: "youtube";
    videoId: string;
    url: string;
    aliasVideoIds: string[];           // other videos resolving to this song (dedupe)
  };

  isEmbeddable: boolean;               // HARD GATE — see note below
  isLive: boolean;
  isFamilySafe: boolean;

  stats: { viewCount: number; likeCount: number };
  publishedAt: Timestamp | null;

  labels: {                            // D4 — provenance-tagged
    label: string;                     // slug from the controlled vocabulary (§5.7)
    kind: "genre" | "mood";
    source: "youtube-category" | "youtube-keywords" | "provider-topic"
          | "inferred" | "user";
    confidence: number;                // 0..1
  }[];
  keywords: string[];                  // raw uploader tags, unprocessed input for enrichment

  episode?: { showId: string; number: number | null; publishedAt: Timestamp };

  enrichedAt: Timestamp | null;
  schemaVersion: number;
};
```

**`isEmbeddable` is a correctness requirement, not metadata.** A non-embeddable video cannot
be played by the IFrame player; the user taps play and nothing happens. Every feed, rail,
search result, and recommendation MUST filter on `isEmbeddable === true`. This was discovered
only because the official API exposes it; the incumbent scraper cannot report it at all.

### 5.2 `artists/{artistId}` — shared

```ts
type Artist = {
  artistId: string;                    // YouTube channel id, e.g. "UC_kRDKYrUlrbtrSiyu5Tflg"
  name: string;
  bio: string | null;
  artwork: { url: string; width: number; height: number }[];
  subscriberCount: number | null;
  relatedArtistIds: string[];          // from "Fans might also like"
  labels: Track["labels"];
  enrichedAt: Timestamp | null;
};
```

### 5.3 `collections/{collectionId}` — user-owned playlists

```ts
type Collection = {
  collectionId: string;
  ownerId: string;                     // users/{userId}
  kind: "playlist" | "liked" | "show";

  title: string;
  description: string;
  artwork: { url: string }[];          // explicit, else derived from first tracks
  tags: string[];

  trackIds: string[];                  // IDS ONLY — never embedded track objects
  visibility: "private" | "unlisted" | "public";

  stats: { trackCount: number; totalDurationSec: number; likeCount: number };

  createdAt: Timestamp;
  updatedAt: Timestamp;
};
```

`kind: "liked"` is the auto-created Liked Songs collection, one per user, undeletable.
`stats` is denormalised and maintained transactionally on track add/remove — the Library
screen renders `${trackCount} tracks` per row and must not fan out reads to compute it.

**`trackIds` caps at 5,000.** Beyond that, Firestore's 1 MiB document limit becomes a real
risk. A subcollection design is deferred until a real playlist approaches the cap.

### 5.4 `users/{userId}` — profile and consent

```ts
type User = {
  userId: string;                      // Firebase uid
  displayName: string;
  handle: string | null;
  email: string;
  avatarUrl: string | null;

  counts: { followerCount: number; followingCount: number };

  privacy: {                           // drives /screens/profile/privacy
    saveHistory: boolean;              // default true
    personalization: boolean;          // default true
    publicProfile: boolean;            // default false
  };

  settings: {
    audioQuality: "auto" | "low" | "high";
    language: string;
    theme: "system" | "light" | "dark";
  };

  createdAt: Timestamp;
};
```

Privacy defaults are deliberate: history and personalization default **on** because the product
is built around them, public profile defaults **off** because it exposes the user to others.
Subsystem #2 MUST check `privacy.saveHistory` before writing any event, and #5 MUST check
`privacy.personalization` before using behaviour for ranking.

### 5.5 `users/{userId}/trackState/{trackId}` — the per-user overlay (D2)

```ts
type TrackState = {
  trackId: string;
  isLiked: boolean;
  likedAt: Timestamp | null;
  playCount: number;
  completedCount: number;              // played past the completion threshold
  skipCount: number;                   // abandoned early
  lastPlayedAt: Timestamp | null;
  resumeSec: number;                   // resume position, ALL media (D3 note)
  addedAt: Timestamp;
};
```

Resume position applies to every media type, not just episodes — long mixes and DJ sets need
it too, and `completedCount` versus `skipCount` is a far stronger taste signal than raw
`playCount`. Finishing a six-hour lofi stream and bailing on it at 0:20 both count as one play;
only the completion ratio distinguishes them.

This subcollection is what "Clear listening history" deletes.

### 5.6 `users/{userId}/collectionState/{collectionId}`

```ts
type CollectionState = {
  collectionId: string;
  isPinned: boolean;                   // Library sorts pinned first
  isLiked: boolean;
  lastOpenedAt: Timestamp | null;
};
```

Pin state is per-user rather than on the collection, so pinning works identically for
collections the user owns and collections they merely follow.

### 5.7 `taxonomy/{labelId}` — the controlled vocabulary

A small, hand-authored, version-controlled set of genre and mood slugs. Enrichment maps
*into* this vocabulary; it never invents members of it.

```ts
type Label = {
  labelId: string;                     // "lofi", "ambient", "focus", "night"
  kind: "genre" | "mood";
  displayName: string;
  texture: string;                     // design-system texture key for the explore tile
  aliases: string[];                   // provider strings that map here
  isExploreTile: boolean;
  sortOrder: number;
};
```

Seeded from the eight existing explore tiles (Lo-fi, Ambient, Retro, Podcasts, Night, Focus,
Morning, Glitch), which today are hardcoded in `EXPLORE_TILES`.

Free-form strings are rejected because the explore tiles, the genre split, and recommendation
filters must agree on identity. `"lo-fi"`, `"lofi"`, and `"Lo-Fi"` cannot be three genres.

## 6. Provider abstraction

All provider access sits behind one interface, in `apps/web/lib/catalog/`. No route handler,
component, or store ever imports `youtubei.js` directly.

```ts
interface CatalogProvider {
  search(query: string, opts: { type: "song" | "album" | "artist" | "playlist"; limit: number }):
    Promise<CatalogSearchResult>;
  suggest(query: string): Promise<string[]>;
  getTrack(trackId: string): Promise<ProviderTrack | null>;
  getTracks(trackIds: string[]): Promise<ProviderTrack[]>;
  getArtist(artistId: string): Promise<ProviderArtist | null>;
  getRelatedTracks(trackId: string): Promise<ProviderTrack[]>;   // music.getUpNext
  getPlaylist(playlistId: string): Promise<ProviderPlaylist | null>;
}
```

Layout:

```
lib/catalog/
  types.ts             # Provider* DTOs — provider-neutral
  provider.ts          # the interface + resolution
  youtube/
    client.ts          # Innertube singleton, lazy init
    map.ts             # ProviderTrack <- youtubei.js shapes  (all mapping lives here)
    index.ts           # YoutubeCatalogProvider
  ingest.ts            # ProviderTrack -> Track, upserts tracks/ and artists/
  cache.ts             # persistent search cache
```

`map.ts` is the single blast radius for a provider change. When YouTube alters a shape, one
file changes.

**Ingest is idempotent upsert.** `ingest.ts` writes `tracks/{trackId}` and `artists/{artistId}`
on first sight and refreshes when `enrichedAt` is older than 30 days. `stats` (view/like counts)
is refreshed opportunistically; `labels` with `source: "user"` are never overwritten by
enrichment.

**Search caching is mandatory.** Music search is extremely head-heavy — a small number of
queries dominate. A persistent Firestore-backed cache keyed on the normalised query, TTL 24h,
both cuts provider load and protects against the provider going down. The existing 5-minute
in-memory `TtlCache` is replaced.

## 7. API surface

Route Handlers under `apps/web/app/api/`, replacing the current routes and the Pages-Router
`searchEngine`. Every mutating route derives uid from the verified Bearer token via
`uidFromRequest` — never from the body. Firestore rules stay `allow read, write: if false`.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/catalog/search?q=&type=` | provider search, cached, ingests results |
| GET | `/api/catalog/suggest?q=` | autocomplete |
| GET | `/api/catalog/tracks/[trackId]` | canonical track |
| GET | `/api/catalog/artists/[artistId]` | canonical artist |
| GET | `/api/me` | profile, privacy, settings |
| PATCH | `/api/me` | update privacy / settings |
| GET | `/api/me/collections` | library |
| POST | `/api/collections` | create |
| GET/PATCH/DELETE | `/api/collections/[id]` | read / rename / delete |
| PUT/DELETE | `/api/collections/[id]/tracks/[trackId]` | add / remove (transactional, updates `stats`) |
| PUT | `/api/me/track-state/[trackId]` | like, resume position |
| PUT | `/api/me/collection-state/[id]` | pin |

`/api/searchEngine` (Pages Router, unauthenticated) is deleted. The replacement requires auth,
so provider load is attributable and rate-limitable per user.

## 8. Testing

Follows the Phase 0 harness already in the repo.

- **`map.ts` against recorded fixtures.** Real `youtubei.js` responses captured to JSON —
  including a live stream (`durationSec: null`), a non-embeddable video, a song with no album,
  and a 960-item playlist. These are the shapes that break naive mapping, and fixtures make
  provider drift show up as a failing test rather than a production incident.
- **Ingest idempotency.** Ingesting the same track twice yields one document, unchanged
  `addedAt`, and preserved `source: "user"` labels.
- **Alias collapse.** Five video ids for one song resolve to one `trackId` with four entries
  in `aliasVideoIds`.
- **Collection `stats` consistency.** Concurrent add/remove leaves `trackCount` equal to
  `trackIds.length`. Transactional, so this is a real test not a smoke test.
- **Privacy gates.** With `saveHistory: false`, no overlay write occurs.
- **Route auth.** Every mutating route rejects an absent or forged token, and ignores a `uid`
  supplied in the body.
- **Provider contract.** One integration test per `CatalogProvider` method, network-gated and
  skipped in CI, run manually to detect provider drift early.

## 9. Sequencing

1. `lib/catalog/types.ts` + `provider.ts` — interface first, no implementation.
2. `youtube/map.ts` + fixtures + unit tests.
3. `youtube/client.ts` + `index.ts` — the provider.
4. `ingest.ts` + `cache.ts`.
5. Firestore collections + `taxonomy/` seed.
6. Route handlers, replacing the old ones.
7. Delete `pages/api/searchEngine.ts`, `lib/search/*`, `lib/api/shape.ts`, and the old
   `Audio`/`Collection`/`User` interfaces.
8. Wipe the Firestore test data (D1).

Steps 1–4 are pure additions and land without touching the running app. Step 6 is the cutover.

## 10. Out of scope

Deferred to their own specs, in order:

- **#2 Event ingestion** — turning the ~17 `data-signal` attributes into a batched client
  transport, an ingest endpoint, and an event store, gated on `privacy.saveHistory`.
- **#3 Aggregation** — rolling events into `/profile/stats` (minutes, streak, top artists,
  genre split, 24-hour histogram) and `/profile/recents` with provenance.
- **#4 Taxonomy and enrichment** — populating `labels` from `keywords`, provider topics, and
  `music.getExplore`, and labelling behavioural clusters.
- **#5 Recommendations** — cold start from `music.getUpNext` and related artists, warmed by
  the user's own events, plus playlist co-occurrence mining.

Also out of scope: the desktop grid shell (in progress separately), any change to the
design-system screens, and Flutter or hardware clients.

## 11. Open questions

- **Track-state write volume.** Every play updates `users/{uid}/trackState/{trackId}`. At high
  skip rates this is chatty. Batching belongs to #2's transport; if it proves hot, the counters
  move behind the event pipeline and become derived rather than directly written.
- **Non-music content.** `music.search` covers songs well. Tracks a user reaches through plain
  video search may have no Music entity, so `trackId` falls back to the video id and `artists`
  degrades to the channel. Acceptable, but it means two identity regimes coexist. Revisit if
  it causes duplicate pairs in practice.
