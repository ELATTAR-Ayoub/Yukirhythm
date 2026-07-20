# Yukirhythm Backend — Design

**Date:** 2026-07-20 (rev 2 — supersedes the catalog-only rev 1)
**Status:** Approved (design)
**Scope:** The complete data model, API surface, and algorithms behind the design-system screens.

---

## 1. Why

The screens under `apps/web/app/design-system/screens/` are the product. They render listening
history, minute totals, streaks, top artists, a genre split, an hour-of-day histogram, mood
tiles, suggestions, followers, and public playlists. Firestore stores none of it.

The structural blocker is that **tracks have no independent existence** — they are embedded as
whole objects inside `users.lovedSongs` and `collections.audio`. A track that lives only inside
its containers cannot be counted, ranked, joined, or recommended.

Rev 1 covered the catalog alone. This revision covers everything an audit of all 13 screens
found: social graph, playback state, play events, stats rollups, and the recommendation
algorithms — so the model is designed once against the whole product rather than extended four
times.

## 2. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | **Clean break, no migration.** | Production holds only test accounts. Removes dual-write and backfill entirely. |
| D2 | **Shared catalog + per-user overlay.** | Shared records hold impersonal metadata; overlays hold personal behaviour. "Clear listening history" wipes overlays and leaves the catalogue intact. |
| D3 | **One media entity discriminated by `type`.** | The UI renders tracks and episodes through the same `TrackRow`/`MediaCard`. Podcasts are aspirational, so the episode block stays thin. |
| D4 | **Labels carry provenance:** `{label, kind, source, confidence}`. | Mixing an inferred label with a sourced fact in one array is a one-way door. |
| D5 | **Provider is `youtubei.js`, behind a `CatalogProvider` interface.** | Verified live: 0/30 failures, versus 41/46 for the incumbent. See §3. |
| D6 | **Hybrid artwork.** Tracks carry provider `artwork[]` *and* a deterministic `texture`; collections carry `cover: "texture" \| "mosaic" \| "image"`. | Users must recognize album art on a track. Playlists have no canonical artwork — that is where the texture system earns its place. Mosaics assemble from real track artwork. |
| D7 | **Membership is timestamped:** `tracks: {trackId, addedAt, addedBy}[]`. | "Recently added" sort has nothing to sort by otherwise. |
| D8 | **`TrackState.isLiked` is the single source of truth for likes.** Liked Songs is a *virtual* collection rendered from a query, never a stored document. | Rev 1 modeled likes twice. Two sources of truth for one fact always diverge. |
| D9 | **Collection identity splits into `role` and `contentType`.** | The Library filter chips (Playlists / Podcasts / Liked) mix two orthogonal axes. |
| D10 | **Playback state is persisted server-side.** | Resume, queue, shuffle, and repeat must survive a reload and follow the user across devices — the stated multi-client goal. |

## 3. Provider evidence

Three providers tested live on 2026-07-20.

**`@fabricio-191/youtube` 0.0.4 (incumbent) — rejected.** `search()` failed 41 of 46 attempts.
`getVideo()` and `getPlaylist()` are dead. Failures are parser crashes, not rate limiting —
slower pacing did not help. Unmaintained; returns no keywords, category, or genre, and an
always-empty description.

**YouTube Data API v3 — rejected as primary.** Verified working. `search.list` costs 100 of
10,000 daily units → **~100 searches per day for the entire app, all users combined**. No paid
tier. `relatedToVideoId` was removed in 2023.

**`youtubei.js` 17.2.0 — selected.** 30/30 searches, no quota. Verified: `getInfo` (28 keywords,
category, likes, description, ISO dates), `getPlaylist` (960-item playlist), `music.search`
across song/album/artist/playlist, `music.getUpNext` (50 related songs), `music.getArtist`
(bio + "Fans might also like"), `music.getExplore` ("Moods & genres"), `getSearchSuggestions`.

Two properties are load-bearing:

1. `music.search` returns **structured entities** — `artists: [{name}]`, `album: {name}`, clean
   title — not a video title string.
2. It **collapses duplicates**. A video search for one song returned five separate videos
   (official, two lyric reuploads, a fan upload, a reaction cut). Keyed by video id those become
   five tracks with five split play counts.

**Accepted risk.** Unofficial client of YouTube's internal API. It can break. §7 mitigates with
the provider interface so a swap is bounded work.

## 4. Naming

The old model wrapped payloads in `{userData: {...}}` / `{collectionData: {...}}` and used
`ID`, `docID`, `URL`, `private: Boolean`. Under D1 there is no compatibility cost to fixing it.

- **No wrapper objects.** Fields sit at the document root.
- **`camelCase`**, initialisms lowercased: `id`, `url`, `trackId`, `youtubeVideoId`.
- **Booleans read as assertions:** `isEmbeddable`, `isPinned`, `hasLyrics`.
- **Timestamps are `Timestamp`, suffixed `At`.** Never a display string. Relative labels like
  `"4 years ago"` are parsed at ingest or dropped.
- **Durations are integer seconds, suffixed `Sec`.**
- **Counts are suffixed `Count`.**
- **No field named `private`** (reserved in several targets). Use `visibility`.

## 5. Model

### 5.1 `tracks/{trackId}` — shared, impersonal

`trackId` is the YouTube Music song id where one exists, else the video id.

```ts
type Track = {
  trackId: string;
  type: "track" | "episode";

  title: string;                        // clean: "Instant Crush", not "… (Official Video)"
  artists: { artistId: string; name: string }[];
  album: { albumId: string; name: string } | null;
  durationSec: number | null;           // null for live streams
  artwork: Image[];                     // provider thumbnails (D6)
  texture: TextureName;                 // deterministic from trackId (D6) — see §5.11

  source: {
    provider: "youtube";
    videoId: string;
    url: string;
    aliasVideoIds: string[];            // other videos resolving to this song
  };

  isEmbeddable: boolean;                // HARD GATE — see below
  isLive: boolean;
  isFamilySafe: boolean;

  stats: { viewCount: number; likeCount: number; playCount: number };
  publishedAt: Timestamp | null;

  labels: TrackLabel[];                 // D4
  keywords: string[];                   // raw uploader tags, input for enrichment
  episode?: { showId: string; number: number | null; publishedAt: Timestamp };

  enrichedAt: Timestamp | null;
  schemaVersion: number;
};
```

**`isEmbeddable` is a correctness requirement, not metadata.** A non-embeddable video cannot be
played by the IFrame player — the user taps play and nothing happens. Every feed, rail, search
result, and recommendation MUST filter on `isEmbeddable === true`.

`stats.playCount` is the **global** count across all users, maintained by the event pipeline
(§6). Per-user counts live in the overlay.

### 5.2 `artists/{artistId}` — shared

```ts
type Artist = {
  artistId: string;                     // YouTube channel id
  name: string;
  bio: string | null;
  artwork: Image[];
  subscriberCount: number | null;
  relatedArtistIds: string[];           // from "Fans might also like"
  labels: TrackLabel[];
  enrichedAt: Timestamp | null;
};
```

### 5.3 `collections/{collectionId}` — playlists and shows

```ts
type Collection = {
  collectionId: string;
  ownerId: string;

  role: "playlist" | "show";            // D9 — container role. "liked" is virtual (D8)
  contentType: "music" | "podcast";     // D9 — drives the Library filter chips

  title: string;
  description: string;
  tags: string[];

  cover: "texture" | "mosaic" | "image";   // D6
  texture: TextureName;                    // used when cover === "texture", and as mosaic ground
  imageUrl: string | null;                 // used when cover === "image"

  tracks: { trackId: string; addedAt: Timestamp; addedBy: string }[];  // D7 — ordered

  visibility: "private" | "unlisted" | "public";

  stats: {
    trackCount: number;
    totalDurationSec: number;
    saveCount: number;                  // how many users saved it
    playCount: number;
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
};
```

`stats` is denormalised and maintained transactionally — the Library screen renders
`${trackCount} tracks` per row and must not fan out reads to compute it.

`tracks` caps at **5,000** entries; beyond that Firestore's 1 MiB document limit becomes a real
risk. A subcollection design is deferred until a real playlist approaches the cap.

**Liked Songs is not a document.** It is `users/{uid}/trackState` filtered on
`isLiked == true`, ordered by `likedAt` desc, presented to the UI as a synthetic collection with
a reserved id (`"liked"`). This is D8: one source of truth.

### 5.4 `users/{userId}`

```ts
type User = {
  userId: string;                       // Firebase uid
  displayName: string;
  handle: string | null;                // unique, for public profiles
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  authProvider: "google" | "facebook";  // Settings renders this honestly

  counts: {
    followerCount: number;
    followingCount: number;
    collectionCount: number;
  };

  privacy: {
    saveHistory: boolean;               // default true
    personalization: boolean;           // default true
    publicProfile: boolean;             // default false
  };

  settings: {
    audioQuality: "auto" | "low" | "high";
    language: string;
    theme: "system" | "light" | "dark";
  };

  createdAt: Timestamp;                 // renders as "Joined March 2024"
};
```

Privacy defaults are deliberate: history and personalization default **on** because the product
is built around them; public profile defaults **off** because it exposes the user to others.
The event pipeline MUST check `saveHistory` before writing; recommendations MUST check
`personalization` before using behaviour for ranking.

### 5.5 Social graph

```ts
// users/{userId}/following/{targetUserId}
type FollowEdge = { userId: string; followedAt: Timestamp };

// users/{userId}/followers/{sourceUserId}
type FollowerEdge = { userId: string; followedAt: Timestamp };
```

Both directions are stored so each list is a single-collection read. Writes go through one
transaction that updates both edges and both users' `counts`. Follow is **not** reciprocal and
needs no approval — following a private profile is allowed but reveals nothing.

```ts
// users/{userId}/savedCollections/{collectionId}
type SavedCollection = {
  collectionId: string;
  ownerId: string;
  savedAt: Timestamp;
  isPinned: boolean;
};
```

Saving another user's public playlist creates this record — it does **not** copy the collection.
The Library merges owned collections with saved ones. Unsaving deletes the record and
decrements `stats.saveCount`. A collection that turns `private` after being saved disappears
from savers' libraries; the record is retained so it reappears if made public again.

### 5.6 `users/{userId}/trackState/{trackId}` — the overlay (D2)

```ts
type TrackState = {
  trackId: string;
  isLiked: boolean;
  likedAt: Timestamp | null;            // orders the virtual Liked Songs collection
  playCount: number;
  completedCount: number;               // played past the completion threshold
  skipCount: number;                    // abandoned early
  totalListenedSec: number;             // powers minute totals without rescanning events
  lastPlayedAt: Timestamp | null;
  resumeSec: number;
  addedAt: Timestamp;
};
```

Resume applies to **all** media, not just episodes — long mixes need it too. `completedCount`
versus `skipCount` is a far stronger taste signal than raw `playCount`: finishing a six-hour
lofi stream and bailing at 0:20 both count as one play, and only the completion ratio
distinguishes them.

This subcollection is what "Clear listening history" deletes.

### 5.7 `users/{userId}/collectionState/{collectionId}`

```ts
type CollectionState = {
  collectionId: string;
  isPinned: boolean;
  lastOpenedAt: Timestamp | null;
};
```

Pin state is per-user so pinning works identically for owned and saved collections.

### 5.8 `users/{userId}/playback/current` — a single document (D10)

```ts
type PlaybackState = {
  trackId: string | null;
  sourceType: "collection" | "library" | "search" | "radio";
  sourceId: string | null;              // collectionId when sourceType === "collection"

  queue: string[];                      // resolved trackIds, in play order
  queueIndex: number;                   // -1 when nothing is playing
  manualQueue: string[];                // "play next" entries, consumed before queue

  positionSec: number;
  isPlaying: boolean;
  shuffleMode: boolean;
  repeatMode: "off" | "all" | "one";
  volume: number;                       // 0..1

  deviceId: string;                     // last writer, for multi-device handoff
  updatedAt: Timestamp;
};
```

The UI currently *derives* the queue from the playing collection and has no enqueue, reorder, or
remove. Persisting it enables all three plus cross-device resume, and it is the only place
`shuffleMode`/`repeatMode` can live — today the loop button holds a local boolean nothing reads.

Writes are throttled: `positionSec` flushes every 10s and on pause/stop/unload, not every tick.

### 5.9 `playEvents/{eventId}` — append-only

```ts
type PlayEvent = {
  eventId: string;
  userId: string;
  trackId: string;
  collectionId: string | null;          // provenance — "— from {collection}" on Recents

  startedAt: Timestamp;
  listenedSec: number;                  // actual seconds heard, not track length
  completed: boolean;                   // crossed the completion threshold
  skipped: boolean;

  source: "collection" | "search" | "library" | "radio" | "recommendation";
  recommendationId: string | null;      // closes the loop: which suggestion earned the play
  deviceId: string;
  clientHourOfDay: number;              // 0..23, LOCAL to the user — see §5.10
};
```

**Completion threshold:** `listenedSec >= min(30, durationSec * 0.5)`. Below it, `skipped: true`.
The 30-second floor matches industry convention and stops six-hour mixes from being unskippable.

Written only when `privacy.saveHistory === true`.

### 5.10 `users/{userId}/stats/rollup` — a single document

Recomputing minute totals and histograms from raw events on every profile view does not scale.
A rollup document is maintained incrementally by the event pipeline.

```ts
type StatsRollup = {
  minutesWeek: number;
  minutesMonth: number;
  minutesYear: number;                  // the screens ask for a year window
  minutesAllTime: number;

  streakDays: number;
  lastListenDate: string;               // "YYYY-MM-DD" in the user's timezone

  topArtists: { artistId: string; name: string; plays: number }[];   // top 10
  topTrackIds: string[];                                             // top 10
  genreSplit: { label: string; pct: number }[];                      // sums to 100
  byHour: number[];                                                  // 24 entries, 0..1 normalised

  timezone: string;                     // IANA, e.g. "Africa/Casablanca"
  computedAt: Timestamp;
};
```

**Timezone is stored on the rollup, not inferred at read time.** The hour histogram and the
day-streak are meaningless without it, and a user who travels must not see their history
reshuffle. `clientHourOfDay` is captured on the event so the bucket is correct even if the
timezone later changes.

Rolling windows are recomputed by a scheduled job, not on read — `minutesWeek` is a trailing
7-day figure, and without a sweep it would silently never decrease.

### 5.11 Textures (D6)

`TextureName` is the existing design-system union. A track's texture is assigned deterministically:

```ts
texture = TEXTURE_NAMES[hash(trackId) % TEXTURE_NAMES.length]
```

Stable across sessions and clients, no storage lookup, no coordination. Collections default to
`cover: "mosaic"` when they have ≥1 track (assembled from the first four tracks' `artwork`,
falling back to their textures), otherwise `cover: "texture"`.

### 5.12 `taxonomy/{labelId}` — controlled vocabulary

Hand-authored, version-controlled genre and mood slugs. Enrichment maps *into* this vocabulary
and never invents members of it.

```ts
type Label = {
  labelId: string;                      // "lofi", "ambient", "focus", "night"
  kind: "genre" | "mood";
  displayName: string;
  texture: TextureName;
  aliases: string[];                    // provider strings that map here
  isExploreTile: boolean;
  sortOrder: number;
};
```

Seeded from the eight explore tiles (Lo-fi, Ambient, Retro, Podcasts, Night, Focus, Morning,
Glitch), currently hardcoded in `EXPLORE_TILES`.

Free-form strings are rejected because the explore tiles, the genre split, and recommendation
filters must agree on identity — `"lo-fi"`, `"lofi"`, and `"Lo-Fi"` cannot be three genres.

## 6. Algorithms

Every feed filters `isEmbeddable === true` and excludes tracks the user disliked or skipped
repeatedly. All personalized feeds check `privacy.personalization`; when false they fall back to
the non-personalized variant rather than returning empty.

### 6.1 Jump back in (Home)

Distinct collections from the last 30 days of `playEvents`, deduped by `collectionId`, ordered
by most recent play, capped at 12. Recency only — no scoring. If the user has fewer than 3,
pad with their most recently created or saved collections.

### 6.2 New releases (Home)

Not a global chart — personalized, as stated. Candidate set: tracks published in the last 90
days by artists in the user's `topArtists`, their `relatedArtistIds`, and artists appearing in
their saved collections.

```
score = 0.5 * artistAffinity      // user's plays of that artist, normalised 0..1
      + 0.3 * recency             // linear decay across the 90-day window
      + 0.2 * globalPopularity    // log(viewCount) normalised
```

Cold start (no history): most-recent tracks from the taxonomy labels of whatever the user has
saved; failing that, globally popular recent tracks.

### 6.3 You might like (Search idle)

Blends three sources, deduped, top 20:

1. **Provider radio** — `music.getUpNext` seeded from the user's 5 most-played tracks. This is
   the cold-start engine and works with zero users of our own.
2. **Co-occurrence** — tracks appearing alongside the user's liked tracks in other users' public
   collections, weighted by co-occurrence count.
3. **Label affinity** — tracks matching the user's top taxonomy labels, ordered by popularity.

Weights start at 0.5 / 0.3 / 0.2 and shift toward co-occurrence as the user base grows. Anything
already in the user's library or played in the last 7 days is excluded.

Each returned item carries a `recommendationId` and a human-readable `reason`
(`"Because you played Daft Punk"`), which the event pipeline records on play — closing the loop
so the blend can be evaluated rather than guessed at.

### 6.4 Explore by label (Search tiles)

Today all 8 tiles inject their label as a plain text query, and because track search matches only
title and artist, **six of the eight return zero results**. Replaced by a real query: tracks whose
`labels[].label` matches the tile's `labelId`, ordered by `stats.playCount` then `viewCount`.

### 6.5 Stats derivation

- `minutes*` — sum `listenedSec` over the window ÷ 60. Actual listening, not track length.
- `streakDays` — consecutive days with ≥1 completed play, in the user's timezone.
- `topArtists` — sum `listenedSec` per artist over 90 days; `plays` is the completed-play count.
- `genreSplit` — sum `listenedSec` per taxonomy label, normalised to 100. Tracks with no label
  are excluded from the denominator rather than bucketed as "Other", so the percentages describe
  known genres honestly.
- `byHour` — completed plays per `clientHourOfDay`, normalised so the peak hour is 1.0.

## 7. Provider abstraction

All provider access sits behind one interface in `apps/web/lib/catalog/`. No route handler,
component, or store imports `youtubei.js` directly.

```ts
interface CatalogProvider {
  search(query: string, opts: { type: CatalogSearchType; limit: number }): Promise<CatalogSearchResult>;
  suggest(query: string): Promise<string[]>;
  getTrack(trackId: string): Promise<ProviderTrack | null>;
  getTracks(trackIds: string[]): Promise<ProviderTrack[]>;
  getArtist(artistId: string): Promise<ProviderArtist | null>;
  getRelatedTracks(trackId: string): Promise<ProviderTrack[]>;
  getPlaylist(playlistId: string): Promise<ProviderPlaylist | null>;
}
```

```
lib/catalog/
  types.ts             # provider-neutral DTOs
  provider.ts          # interface + resolution
  youtube/
    client.ts          # Innertube singleton
    map.ts             # ProviderTrack <- youtubei.js shapes  (ALL shape knowledge)
    index.ts           # YoutubeCatalogProvider
  ingest.ts            # ProviderTrack -> Track, upserts tracks/ and artists/
  cache.ts             # persistent search cache
```

`map.ts` is the single blast radius for a provider change.

**Ingest is idempotent upsert**, refreshing when `enrichedAt` is older than 30 days. Labels with
`source: "user"` are never overwritten by enrichment.

**Search caching is mandatory.** Music search is head-heavy; a Firestore-backed cache keyed on
the normalised query, TTL 24h, cuts provider load and survives a provider outage.

## 8. API surface

Route Handlers under `apps/web/app/api/`. Every route derives uid from the verified Bearer token
via `uidFromRequest` — never from the body. Firestore rules stay `allow read, write: if false`.

**Catalog**

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/catalog/search?q=&type=` | provider search, cached, ingests results |
| GET | `/api/catalog/suggest?q=` | autocomplete |
| GET | `/api/catalog/tracks/[trackId]` | canonical track, enriches on first fetch |
| GET | `/api/catalog/artists/[artistId]` | canonical artist |
| GET | `/api/catalog/browse?label=` | explore tiles (§6.4) |

**Library search** — the missing piece the Search screen needs

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/library/search?q=` | the caller's collections and liked tracks by title/tag |

**Feeds**

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/feed/jump-back-in` | §6.1 |
| GET | `/api/feed/new-releases` | §6.2 |
| GET | `/api/feed/you-might-like` | §6.3 |

**Collections**

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/collections` | owned + saved, merged |
| POST | `/api/collections` | create — accepts `title, description, tags, contentType, texture, cover, trackIds` in one call (the wizard sends all seven) |
| GET/PATCH/DELETE | `/api/collections/[id]` | read / edit / delete |
| PUT/DELETE | `/api/collections/[id]/tracks/[trackId]` | add / remove, transactional, updates `stats` |
| PATCH | `/api/collections/[id]/order` | reorder |
| PUT/DELETE | `/api/collections/[id]/save` | save / unsave someone else's public collection |
| GET | `/api/collections/public?ownerId=` | another user's public collections |

**Playback**

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/me/playback` | restore state on load |
| PUT | `/api/me/playback` | throttled write of position, queue, modes |
| POST | `/api/me/playback/queue` | enqueue / play-next |
| DELETE | `/api/me/playback/queue/[index]` | remove from queue |

**Events and stats**

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/events` | batched play events, gated on `saveHistory` |
| GET | `/api/me/stats` | the rollup |
| GET | `/api/me/recents?cursor=` | paginated history with provenance |
| DELETE | `/api/me/history` | clear listening history |

**Me and social**

| Method | Route | Purpose |
|---|---|---|
| GET/POST/PATCH | `/api/me` | profile, privacy, settings |
| PUT | `/api/me/track-state/[trackId]` | like, resume position |
| PUT | `/api/me/collection-state/[id]` | pin |
| GET | `/api/users/[userId]` | public profile, 404 unless `publicProfile` |
| PUT/DELETE | `/api/users/[userId]/follow` | follow / unfollow, transactional counts |
| GET | `/api/users/[userId]/followers` | paginated |
| GET | `/api/users/[userId]/following` | paginated |

`/api/searchEngine` (Pages Router, unauthenticated) is deleted. The replacement requires auth, so
provider load is attributable and rate-limitable per user.

## 9. Event vocabulary

The design-system doc lists ~17 signals; the code emits 21. Reconciled set:

**Emitted and kept:** `play`, `pause`, `seek`, `disc_next`, `disc_prev`, `row_play`, `card_play`,
`shelf_scroll`, `badge_switch`, `loop`, `queue_open`, `disc_toggle`, `shell_search`,
`theme_change`, `player_search`, `player_search_open`, `add_music_open`, `add_music_search`,
`add_music_confirm`.

**Documented but never emitted — resolve:**

| Signal | Resolution |
|---|---|
| `volume_change` | **No volume control exists anywhere in the player.** Add one to `Transport` — it is in the doc, `PlaybackState.volume` needs it, and a music player without volume is a defect. |
| `row_queue` | Add the "Add to queue" item to `TrackMenu`, which is currently three toast stubs. |
| `shelf_see_all` | Wire `seeAllHref` on the Home and Search shelves. |
| `agent_open`, `agent_query` | Retain in the doc; no agent UI yet. |

**Malformed:** `DiscDeck` emits `"disc_next, disc_prev"` as one comma-joined attribute. Split it.

**New signals** required by functionality that has no UI yet (§10): `follow`, `unfollow`,
`collection_save`, `collection_unsave`, `queue_reorder`, `queue_remove`, `shuffle_toggle`,
`repeat_change`, `track_like`, `track_unlike`, `recommendation_play`.

## 10. UI to add

Functionality this spec supports that has no screen yet. These are additions to the design-system
screens, to be built before the migration in §12.

| Surface | Addition |
|---|---|
| `Transport` | volume control (`volume_change`, `PlaybackState.volume`) |
| `Transport` | shuffle and repeat as **real modes** — today loop is an inert local boolean and shuffle is a one-shot random start |
| `TrackMenu` | make Share, Add to playlist, and Like real; add "Add to queue" and "Play next" |
| Queue route | reorder (drag) and remove — no representation today |
| Library | pin/unpin control — `togglePin` exists but nothing reaches it |
| Library | a "Saved" filter chip alongside Playlists / Podcasts / Liked |
| Collection detail | remove-track, per-collection like/save, visibility toggle |
| **New:** `/profile/followers`, `/profile/following` | lists; the counts on `/profile/view` are dead text today |
| **New:** `/user/[handle]` | another user's public profile — their public collections, follow button |
| Search | a Profiles result section, so users are findable |
| Home | wire the notifications bell, currently `toast("No new notifications")` |
| Settings | make audio quality and language real; both are toast stubs |

## 11. Testing

- **`map.ts` against recorded fixtures** — real provider responses including a live stream
  (`durationSec: null`), a non-embeddable video, a song with no album, and a 960-item playlist.
  Fixtures make provider drift a failing test rather than a production incident.
- **Ingest idempotency** — twice yields one document, unchanged `addedAt`, preserved user labels.
- **Alias collapse** — five video ids for one song resolve to one `trackId`.
- **Collection `stats` consistency** — concurrent add/remove leaves `trackCount` equal to
  `tracks.length`. Transactional, so a real concurrency test.
- **Follow symmetry** — following updates both edges and both counts, is idempotent, and
  self-follow is rejected.
- **Save/unsave** — `saveCount` stays consistent; a collection turning private drops out of
  savers' libraries without deleting the record.
- **Privacy gates** — `saveHistory: false` writes no events; `personalization: false` falls back
  to non-personalized feeds rather than empty ones.
- **Completion threshold** — a 20s play of a 6-hour mix is `skipped`; a 45s play is `completed`.
- **Stats windows** — a play 8 days old drops out of `minutesWeek`; the streak breaks on a
  missed day in the user's timezone, not UTC.
- **Route auth** — every route rejects an absent or forged token and ignores a body-supplied uid.
- **Provider contract** — one network-gated integration test per method, skipped in CI.

## 12. Sequencing

| Phase | Subsystem | Delivers |
|---|---|---|
| 1 | **Catalog core** | provider, mapping, ingest, cache, taxonomy, `tracks`/`artists`, catalog + library search routes |
| 2 | **Identity & collections** | `users`, collections with timestamped membership, likes via overlay, pin, save |
| 3 | **Playback state** | persisted queue, shuffle, repeat, resume, volume; the UI additions in §10 |
| 4 | **Events** | client batching, `/api/events`, `playEvents`, privacy gating |
| 5 | **Stats** | rollups, scheduled window sweep, `/profile/stats` and `/recents` on real data |
| 6 | **Social** | follow graph, public profiles, saved collections, discovery |
| 7 | **Recommendations** | the three feeds in §6, `recommendationId` loop closed |
| 8 | **Migration** | screens become the real app — see below |

Phases 1–3 are prerequisites for everything. 4 must precede 5 and 7. 6 is independent of 4–5 and
can run in parallel.

**Phase 8** replaces the current marketing app with the design-system screens: routes move from
`/design-system/screens/*` to the app root, the landing page and legacy dashboard are removed,
`MockStudioProvider` is replaced by real data hooks, and `/design-system` reverts to documentation
only. It is deliberately last — migrating UI onto a backend that is still moving means doing it
twice. It gets its own spec.

## 13. Out of scope

Flutter and hardware clients; the agent/LLM discovery layer (`agent_*` signals reserved);
collaborative playlists (multi-writer); comments; direct messages; offline caching; audio
fingerprint deduplication beyond the alias mechanism in §5.1.

## 14. Open questions

- **Global `playCount` write contention.** A popular track incremented on every play is a
  single-document hotspot. If it proves hot, move to a sharded counter or derive it from a
  scheduled aggregation rather than writing inline.
- **Non-music content identity.** `music.search` covers songs well; tracks reached through plain
  video search may have no Music entity, so `trackId` falls back to the video id and `artists`
  degrades to the channel. Two identity regimes coexist. Revisit if it causes duplicate pairs.
- **Public profile discovery.** `handle` is unique but nothing enforces reservation or
  moderation. Needed before public profiles ship in phase 6.
- **Stats rollup cost.** The scheduled sweep touches every active user's rollup daily. Fine at
  small scale; needs batching or a queue past roughly 10k daily-active users.
