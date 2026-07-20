# Phase 1 — Catalog Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract tracks and artists into first-class Firestore records behind a swappable catalog provider, so play counts, history, stats, and recommendations become computable.

**Architecture:** A `CatalogProvider` interface isolates all YouTube access; `youtubei.js` implements it; a mapping layer converts provider shapes into provider-neutral DTOs; an ingest layer upserts those DTOs into shared `tracks/` and `artists/` collections. Personal behaviour lives in per-user overlay subcollections, never in the shared records. Route Handlers are the only Firestore clients.

**Tech Stack:** Next.js App Router, TypeScript, Firebase Admin SDK (Firestore), `youtubei.js` 17.x, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-20-yukirhythm-backend-design.md`

> **Scope.** Phase 1 of `docs/superpowers/plans/2026-07-20-backend-roadmap.md`: the catalog
> backend and its read routes. Written against spec rev 2.
>
> **In scope:** provider interface, `youtubei.js` implementation, mapping, deterministic
> textures, ingest, search cache, taxonomy, `tracks/` and `artists/` collections, and the five
> `/api/catalog/*` routes.
>
> **Explicitly not in scope:** rewiring the design-system screens. The roadmap originally had
> phase 1 wiring the Search screen, which contradicts phase 8 being the migration — half-real
> screens would mean doing that work twice. The explore tiles get their `/browse` endpoint here;
> the screen starts calling it in phase 8. Verification is against the routes, not the UI.
>
> Also out of scope and moved to their own phases: user, collection, and overlay routes
> (phase 2); `/api/library/search`, which needs collections to exist (phase 2); deleting the old
> data layer and resetting Firestore (phase 8).

---

## Conventions for every task

- Tests are colocated: `foo.ts` → `foo.test.ts` in the same directory.
- Run a single test file with: `npm test --workspace apps/web -- <path>`
- Run everything with: `npm test`
- Typecheck with: `npm run typecheck`
- Prettier: double quotes, 2-space indent, semicolons. Run `npm run format` before committing if unsure.
- Path alias `@/` maps to `apps/web/`.
- Commit after every task. Never batch two tasks into one commit.

## File structure

```
apps/web/lib/catalog/
  types.ts          # provider-neutral DTOs (ProviderTrack, ProviderArtist, ProviderPlaylist)
  provider.ts       # CatalogProvider interface + getCatalogProvider()
  model.ts          # Firestore document types (Track, Artist, Collection, User, ...)
  youtube/
    client.ts       # Innertube singleton
    map.ts          # youtubei.js shapes -> Provider* DTOs  (ONLY file that knows YouTube shapes)
    map.test.ts
    index.ts        # YoutubeCatalogProvider implements CatalogProvider
  ingest.ts         # Provider* DTOs -> Firestore upserts
  ingest.test.ts
  cache.ts          # persistent search cache
  cache.test.ts
  taxonomy.ts       # controlled vocabulary + label mapping
  taxonomy.test.ts

apps/web/app/api/catalog/search/route.ts
apps/web/app/api/catalog/tracks/[trackId]/route.ts
apps/web/app/api/catalog/artists/[artistId]/route.ts
apps/web/app/api/collections/route.ts
apps/web/app/api/collections/[collectionId]/route.ts
apps/web/app/api/collections/[collectionId]/tracks/[trackId]/route.ts
apps/web/app/api/me/route.ts                        (rewritten)
apps/web/app/api/me/track-state/[trackId]/route.ts
apps/web/app/api/me/collection-state/[collectionId]/route.ts

apps/web/scripts/capture-catalog-fixtures.ts
apps/web/lib/catalog/youtube/__fixtures__/*.json

DELETED at Task 12:
  apps/web/pages/api/searchEngine.ts
  apps/web/lib/search/{format,cache}.ts + tests
  apps/web/lib/api/shape.ts
  apps/web/app/api/me/loved-songs/**
  apps/web/app/api/me/loved-collections/**
```

---

## Task 1: Provider-neutral DTOs and the interface

No implementation, no network. This locks the contract every later task codes against.

**Files:**
- Create: `apps/web/lib/catalog/types.ts`
- Create: `apps/web/lib/catalog/provider.ts`

- [ ] **Step 1: Write `types.ts`**

```ts
/**
 * Provider-neutral catalog DTOs. Nothing in this file may reference YouTube
 * shapes — that knowledge lives only in lib/catalog/youtube/map.ts, so a
 * provider swap touches one file.
 */

export type ProviderImage = {
  url: string;
  width: number;
  height: number;
};

export type ProviderArtistRef = {
  artistId: string;
  name: string;
};

export type ProviderAlbumRef = {
  albumId: string;
  name: string;
};

export type ProviderTrack = {
  /** Canonical id. The Music song id when one exists, else the video id. */
  providerTrackId: string;
  /** The playable YouTube video id. May differ from providerTrackId. */
  videoId: string;
  type: "track" | "episode";

  title: string;
  artists: ProviderArtistRef[];
  album: ProviderAlbumRef | null;
  /** Integer seconds. null for live streams, which have no length. */
  durationSec: number | null;
  artwork: ProviderImage[];

  /** False means the IFrame player cannot play it. Callers MUST filter on this. */
  isEmbeddable: boolean;
  isLive: boolean;
  isFamilySafe: boolean;

  viewCount: number;
  likeCount: number;
  /** ISO 8601 string, or null when the provider gives only a relative label. */
  publishedAt: string | null;

  /** Raw uploader tags. Unprocessed input for enrichment (subsystem #4). */
  keywords: string[];
  categoryName: string | null;
};

export type ProviderArtist = {
  artistId: string;
  name: string;
  bio: string | null;
  artwork: ProviderImage[];
  subscriberCount: number | null;
  relatedArtistIds: string[];
};

export type ProviderPlaylist = {
  playlistId: string;
  title: string;
  description: string;
  artwork: ProviderImage[];
  trackCount: number;
  tracks: ProviderTrack[];
};

export type CatalogSearchType = "song" | "album" | "artist" | "playlist";

export type CatalogSearchResult = {
  query: string;
  type: CatalogSearchType;
  tracks: ProviderTrack[];
  artists: ProviderArtist[];
  playlists: ProviderPlaylist[];
};
```

- [ ] **Step 2: Write `provider.ts`**

```ts
import type {
  CatalogSearchResult,
  CatalogSearchType,
  ProviderArtist,
  ProviderPlaylist,
  ProviderTrack,
} from "./types";

export interface CatalogProvider {
  search(
    query: string,
    opts: { type: CatalogSearchType; limit: number }
  ): Promise<CatalogSearchResult>;
  suggest(query: string): Promise<string[]>;
  getTrack(providerTrackId: string): Promise<ProviderTrack | null>;
  getTracks(providerTrackIds: string[]): Promise<ProviderTrack[]>;
  getArtist(artistId: string): Promise<ProviderArtist | null>;
  getRelatedTracks(providerTrackId: string): Promise<ProviderTrack[]>;
  getPlaylist(playlistId: string): Promise<ProviderPlaylist | null>;
}

let override: CatalogProvider | null = null;

/** Swap the provider in tests. Pass null to restore the real one. */
export function setCatalogProvider(p: CatalogProvider | null): void {
  override = p;
}

export async function getCatalogProvider(): Promise<CatalogProvider> {
  if (override) return override;
  const { YoutubeCatalogProvider } = await import("./youtube");
  return new YoutubeCatalogProvider();
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS, no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/catalog/types.ts apps/web/lib/catalog/provider.ts
git commit -m "feat(catalog): define the provider-neutral catalog contract"
```

---

## Task 2: Install youtubei.js and capture fixtures

Fixtures are recorded real responses. They let `map.ts` be tested without network and make provider drift show up as a failing test.

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/scripts/capture-catalog-fixtures.ts`
- Create: `apps/web/lib/catalog/youtube/__fixtures__/` (generated)

- [ ] **Step 1: Install the dependency**

```bash
npm install youtubei.js --workspace apps/web
```

- [ ] **Step 2: Write the capture script**

Create `apps/web/scripts/capture-catalog-fixtures.ts`:

```ts
/**
 * Records real provider responses to __fixtures__/ so map.ts can be tested
 * offline. Re-run when the provider is upgraded; a diff in the fixtures is
 * the early warning that YouTube changed a shape.
 *
 * Run: npx tsx scripts/capture-catalog-fixtures.ts   (from apps/web)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Innertube } from "youtubei.js";

const DIR = join(__dirname, "..", "lib", "catalog", "youtube", "__fixtures__");

// Chosen to cover the shapes that break naive mapping:
//   a5uQMwRMHcs  normal song, has album + multiple artists
//   n61ULEU7CO0  6-hour mix, single artist, no album
const SONG_QUERY = "daft punk instant crush";
const VIDEO_ID = "a5uQMwRMHcs";
const LONG_VIDEO_ID = "n61ULEU7CO0";
const ARTIST_ID = "UC_kRDKYrUlrbtrSiyu5Tflg";
const PLAYLIST_ID = "PLOzDu-MXXLliO9fBNZOQTBDddoA3FzZUo";

function save(name: string, data: unknown): void {
  writeFileSync(join(DIR, `${name}.json`), JSON.stringify(data, null, 2));
  console.log("wrote", name);
}

async function main(): Promise<void> {
  mkdirSync(DIR, { recursive: true });
  const yt = await Innertube.create({ lang: "en", location: "US" });

  const songs = await yt.music.search(SONG_QUERY, { type: "song" });
  save("music-search-song", songs.songs?.contents?.slice(0, 5) ?? []);

  save("video-info", (await yt.getInfo(VIDEO_ID)).basic_info);
  save("video-info-long", (await yt.getInfo(LONG_VIDEO_ID)).basic_info);

  const artist = await yt.music.getArtist(ARTIST_ID);
  save("music-artist", {
    header: artist.header,
    sections: artist.sections?.map((s: { header?: unknown }) => s.header) ?? [],
  });

  const upNext = await yt.music.getUpNext(VIDEO_ID);
  save("music-up-next", upNext.contents?.slice(0, 10) ?? []);

  const playlist = await yt.getPlaylist(PLAYLIST_ID);
  save("playlist", { info: playlist.info, videos: playlist.videos?.slice(0, 5) ?? [] });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 3: Run it**

```bash
cd apps/web && npx tsx scripts/capture-catalog-fixtures.ts
```
Expected: six `wrote …` lines, and six JSON files in `apps/web/lib/catalog/youtube/__fixtures__/`.

- [ ] **Step 4: Verify a fixture is non-empty**

```bash
node -e "const f=require('./apps/web/lib/catalog/youtube/__fixtures__/music-search-song.json');console.log(f.length,'songs; first title:',f[0].title)"
```
Expected: `5 songs; first title: Instant Crush (feat. Julian Casablancas)` (title may vary; it must be non-empty and must NOT contain "Official Video").

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json package-lock.json apps/web/scripts/capture-catalog-fixtures.ts apps/web/lib/catalog/youtube/__fixtures__
git commit -m "chore(catalog): add youtubei.js and record provider fixtures"
```

---

## Task 3: Map a Music song to ProviderTrack

**Files:**
- Create: `apps/web/lib/catalog/youtube/map.ts`
- Test: `apps/web/lib/catalog/youtube/map.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/catalog/youtube/map.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import songs from "./__fixtures__/music-search-song.json";
import { mapMusicSong } from "./map";

describe("mapMusicSong", () => {
  it("maps a song to a ProviderTrack", () => {
    const t = mapMusicSong(songs[0]);
    expect(t.providerTrackId).toBeTruthy();
    expect(t.videoId).toBeTruthy();
    expect(t.type).toBe("track");
    expect(t.title.length).toBeGreaterThan(0);
    expect(t.durationSec).toBeGreaterThan(0);
    expect(t.artists.length).toBeGreaterThan(0);
    expect(t.artists[0].name.length).toBeGreaterThan(0);
  });

  it("keeps the clean Music title, not the video title", () => {
    const t = mapMusicSong(songs[0]);
    expect(t.title).not.toContain("Official Video");
  });

  it("defaults missing optional data rather than throwing", () => {
    const t = mapMusicSong({ id: "x", title: "T" });
    expect(t.providerTrackId).toBe("x");
    expect(t.artists).toEqual([]);
    expect(t.album).toBeNull();
    expect(t.durationSec).toBeNull();
    expect(t.artwork).toEqual([]);
    expect(t.viewCount).toBe(0);
  });

  it("assumes embeddable until getInfo says otherwise", () => {
    expect(mapMusicSong({ id: "x", title: "T" }).isEmbeddable).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test --workspace apps/web -- lib/catalog/youtube/map.test.ts`
Expected: FAIL — `Failed to resolve import "./map"`.

- [ ] **Step 3: Implement `mapMusicSong`**

Create `apps/web/lib/catalog/youtube/map.ts`:

```ts
import type {
  ProviderAlbumRef,
  ProviderArtistRef,
  ProviderImage,
  ProviderTrack,
} from "../types";

/**
 * Converts youtubei.js shapes into provider-neutral DTOs. This is the ONLY
 * file that knows YouTube's response structure. Every field is read
 * defensively: the provider is an unofficial client and shapes drift.
 */

type Raw = Record<string, unknown>;

const asRecord = (v: unknown): Raw => (v && typeof v === "object" ? (v as Raw) : {});
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** youtubei.js text nodes are sometimes a string, sometimes { text }. */
export function text(v: unknown): string {
  if (typeof v === "string") return v;
  const r = asRecord(v);
  return typeof r.text === "string" ? r.text : "";
}

export function mapImages(v: unknown): ProviderImage[] {
  return asArray(v)
    .map((raw) => {
      const t = asRecord(raw);
      return {
        url: typeof t.url === "string" ? t.url : "",
        width: typeof t.width === "number" ? t.width : 0,
        height: typeof t.height === "number" ? t.height : 0,
      };
    })
    .filter((t) => t.url !== "");
}

function mapArtists(v: unknown): ProviderArtistRef[] {
  return asArray(v)
    .map((raw) => {
      const a = asRecord(raw);
      return {
        artistId: typeof a.channel_id === "string" ? a.channel_id : "",
        name: text(a.name),
      };
    })
    .filter((a) => a.name !== "");
}

function mapAlbum(v: unknown): ProviderAlbumRef | null {
  const a = asRecord(v);
  const name = text(a.name);
  if (!name) return null;
  return { albumId: typeof a.id === "string" ? a.id : "", name };
}

export function mapMusicSong(raw: unknown): ProviderTrack {
  const s = asRecord(raw);
  const id = typeof s.id === "string" ? s.id : "";
  const duration = asRecord(s.duration);

  return {
    providerTrackId: id,
    videoId: id,
    type: "track",
    title: text(s.title),
    artists: mapArtists(s.artists),
    album: mapAlbum(s.album),
    durationSec: typeof duration.seconds === "number" ? duration.seconds : null,
    artwork: mapImages(s.thumbnails ?? s.thumbnail),
    // Music search does not report embeddability; getInfo does. Assume
    // playable and let enrichment correct it, rather than hiding everything.
    isEmbeddable: true,
    isLive: false,
    isFamilySafe: true,
    viewCount: 0,
    likeCount: 0,
    publishedAt: null,
    keywords: [],
    categoryName: null,
  };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm test --workspace apps/web -- lib/catalog/youtube/map.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/catalog/youtube/map.ts apps/web/lib/catalog/youtube/map.test.ts
git commit -m "feat(catalog): map Music songs to provider tracks"
```

---

## Task 4: Map video info, artists, and playlists

`getInfo` is the enrichment source — it carries keywords, category, like count, and the embeddability flag that Music search cannot provide.

**Files:**
- Modify: `apps/web/lib/catalog/youtube/map.ts`
- Modify: `apps/web/lib/catalog/youtube/map.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `apps/web/lib/catalog/youtube/map.test.ts`:

```ts
import videoInfo from "./__fixtures__/video-info.json";
import videoInfoLong from "./__fixtures__/video-info-long.json";
import artistFixture from "./__fixtures__/music-artist.json";
import playlistFixture from "./__fixtures__/playlist.json";
import { mapVideoInfo, mapMusicArtist, mapPlaylist, mergeTrack } from "./map";

describe("mapVideoInfo", () => {
  it("extracts enrichment fields", () => {
    const t = mapVideoInfo(videoInfo);
    expect(t.videoId).toBeTruthy();
    expect(t.keywords.length).toBeGreaterThan(0);
    expect(t.categoryName).toBe("Music");
    expect(t.likeCount).toBeGreaterThan(0);
    expect(t.viewCount).toBeGreaterThan(0);
    expect(t.durationSec).toBeGreaterThan(0);
  });

  it("handles a multi-hour video", () => {
    expect(mapVideoInfo(videoInfoLong).durationSec).toBeGreaterThan(3600);
  });

  it("treats a live stream as having no duration", () => {
    const t = mapVideoInfo({ id: "x", title: "T", is_live: true, duration: 0 });
    expect(t.isLive).toBe(true);
    expect(t.durationSec).toBeNull();
  });

  it("reports non-embeddable videos", () => {
    expect(mapVideoInfo({ id: "x", title: "T", embed: null }).isEmbeddable).toBe(false);
  });
});

describe("mergeTrack", () => {
  it("keeps the Music identity and title, taking enrichment from the video", () => {
    const song = mapMusicSong({
      id: "song1",
      title: "Instant Crush",
      artists: [{ name: "Daft Punk", channel_id: "c1" }],
      duration: { seconds: 338 },
    });
    const video = mapVideoInfo(videoInfo);
    const merged = mergeTrack(song, video);

    expect(merged.providerTrackId).toBe("song1");
    expect(merged.title).toBe("Instant Crush");
    expect(merged.artists[0].name).toBe("Daft Punk");
    expect(merged.keywords.length).toBeGreaterThan(0);
    expect(merged.likeCount).toBeGreaterThan(0);
  });
});

describe("mapMusicArtist", () => {
  it("maps the artist header", () => {
    const a = mapMusicArtist("UC_kRDKYrUlrbtrSiyu5Tflg", artistFixture);
    expect(a.artistId).toBe("UC_kRDKYrUlrbtrSiyu5Tflg");
    expect(a.name.length).toBeGreaterThan(0);
  });
});

describe("mapPlaylist", () => {
  it("maps playlist items from the lockup shape", () => {
    const p = mapPlaylist("PL1", playlistFixture);
    expect(p.playlistId).toBe("PL1");
    expect(p.tracks.length).toBeGreaterThan(0);
    expect(p.tracks[0].videoId).toBeTruthy();
    expect(p.tracks[0].title.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm test --workspace apps/web -- lib/catalog/youtube/map.test.ts`
Expected: FAIL — `mapVideoInfo is not exported`.

- [ ] **Step 3: Implement**

Append to `apps/web/lib/catalog/youtube/map.ts`:

```ts
import type { ProviderArtist, ProviderPlaylist } from "../types";

function toIso(v: unknown): string | null {
  if (typeof v !== "string" || v === "") return null;
  const d = new Date(v);
  // Relative labels like "12 years ago" parse to Invalid Date — drop them
  // rather than storing an unusable value.
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function mapVideoInfo(raw: unknown): ProviderTrack {
  const b = asRecord(raw);
  const id = typeof b.id === "string" ? b.id : "";
  const isLive = b.is_live === true;
  const duration = typeof b.duration === "number" ? b.duration : null;
  const channel = asRecord(b.channel);
  const channelId = typeof b.channel_id === "string" ? b.channel_id : "";
  const name = text(b.author) || text(channel.name);

  return {
    providerTrackId: id,
    videoId: id,
    type: "track",
    title: text(b.title),
    artists: name ? [{ artistId: channelId, name }] : [],
    album: null,
    durationSec: isLive || !duration ? null : duration,
    artwork: mapImages(b.thumbnail),
    // `embed` is present only when the video may be embedded.
    isEmbeddable: Boolean(b.embed),
    isLive,
    isFamilySafe: b.is_family_safe !== false,
    viewCount: typeof b.view_count === "number" ? b.view_count : 0,
    likeCount: typeof b.like_count === "number" ? b.like_count : 0,
    publishedAt: toIso(b.start_timestamp),
    keywords: asArray(b.keywords).filter((k): k is string => typeof k === "string"),
    categoryName: typeof b.category === "string" ? b.category : null,
  };
}

/**
 * Combines a Music song (canonical identity, clean title, real artists and
 * album) with its video record (keywords, counts, embeddability). Identity
 * always comes from the song — that is what collapses the five-videos-one-song
 * duplication.
 */
export function mergeTrack(song: ProviderTrack, video: ProviderTrack): ProviderTrack {
  return {
    ...song,
    videoId: video.videoId || song.videoId,
    durationSec: song.durationSec ?? video.durationSec,
    artwork: song.artwork.length ? song.artwork : video.artwork,
    isEmbeddable: video.isEmbeddable,
    isLive: video.isLive,
    isFamilySafe: video.isFamilySafe,
    viewCount: video.viewCount,
    likeCount: video.likeCount,
    publishedAt: video.publishedAt,
    keywords: video.keywords,
    categoryName: video.categoryName,
  };
}

export function mapMusicArtist(artistId: string, raw: unknown): ProviderArtist {
  const a = asRecord(raw);
  const header = asRecord(a.header);
  const subs = asRecord(header.subscribers);
  return {
    artistId,
    name: text(header.title),
    bio: text(header.description) || null,
    artwork: mapImages(header.thumbnail ?? header.thumbnails),
    subscriberCount: typeof subs.count === "number" ? subs.count : null,
    relatedArtistIds: [],
  };
}

/** Playlist rows use the newer lockup shape: metadata rows of text parts. */
export function mapPlaylistItem(raw: unknown): ProviderTrack {
  const it = asRecord(raw);
  const meta = asRecord(it.metadata);
  const inner = asRecord(meta.metadata);
  const rows = asArray(inner.metadata_rows);
  const parts = rows.flatMap((r) =>
    asArray(asRecord(r).metadata_parts).map((p) => text(asRecord(p).text))
  );
  const id = typeof it.content_id === "string" ? it.content_id : "";

  return {
    providerTrackId: id,
    videoId: id,
    type: "track",
    title: text(meta.title),
    artists: parts[0] ? [{ artistId: "", name: parts[0] }] : [],
    album: null,
    durationSec: null,
    artwork: mapImages(asRecord(meta.image).sources),
    isEmbeddable: true,
    isLive: false,
    isFamilySafe: true,
    viewCount: 0,
    likeCount: 0,
    publishedAt: null,
    keywords: [],
    categoryName: null,
  };
}

export function mapPlaylist(playlistId: string, raw: unknown): ProviderPlaylist {
  const p = asRecord(raw);
  const info = asRecord(p.info);
  return {
    playlistId,
    title: text(info.title),
    description: text(info.description),
    artwork: mapImages(info.thumbnails),
    trackCount: typeof info.total_items === "number" ? info.total_items : 0,
    tracks: asArray(p.videos).map(mapPlaylistItem).filter((t) => t.videoId !== ""),
  };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test --workspace apps/web -- lib/catalog/youtube/map.test.ts`
Expected: PASS, all tests.

If `mapMusicArtist` or `mapPlaylist` fails on a field name, inspect the captured fixture and correct the accessor — the fixture is ground truth, not this plan.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/catalog/youtube/map.ts apps/web/lib/catalog/youtube/map.test.ts
git commit -m "feat(catalog): map video info, artists, and playlists"
```

---

## Task 5: The YouTube provider

**Files:**
- Create: `apps/web/lib/catalog/youtube/client.ts`
- Create: `apps/web/lib/catalog/youtube/index.ts`

- [ ] **Step 1: Write the client singleton**

Create `apps/web/lib/catalog/youtube/client.ts`:

```ts
import { Innertube } from "youtubei.js";

let clientPromise: Promise<Innertube> | null = null;

/**
 * One Innertube instance per process. Creation performs a network handshake,
 * so it is cached; a failure clears the cache so the next call retries rather
 * than reusing a rejected promise forever.
 */
export function youtubeClient(): Promise<Innertube> {
  if (!clientPromise) {
    clientPromise = Innertube.create({ lang: "en", location: "US" }).catch((e) => {
      clientPromise = null;
      throw e;
    });
  }
  return clientPromise;
}
```

- [ ] **Step 2: Write the provider**

Create `apps/web/lib/catalog/youtube/index.ts`:

```ts
import type { CatalogProvider } from "../provider";
import type {
  CatalogSearchResult,
  CatalogSearchType,
  ProviderArtist,
  ProviderPlaylist,
  ProviderTrack,
} from "../types";
import { youtubeClient } from "./client";
import {
  mapMusicArtist,
  mapMusicSong,
  mapPlaylist,
  mapVideoInfo,
  mergeTrack,
} from "./map";

/** Never let one bad row take down a whole response. */
function mapSafe<T>(rows: unknown[], fn: (row: unknown) => T): T[] {
  const out: T[] = [];
  for (const row of rows) {
    try {
      out.push(fn(row));
    } catch {
      // skip unmappable row
    }
  }
  return out;
}

export class YoutubeCatalogProvider implements CatalogProvider {
  async search(
    query: string,
    opts: { type: CatalogSearchType; limit: number }
  ): Promise<CatalogSearchResult> {
    const yt = await youtubeClient();
    const res = await yt.music.search(query, { type: opts.type });
    const empty: CatalogSearchResult = {
      query,
      type: opts.type,
      tracks: [],
      artists: [],
      playlists: [],
    };

    if (opts.type === "song") {
      const rows = (res.songs?.contents ?? []).slice(0, opts.limit);
      return { ...empty, tracks: mapSafe(rows, mapMusicSong) };
    }
    if (opts.type === "artist") {
      const rows = (res.artists?.contents ?? []).slice(0, opts.limit);
      return {
        ...empty,
        artists: mapSafe(rows, (r) => {
          const a = r as { id?: string };
          return mapMusicArtist(a.id ?? "", { header: r });
        }),
      };
    }
    return empty;
  }

  async suggest(query: string): Promise<string[]> {
    const yt = await youtubeClient();
    const res = await yt.music.getSearchSuggestions(query);
    const out: string[] = [];
    for (const section of res as unknown as { contents?: unknown[] }[]) {
      for (const item of section.contents ?? []) {
        const s = item as { suggestion?: { text?: string } };
        if (s.suggestion?.text) out.push(s.suggestion.text);
      }
    }
    return out;
  }

  async getTrack(providerTrackId: string): Promise<ProviderTrack | null> {
    const yt = await youtubeClient();
    try {
      const info = await yt.getInfo(providerTrackId);
      return mapVideoInfo(info.basic_info);
    } catch {
      return null;
    }
  }

  async getTracks(ids: string[]): Promise<ProviderTrack[]> {
    const out = await Promise.all(ids.map((id) => this.getTrack(id)));
    return out.filter((t): t is ProviderTrack => t !== null);
  }

  async getArtist(artistId: string): Promise<ProviderArtist | null> {
    const yt = await youtubeClient();
    try {
      return mapMusicArtist(artistId, await yt.music.getArtist(artistId));
    } catch {
      return null;
    }
  }

  async getRelatedTracks(providerTrackId: string): Promise<ProviderTrack[]> {
    const yt = await youtubeClient();
    try {
      const up = await yt.music.getUpNext(providerTrackId);
      const rows = (up.contents ?? []).filter(
        (r: { video_id?: string }) => r.video_id !== providerTrackId
      );
      return mapSafe(rows, (r) => {
        const row = r as { video_id?: string; title?: string; artists?: unknown };
        return mapMusicSong({
          id: row.video_id,
          title: row.title,
          artists: row.artists,
        });
      });
    } catch {
      return [];
    }
  }

  async getPlaylist(playlistId: string): Promise<ProviderPlaylist | null> {
    const yt = await youtubeClient();
    try {
      return mapPlaylist(playlistId, await yt.getPlaylist(playlistId));
    } catch {
      return null;
    }
  }
}

export { mergeTrack };
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Smoke-test against the live provider**

```bash
cd apps/web && npx tsx -e "
import('./lib/catalog/youtube/index.ts').then(async (m) => {
  const p = new m.YoutubeCatalogProvider();
  const r = await p.search('daft punk instant crush', { type: 'song', limit: 3 });
  console.log(r.tracks.map(t => t.title + ' — ' + t.artists.map(a=>a.name).join('/')));
  console.log('related:', (await p.getRelatedTracks(r.tracks[0].providerTrackId)).length);
});
"
```
Expected: 3 clean song titles with artist names, and a related count greater than 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/catalog/youtube/client.ts apps/web/lib/catalog/youtube/index.ts
git commit -m "feat(catalog): implement the youtube catalog provider"
```

---

## Task 6: Firestore document types (spec rev 2)

`model.ts` is the schema home for the whole product, so it defines every document type even
though phases 2–7 are what write most of them. Getting the shapes right once avoids a rewrite.

**Files:**
- Create: `apps/web/lib/catalog/model.ts`

- [ ] **Step 1: Write the model**

Create `apps/web/lib/catalog/model.ts`:

```ts
import type { Timestamp } from "firebase-admin/firestore";
import type { TextureName } from "@/components/studio/textures";

/**
 * Firestore document shapes. Naming rules (spec §4): no wrapper objects,
 * camelCase, `Sec` for durations, `At` for timestamps, `Count` for counts,
 * booleans read as assertions, never a field called `private`.
 */

export const SCHEMA_VERSION = 1;
export const MAX_TRACKS_PER_COLLECTION = 5000;

/** Reserved id for the virtual Liked Songs collection (spec D8). */
export const LIKED_COLLECTION_ID = "liked";

export type Image = { url: string; width: number; height: number };

export type LabelSource =
  | "youtube-category"
  | "youtube-keywords"
  | "provider-topic"
  | "inferred"
  | "user";

export type TrackLabel = {
  label: string;
  kind: "genre" | "mood";
  source: LabelSource;
  confidence: number;
};

export type Track = {
  trackId: string;
  type: "track" | "episode";

  title: string;
  artists: { artistId: string; name: string }[];
  album: { albumId: string; name: string } | null;
  durationSec: number | null;
  /** Provider thumbnails (spec D6). */
  artwork: Image[];
  /** Deterministic from trackId (spec D6, §5.11) — the design-system fallback. */
  texture: TextureName;

  source: {
    provider: "youtube";
    videoId: string;
    url: string;
    aliasVideoIds: string[];
  };

  isEmbeddable: boolean;
  isLive: boolean;
  isFamilySafe: boolean;

  stats: { viewCount: number; likeCount: number; playCount: number };
  publishedAt: Timestamp | null;

  labels: TrackLabel[];
  keywords: string[];
  episode?: { showId: string; number: number | null; publishedAt: Timestamp };

  enrichedAt: Timestamp | null;
  schemaVersion: number;
};

export type Artist = {
  artistId: string;
  name: string;
  bio: string | null;
  artwork: Image[];
  subscriberCount: number | null;
  relatedArtistIds: string[];
  labels: TrackLabel[];
  enrichedAt: Timestamp | null;
};

/** Membership carries its own timestamp so "Recently added" can sort (spec D7). */
export type CollectionTrack = {
  trackId: string;
  addedAt: Timestamp;
  addedBy: string;
};

export type Collection = {
  collectionId: string;
  ownerId: string;

  /** Container role. There is no "liked" role — that collection is virtual (D8). */
  role: "playlist" | "show";
  /** Drives the Library filter chips (D9). */
  contentType: "music" | "podcast";

  title: string;
  description: string;
  tags: string[];

  cover: "texture" | "mosaic" | "image";
  texture: TextureName;
  imageUrl: string | null;

  tracks: CollectionTrack[];
  visibility: "private" | "unlisted" | "public";

  stats: {
    trackCount: number;
    totalDurationSec: number;
    saveCount: number;
    playCount: number;
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type UserPrivacy = {
  saveHistory: boolean;
  personalization: boolean;
  publicProfile: boolean;
};

export type UserSettings = {
  audioQuality: "auto" | "low" | "high";
  language: string;
  theme: "system" | "light" | "dark";
};

export type User = {
  userId: string;
  displayName: string;
  handle: string | null;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  authProvider: "google" | "facebook";
  counts: {
    followerCount: number;
    followingCount: number;
    collectionCount: number;
  };
  privacy: UserPrivacy;
  settings: UserSettings;
  createdAt: Timestamp;
};

export type TrackState = {
  trackId: string;
  isLiked: boolean;
  likedAt: Timestamp | null;
  playCount: number;
  completedCount: number;
  skipCount: number;
  totalListenedSec: number;
  lastPlayedAt: Timestamp | null;
  resumeSec: number;
  addedAt: Timestamp;
};

export type CollectionState = {
  collectionId: string;
  isPinned: boolean;
  lastOpenedAt: Timestamp | null;
};

/**
 * History and personalization default on because the product is built around
 * them; public profile defaults off because it exposes the user to others.
 */
export const DEFAULT_PRIVACY: UserPrivacy = {
  saveHistory: true,
  personalization: true,
  publicProfile: false,
};

export const DEFAULT_SETTINGS: UserSettings = {
  audioQuality: "auto",
  language: "en",
  theme: "system",
};
```

- [ ] **Step 2: Confirm the texture type import path**

`TextureName` must come from wherever the design system already exports it. Find it first:

```bash
cd apps/web && grep -rn "export type TextureName\|export const TEXTURE_NAMES" --include=*.ts --include=*.tsx . | grep -v node_modules
```

Use the real path in the import above rather than the guessed one.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/catalog/model.ts
git commit -m "feat(catalog): define firestore document types"
```

---

## Task 6b: Deterministic track textures

Spec D6/§5.11. Every track needs a texture with no storage lookup and no coordination, stable
across sessions and clients.

**Files:**
- Create: `apps/web/lib/catalog/texture.ts`
- Test: `apps/web/lib/catalog/texture.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { TEXTURE_NAMES } from "@/components/studio/textures";
import { textureForId } from "./texture";

describe("textureForId", () => {
  it("returns a real design-system texture", () => {
    expect(TEXTURE_NAMES).toContain(textureForId("a5uQMwRMHcs"));
  });

  it("is stable for the same id", () => {
    expect(textureForId("a5uQMwRMHcs")).toBe(textureForId("a5uQMwRMHcs"));
  });

  it("spreads ids across more than one texture", () => {
    const seen = new Set(
      Array.from({ length: 200 }, (_, i) => textureForId(`track-${i}`))
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it("never returns undefined for an empty id", () => {
    expect(TEXTURE_NAMES).toContain(textureForId(""));
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test --workspace apps/web -- lib/catalog/texture.test.ts`
Expected: FAIL — cannot resolve `./texture`.

- [ ] **Step 3: Implement**

```ts
import { TEXTURE_NAMES, type TextureName } from "@/components/studio/textures";

/**
 * Assigns a texture from an id with no storage lookup and no coordination —
 * the same track resolves to the same texture on every client and session.
 * FNV-1a: small, stable, and not a security boundary.
 */
export function textureForId(id: string): TextureName {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return TEXTURE_NAMES[hash % TEXTURE_NAMES.length];
}
```

Correct the import path to the real one found in Task 6 Step 2.

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm test --workspace apps/web -- lib/catalog/texture.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/catalog/texture.ts apps/web/lib/catalog/texture.test.ts
git commit -m "feat(catalog): assign track textures deterministically"
```

---

## Task 7: Ingest — idempotent upsert of tracks and artists

**Files:**
- Create: `apps/web/lib/catalog/ingest.ts`
- Test: `apps/web/lib/catalog/ingest.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/catalog/ingest.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const store = new Map<string, Record<string, unknown>>();
const docRef = (path: string) => ({
  get: async () => ({
    exists: store.has(path),
    data: () => store.get(path),
  }),
  set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
    store.set(path, opts?.merge ? { ...(store.get(path) ?? {}), ...data } : data);
  },
});

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: () => ({
    collection: (c: string) => ({ doc: (id: string) => docRef(`${c}/${id}`) }),
  }),
}));

import { toTrackDoc, ingestTrack } from "./ingest";
import type { ProviderTrack } from "./types";

const sample: ProviderTrack = {
  providerTrackId: "song1",
  videoId: "vid1",
  type: "track",
  title: "Instant Crush",
  artists: [{ artistId: "c1", name: "Daft Punk" }],
  album: { albumId: "a1", name: "Random Access Memories" },
  durationSec: 338,
  artwork: [{ url: "http://x/1.jpg", width: 100, height: 100 }],
  isEmbeddable: true,
  isLive: false,
  isFamilySafe: true,
  viewCount: 10,
  likeCount: 2,
  publishedAt: "2013-12-06T08:00:01Z",
  keywords: ["daft punk"],
  categoryName: "Music",
};

describe("toTrackDoc", () => {
  it("uses the provider track id as the document id", () => {
    expect(toTrackDoc(sample).trackId).toBe("song1");
  });

  it("records the playable video id and a watch url", () => {
    const d = toTrackDoc(sample);
    expect(d.source.videoId).toBe("vid1");
    expect(d.source.url).toContain("vid1");
  });

  it("keeps keywords raw and starts with no labels", () => {
    const d = toTrackDoc(sample);
    expect(d.keywords).toEqual(["daft punk"]);
    expect(d.labels).toEqual([]);
  });
});

describe("ingestTrack", () => {
  beforeEach(() => store.clear());

  it("creates the track and its artist", async () => {
    await ingestTrack(sample);
    expect(store.has("tracks/song1")).toBe(true);
    expect(store.has("artists/c1")).toBe(true);
  });

  it("is idempotent — ingesting twice yields one document", async () => {
    await ingestTrack(sample);
    const first = store.get("tracks/song1");
    await ingestTrack(sample);
    expect(store.size).toBe(2); // one track, one artist
    expect(store.get("tracks/song1")?.trackId).toBe(first?.trackId);
  });

  it("collapses aliases: a second video for the same song is recorded, not duplicated", async () => {
    await ingestTrack(sample);
    await ingestTrack({ ...sample, videoId: "vid2" });
    const doc = store.get("tracks/song1") as { source: { aliasVideoIds: string[] } };
    expect(store.has("tracks/song1")).toBe(true);
    expect(doc.source.aliasVideoIds).toContain("vid2");
  });

  it("never overwrites a user-sourced label", async () => {
    store.set("tracks/song1", {
      trackId: "song1",
      labels: [{ label: "lofi", kind: "genre", source: "user", confidence: 1 }],
      source: { videoId: "vid1", aliasVideoIds: [] },
    });
    await ingestTrack(sample);
    const doc = store.get("tracks/song1") as { labels: { source: string }[] };
    expect(doc.labels).toHaveLength(1);
    expect(doc.labels[0].source).toBe("user");
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm test --workspace apps/web -- lib/catalog/ingest.test.ts`
Expected: FAIL — cannot resolve `./ingest`.

- [ ] **Step 3: Implement**

Create `apps/web/lib/catalog/ingest.ts`:

```ts
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { SCHEMA_VERSION, type Artist, type Track } from "./model";
import type { ProviderArtist, ProviderTrack } from "./types";

/** Refresh provider-sourced fields when they are older than this. */
const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export function toTrackDoc(t: ProviderTrack): Track {
  return {
    trackId: t.providerTrackId,
    type: t.type,
    title: t.title,
    artists: t.artists,
    album: t.album,
    durationSec: t.durationSec,
    artwork: t.artwork,
    texture: textureForId(t.providerTrackId),
    source: {
      provider: "youtube",
      videoId: t.videoId,
      url: `https://www.youtube.com/watch?v=${t.videoId}`,
      aliasVideoIds: [],
    },
    isEmbeddable: t.isEmbeddable,
    isLive: t.isLive,
    isFamilySafe: t.isFamilySafe,
    // playCount is global and owned by the event pipeline (phase 4); it starts
    // at zero here and is never overwritten by re-ingest.
    stats: { viewCount: t.viewCount, likeCount: t.likeCount, playCount: 0 },
    publishedAt: t.publishedAt ? Timestamp.fromDate(new Date(t.publishedAt)) : null,
    // Labels are populated by enrichment (subsystem #4), never at ingest.
    labels: [],
    keywords: t.keywords,
    enrichedAt: Timestamp.now(),
    schemaVersion: SCHEMA_VERSION,
  };
}

export function toArtistDoc(a: ProviderArtist): Artist {
  return {
    artistId: a.artistId,
    name: a.name,
    bio: a.bio,
    artwork: a.artwork,
    subscriberCount: a.subscriberCount,
    relatedArtistIds: a.relatedArtistIds,
    labels: [],
    enrichedAt: Timestamp.now(),
  };
}

function isStale(enrichedAt: unknown): boolean {
  const ts = enrichedAt as { toMillis?: () => number } | null;
  if (!ts?.toMillis) return true;
  return Date.now() - ts.toMillis() > STALE_AFTER_MS;
}

/**
 * Upserts a track and its artists. Safe to call on every search result:
 * an existing fresh document is left alone apart from alias tracking, and
 * user-sourced labels are never overwritten by provider data.
 */
export async function ingestTrack(t: ProviderTrack): Promise<void> {
  if (!t.providerTrackId) return;
  const db = adminDb();
  const ref = db.collection("tracks").doc(t.providerTrackId);
  const snap = await ref.get();
  const next = toTrackDoc(t);

  if (!snap.exists) {
    await ref.set(next);
  } else {
    const prev = snap.data() as Track;
    const aliases = new Set(prev.source?.aliasVideoIds ?? []);
    if (t.videoId && t.videoId !== prev.source?.videoId) aliases.add(t.videoId);

    const userLabels = (prev.labels ?? []).filter((l) => l.source === "user");
    const merged: Partial<Track> = {
      source: { ...next.source, videoId: prev.source?.videoId ?? next.source.videoId, aliasVideoIds: [...aliases] },
      labels: userLabels.length ? userLabels : (prev.labels ?? []),
    };
    if (isStale(prev.enrichedAt)) {
      Object.assign(merged, {
        title: next.title,
        artists: next.artists,
        album: next.album,
        durationSec: next.durationSec,
        artwork: next.artwork,
        isEmbeddable: next.isEmbeddable,
        stats: next.stats,
        keywords: next.keywords,
        enrichedAt: next.enrichedAt,
      });
    }
    await ref.set(merged, { merge: true });
  }

  for (const a of t.artists) {
    if (!a.artistId) continue;
    const aRef = db.collection("artists").doc(a.artistId);
    const aSnap = await aRef.get();
    if (!aSnap.exists) {
      await aRef.set(
        toArtistDoc({
          artistId: a.artistId,
          name: a.name,
          bio: null,
          artwork: [],
          subscriberCount: null,
          relatedArtistIds: [],
        })
      );
    }
  }
}

export async function ingestTracks(tracks: ProviderTrack[]): Promise<void> {
  for (const t of tracks) await ingestTrack(t);
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test --workspace apps/web -- lib/catalog/ingest.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/catalog/ingest.ts apps/web/lib/catalog/ingest.test.ts
git commit -m "feat(catalog): ingest provider tracks idempotently"
```

---

## Task 8: Persistent search cache

Music search is head-heavy — a few queries dominate. This cuts provider load and survives a provider outage.

**Files:**
- Create: `apps/web/lib/catalog/cache.ts`
- Test: `apps/web/lib/catalog/cache.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/catalog/cache.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const store = new Map<string, Record<string, unknown>>();
vi.mock("@/lib/firebase/admin", () => ({
  adminDb: () => ({
    collection: () => ({
      doc: (id: string) => ({
        get: async () => ({ exists: store.has(id), data: () => store.get(id) }),
        set: async (d: Record<string, unknown>) => void store.set(id, d),
      }),
    }),
  }),
}));

import { cacheKey, readCache, writeCache } from "./cache";

describe("cacheKey", () => {
  it("normalises case and whitespace so equivalent queries share an entry", () => {
    expect(cacheKey("  Daft   PUNK ", "song")).toBe(cacheKey("daft punk", "song"));
  });

  it("separates entries by search type", () => {
    expect(cacheKey("daft punk", "song")).not.toBe(cacheKey("daft punk", "artist"));
  });

  it("produces a key safe for a firestore document id", () => {
    expect(cacheKey("a/b/c", "song")).not.toContain("/");
  });
});

describe("readCache / writeCache", () => {
  beforeEach(() => {
    store.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("returns null on a miss", async () => {
    expect(await readCache("k1")).toBeNull();
  });

  it("returns the written payload", async () => {
    await writeCache("k1", { tracks: [1] });
    expect(await readCache("k1")).toEqual({ tracks: [1] });
  });

  it("expires entries after the ttl", async () => {
    await writeCache("k1", { tracks: [1] });
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    expect(await readCache("k1")).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm test --workspace apps/web -- lib/catalog/cache.test.ts`
Expected: FAIL — cannot resolve `./cache`.

- [ ] **Step 3: Implement**

Create `apps/web/lib/catalog/cache.ts`:

```ts
import { createHash } from "node:crypto";
import { adminDb } from "@/lib/firebase/admin";
import type { CatalogSearchType } from "./types";

const TTL_MS = 24 * 60 * 60 * 1000;
const COLLECTION = "searchCache";

/**
 * Normalises the query so "  Daft   PUNK " and "daft punk" share one entry,
 * then hashes it — raw queries are not safe Firestore document ids.
 */
export function cacheKey(query: string, type: CatalogSearchType): string {
  const normalised = query.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha1").update(`${type}:${normalised}`).digest("hex");
}

export async function readCache<T>(key: string): Promise<T | null> {
  const snap = await adminDb().collection(COLLECTION).doc(key).get();
  if (!snap.exists) return null;
  const row = snap.data() as { payload?: T; cachedAtMs?: number } | undefined;
  if (!row?.cachedAtMs || Date.now() - row.cachedAtMs > TTL_MS) return null;
  return (row.payload ?? null) as T | null;
}

export async function writeCache(key: string, payload: unknown): Promise<void> {
  await adminDb()
    .collection(COLLECTION)
    .doc(key)
    .set({ payload, cachedAtMs: Date.now() });
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test --workspace apps/web -- lib/catalog/cache.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/catalog/cache.ts apps/web/lib/catalog/cache.test.ts
git commit -m "feat(catalog): add a persistent search cache"
```

---

## Task 9: Taxonomy — the controlled vocabulary

**Files:**
- Create: `apps/web/lib/catalog/taxonomy.ts`
- Test: `apps/web/lib/catalog/taxonomy.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/catalog/taxonomy.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { TAXONOMY, resolveLabel, exploreTiles } from "./taxonomy";

describe("TAXONOMY", () => {
  it("has unique ids", () => {
    const ids = TAXONOMY.map((l) => l.labelId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers the eight explore tiles the search screen renders", () => {
    expect(exploreTiles()).toHaveLength(8);
  });

  it("gives every explore tile a texture for the design system", () => {
    for (const t of exploreTiles()) expect(t.texture.length).toBeGreaterThan(0);
  });
});

describe("resolveLabel", () => {
  it("maps provider spellings onto one canonical id", () => {
    expect(resolveLabel("Lo-Fi")).toBe("lofi");
    expect(resolveLabel("lo fi")).toBe("lofi");
    expect(resolveLabel("lofi hip hop")).toBe("lofi");
  });

  it("is case and whitespace insensitive", () => {
    expect(resolveLabel("  AMBIENT  ")).toBe("ambient");
  });

  it("returns null for anything outside the vocabulary", () => {
    expect(resolveLabel("polka")).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm test --workspace apps/web -- lib/catalog/taxonomy.test.ts`
Expected: FAIL — cannot resolve `./taxonomy`.

- [ ] **Step 3: Implement**

Create `apps/web/lib/catalog/taxonomy.ts`:

```ts
/**
 * The controlled genre/mood vocabulary. Enrichment maps INTO this list and
 * never invents members of it, so the explore tiles, the genre split, and
 * recommendation filters all agree on identity — "lo-fi", "lofi", and "Lo-Fi"
 * cannot become three different genres.
 *
 * Seeded from EXPLORE_TILES in components/studio/screens/mock-data.ts.
 */
export type Label = {
  labelId: string;
  kind: "genre" | "mood";
  displayName: string;
  texture: string;
  aliases: string[];
  isExploreTile: boolean;
  sortOrder: number;
};

export const TAXONOMY: Label[] = [
  { labelId: "lofi", kind: "genre", displayName: "Lo-fi", texture: "grain", aliases: ["lo-fi", "lo fi", "lofi hip hop", "lofi hiphop", "chillhop", "jazzhop"], isExploreTile: true, sortOrder: 1 },
  { labelId: "ambient", kind: "genre", displayName: "Ambient", texture: "mist", aliases: ["ambient music", "drone", "atmospheric"], isExploreTile: true, sortOrder: 2 },
  { labelId: "retro", kind: "genre", displayName: "Retro", texture: "vhs", aliases: ["synthwave", "vaporwave", "retrowave", "80s"], isExploreTile: true, sortOrder: 3 },
  { labelId: "podcasts", kind: "genre", displayName: "Podcasts", texture: "wave", aliases: ["podcast", "talk", "interview"], isExploreTile: true, sortOrder: 4 },
  { labelId: "night", kind: "mood", displayName: "Night", texture: "aurora", aliases: ["late night", "midnight", "nocturnal"], isExploreTile: true, sortOrder: 5 },
  { labelId: "focus", kind: "mood", displayName: "Focus", texture: "lines", aliases: ["study", "concentration", "deep work", "study beats"], isExploreTile: true, sortOrder: 6 },
  { labelId: "morning", kind: "mood", displayName: "Morning", texture: "dawn", aliases: ["wake up", "sunrise", "coffee"], isExploreTile: true, sortOrder: 7 },
  { labelId: "glitch", kind: "genre", displayName: "Glitch", texture: "static", aliases: ["idm", "breakcore", "experimental"], isExploreTile: true, sortOrder: 8 },
  { labelId: "electronic", kind: "genre", displayName: "Electronic", texture: "grain", aliases: ["electronic music", "edm", "house", "techno"], isExploreTile: false, sortOrder: 9 },
  { labelId: "hiphop", kind: "genre", displayName: "Hip hop", texture: "grain", aliases: ["hip hop music", "hip-hop", "rap"], isExploreTile: false, sortOrder: 10 },
  { labelId: "jazz", kind: "genre", displayName: "Jazz", texture: "grain", aliases: ["jazz music", "bebop"], isExploreTile: false, sortOrder: 11 },
  { labelId: "rock", kind: "genre", displayName: "Rock", texture: "grain", aliases: ["rock music", "indie rock", "alternative"], isExploreTile: false, sortOrder: 12 },
];

const INDEX: Map<string, string> = (() => {
  const m = new Map<string, string>();
  const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  for (const l of TAXONOMY) {
    m.set(norm(l.labelId), l.labelId);
    m.set(norm(l.displayName), l.labelId);
    for (const a of l.aliases) m.set(norm(a), l.labelId);
  }
  return m;
})();

export function resolveLabel(raw: string): string | null {
  return INDEX.get(raw.trim().toLowerCase().replace(/[\s_-]+/g, " ")) ?? null;
}

export function exploreTiles(): Label[] {
  return TAXONOMY.filter((l) => l.isExploreTile).sort((a, b) => a.sortOrder - b.sortOrder);
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test --workspace apps/web -- lib/catalog/taxonomy.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/catalog/taxonomy.ts apps/web/lib/catalog/taxonomy.test.ts
git commit -m "feat(catalog): add the controlled genre and mood vocabulary"
```

---

## Task 10: Catalog read routes

**Files:**
- Create: `apps/web/app/api/catalog/search/route.ts`
- Create: `apps/web/app/api/catalog/search/route.test.ts`
- Create: `apps/web/app/api/catalog/tracks/[trackId]/route.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/app/api/catalog/search/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyIdToken = vi.fn();
vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: () => ({ verifyIdToken }),
  adminDb: () => ({
    collection: () => ({
      doc: () => ({ get: async () => ({ exists: false }), set: async () => {} }),
    }),
  }),
}));

const search = vi.fn();
vi.mock("@/lib/catalog/provider", async (orig) => ({
  ...(await orig<typeof import("@/lib/catalog/provider")>()),
  getCatalogProvider: async () => ({ search }),
}));

const ingestTracks = vi.fn();
vi.mock("@/lib/catalog/ingest", () => ({ ingestTracks }));

import { GET } from "@/app/api/catalog/search/route";

const req = (url: string, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, { headers });

const track = {
  providerTrackId: "s1",
  videoId: "v1",
  type: "track",
  title: "T",
  artists: [],
  album: null,
  durationSec: 100,
  artwork: [],
  isEmbeddable: true,
  isLive: false,
  isFamilySafe: true,
  viewCount: 0,
  likeCount: 0,
  publishedAt: null,
  keywords: [],
  categoryName: null,
};

describe("GET /api/catalog/search", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    search.mockReset();
    ingestTracks.mockReset();
    verifyIdToken.mockResolvedValue({ uid: "uid-1" });
  });

  it("401 without a token", async () => {
    verifyIdToken.mockRejectedValue(new Error("bad"));
    expect((await GET(req("/api/catalog/search?q=x"))).status).toBe(401);
  });

  it("400 on an empty query", async () => {
    const res = await GET(req("/api/catalog/search?q=", { Authorization: "Bearer t" }));
    expect(res.status).toBe(400);
  });

  it("returns provider results and ingests them", async () => {
    search.mockResolvedValue({ query: "x", type: "song", tracks: [track], artists: [], playlists: [] });
    const res = await GET(req("/api/catalog/search?q=x", { Authorization: "Bearer t" }));
    expect(res.status).toBe(200);
    expect((await res.json()).tracks).toHaveLength(1);
    expect(ingestTracks).toHaveBeenCalled();
  });

  it("hides non-embeddable tracks — they cannot be played", async () => {
    search.mockResolvedValue({
      query: "x",
      type: "song",
      tracks: [track, { ...track, providerTrackId: "s2", isEmbeddable: false }],
      artists: [],
      playlists: [],
    });
    const res = await GET(req("/api/catalog/search?q=x", { Authorization: "Bearer t" }));
    const body = await res.json();
    expect(body.tracks).toHaveLength(1);
    expect(body.tracks[0].providerTrackId).toBe("s1");
  });

  it("502 when the provider throws", async () => {
    search.mockRejectedValue(new Error("provider down"));
    const res = await GET(req("/api/catalog/search?q=x", { Authorization: "Bearer t" }));
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm test --workspace apps/web -- app/api/catalog/search/route.test.ts`
Expected: FAIL — cannot resolve the route module.

- [ ] **Step 3: Implement the search route**

Create `apps/web/app/api/catalog/search/route.ts`:

```ts
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { getCatalogProvider } from "@/lib/catalog/provider";
import { ingestTracks } from "@/lib/catalog/ingest";
import { cacheKey, readCache, writeCache } from "@/lib/catalog/cache";
import type { CatalogSearchResult, CatalogSearchType } from "@/lib/catalog/types";

const MAX_QUERY_LEN = 200;
const DEFAULT_LIMIT = 20;
const TYPES: CatalogSearchType[] = ["song", "album", "artist", "playlist"];

export async function GET(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) return Response.json({ error: "Query is required" }, { status: 400 });
  if (q.length > MAX_QUERY_LEN)
    return Response.json({ error: "Query is too long" }, { status: 400 });

  const rawType = url.searchParams.get("type") ?? "song";
  const type = (TYPES as string[]).includes(rawType)
    ? (rawType as CatalogSearchType)
    : "song";

  const key = cacheKey(q, type);
  const cached = await readCache<CatalogSearchResult>(key);
  if (cached) return Response.json(cached);

  try {
    const provider = await getCatalogProvider();
    const result = await provider.search(q, { type, limit: DEFAULT_LIMIT });

    // A non-embeddable track cannot be played by the IFrame player, so it must
    // never reach the UI.
    const playable = result.tracks.filter((t) => t.isEmbeddable);
    const body: CatalogSearchResult = { ...result, tracks: playable };

    await ingestTracks(playable);
    await writeCache(key, body);
    return Response.json(body);
  } catch {
    return Response.json({ error: "Search is temporarily unavailable" }, { status: 502 });
  }
}
```

**Known limitation, deliberate.** Music search does not report embeddability, so
`mapMusicSong` sets `isEmbeddable: true` optimistically. The filter above therefore only
excludes tracks already *known* bad from a previous `getInfo`. Real verification happens in the
track route below, which is hit before playback. Enriching all 20 search results eagerly would
mean 20 extra provider round-trips per search — too slow. Do not "fix" this by removing the
filter; it becomes effective as the catalogue warms.

- [ ] **Step 4: Implement the track route**

Create `apps/web/app/api/catalog/tracks/[trackId]/route.ts`:

```ts
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { getCatalogProvider } from "@/lib/catalog/provider";
import { ingestTrack } from "@/lib/catalog/ingest";
import { mergeTrack } from "@/lib/catalog/youtube/map";
import type { Track } from "@/lib/catalog/model";
import type { ProviderTrack } from "@/lib/catalog/types";

/** Rebuild a ProviderTrack from a stored doc so it can be merged with fresh video data. */
function toProviderTrack(d: Track): ProviderTrack {
  return {
    providerTrackId: d.trackId,
    videoId: d.source.videoId,
    type: d.type,
    title: d.title,
    artists: d.artists,
    album: d.album,
    durationSec: d.durationSec,
    artwork: d.artwork,
    isEmbeddable: d.isEmbeddable,
    isLive: d.isLive,
    isFamilySafe: d.isFamilySafe,
    viewCount: d.stats.viewCount,
    likeCount: d.stats.likeCount,
    publishedAt: null,
    keywords: d.keywords,
    categoryName: null,
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ trackId: string }> }
): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const { trackId } = await params;
  const ref = adminDb().collection("tracks").doc(trackId);
  const snap = await ref.get();
  const provider = await getCatalogProvider();

  // A stored doc from search has optimistic embeddability and no keywords.
  // Enrich it once from the video record, keeping the Music identity.
  if (snap.exists) {
    const stored = snap.data() as Track;
    if (stored.keywords.length === 0) {
      const video = await provider.getTrack(stored.source.videoId);
      if (video) await ingestTrack(mergeTrack(toProviderTrack(stored), video));
      return Response.json((await ref.get()).data());
    }
    return Response.json(stored);
  }

  // Not seen before — fetch from the provider, store, and return.
  const track = await provider.getTrack(trackId);
  if (!track) return Response.json({ error: "Not found" }, { status: 404 });

  await ingestTrack(track);
  return Response.json((await ref.get()).data());
}
```

- [ ] **Step 5: Run, verify pass**

Run: `npm test --workspace apps/web -- app/api/catalog/search/route.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/catalog
git commit -m "feat(api): add authenticated catalog search and track routes"
```

---

## Task 11: Browse by label, artists route, and suggest

Closes ledger row 9. Today all 8 explore tiles inject their label as a plain text query, and
because track search matches only title and artist, **six of the eight return zero results**.

**Files:**
- Create: `apps/web/app/api/catalog/browse/route.ts`
- Create: `apps/web/app/api/catalog/browse/route.test.ts`
- Create: `apps/web/app/api/catalog/artists/[artistId]/route.ts`
- Create: `apps/web/app/api/catalog/suggest/route.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyIdToken, where, limit, get } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  get: vi.fn(),
}));

vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: () => ({ verifyIdToken }),
  adminDb: () => ({ collection: () => ({ where, limit, get }) }),
}));

import { GET } from "@/app/api/catalog/browse/route";

const req = (url: string, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, { headers });

describe("GET /api/catalog/browse", () => {
  beforeEach(() => {
    verifyIdToken.mockReset().mockResolvedValue({ uid: "u1" });
    where.mockReset().mockReturnValue({ where, limit, get });
    limit.mockReset().mockReturnValue({ get });
    get.mockReset().mockResolvedValue({ docs: [] });
  });

  it("401 without a token", async () => {
    verifyIdToken.mockRejectedValue(new Error("bad"));
    expect((await GET(req("/api/catalog/browse?label=lofi"))).status).toBe(401);
  });

  it("400 on a label outside the controlled vocabulary", async () => {
    const res = await GET(req("/api/catalog/browse?label=polka", { Authorization: "Bearer t" }));
    expect(res.status).toBe(400);
  });

  it("accepts a provider spelling and resolves it to the canonical label", async () => {
    const res = await GET(req("/api/catalog/browse?label=Lo-Fi", { Authorization: "Bearer t" }));
    expect(res.status).toBe(200);
    expect(where).toHaveBeenCalledWith("labelIds", "array-contains", "lofi");
  });

  it("only returns playable tracks", async () => {
    await GET(req("/api/catalog/browse?label=lofi", { Authorization: "Bearer t" }));
    expect(where).toHaveBeenCalledWith("isEmbeddable", "==", true);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test --workspace apps/web -- app/api/catalog/browse/route.test.ts`
Expected: FAIL — cannot resolve the route module.

- [ ] **Step 3: Add the flat label index**

`Track.labels` is an array of objects, and Firestore's `array-contains` cannot match a nested
field — the query would silently return nothing. Add a flat companion to `model.ts`:

```ts
  labels: TrackLabel[];
  /** Flat mirror of labels[].label. array-contains cannot match nested fields. */
  labelIds: string[];
```

Populate it in `ingest.ts` alongside `labels` (both empty at ingest; enrichment in phase 4
writes them together and must keep them in step).

- [ ] **Step 4: Implement the browse route**

```ts
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { resolveLabel } from "@/lib/catalog/taxonomy";

const LIMIT = 40;

export async function GET(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const raw = (new URL(req.url).searchParams.get("label") ?? "").trim();
  // Enrichment writes only canonical slugs, so a free-form string can never
  // match. Resolving here is what lets "Lo-Fi" and "lo fi" both work.
  const label = resolveLabel(raw);
  if (!label) {
    return Response.json({ error: "Unknown label" }, { status: 400 });
  }

  const snap = await adminDb()
    .collection("tracks")
    .where("isEmbeddable", "==", true)
    .where("labelIds", "array-contains", label)
    .limit(LIMIT)
    .get();

  return Response.json({ label, tracks: snap.docs.map((d) => d.data()) });
}
```

- [ ] **Step 5: Implement the artists and suggest routes**

Create `apps/web/app/api/catalog/artists/[artistId]/route.ts`:

```ts
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { getCatalogProvider } from "@/lib/catalog/provider";
import { toArtistDoc } from "@/lib/catalog/ingest";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ artistId: string }> }
): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const { artistId } = await params;
  const ref = adminDb().collection("artists").doc(artistId);
  const snap = await ref.get();
  // Track ingest creates name-only stubs; a stub has no bio, so refresh once.
  if (snap.exists && (snap.data() as { bio?: string | null }).bio) {
    return Response.json(snap.data());
  }

  const artist = await (await getCatalogProvider()).getArtist(artistId);
  if (!artist) {
    if (snap.exists) return Response.json(snap.data());
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await ref.set({ ...toArtistDoc(artist), enrichedAt: Timestamp.now() }, { merge: true });
  return Response.json((await ref.get()).data());
}
```

Create `apps/web/app/api/catalog/suggest/route.ts`:

```ts
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { getCatalogProvider } from "@/lib/catalog/provider";

export async function GET(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (!q) return Response.json({ suggestions: [] });

  try {
    return Response.json({
      suggestions: await (await getCatalogProvider()).suggest(q),
    });
  } catch {
    // Autocomplete is decorative — degrade silently rather than error.
    return Response.json({ suggestions: [] });
  }
}
```

- [ ] **Step 6: Run the tests**

Run: `npm test --workspace apps/web -- app/api/catalog`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/api/catalog apps/web/lib/catalog
git commit -m "feat(api): browse by label, artist, and suggest routes"
```

---

## Task 12: Provider contract test

Detects provider drift early. `youtubei.js` is an unofficial client and the previous scraper
rotted to a 90% failure rate — this is the early-warning system.

**Files:**
- Create: `apps/web/lib/catalog/youtube/contract.test.ts`

- [ ] **Step 1: Write it**

```ts
import { describe, it, expect } from "vitest";
import { YoutubeCatalogProvider } from "./index";

// Network-gated: CATALOG_LIVE=1 npm test -- lib/catalog/youtube/contract
const live = process.env.CATALOG_LIVE === "1";

describe.skipIf(!live)("YoutubeCatalogProvider (live)", () => {
  const p = new YoutubeCatalogProvider();

  it("searches songs with clean titles and structured artists", async () => {
    const r = await p.search("daft punk instant crush", { type: "song", limit: 5 });
    expect(r.tracks.length).toBeGreaterThan(0);
    expect(r.tracks[0].title).not.toContain("Official Video");
    expect(r.tracks[0].artists.length).toBeGreaterThan(0);
  }, 30000);

  it("fetches a track with keywords and an embeddability flag", async () => {
    const t = await p.getTrack("a5uQMwRMHcs");
    expect(t).not.toBeNull();
    expect(t?.keywords.length).toBeGreaterThan(0);
    expect(typeof t?.isEmbeddable).toBe("boolean");
  }, 30000);

  it("returns related tracks for the cold-start recommender", async () => {
    expect((await p.getRelatedTracks("a5uQMwRMHcs")).length).toBeGreaterThan(0);
  }, 30000);

  it("fetches a playlist", async () => {
    const pl = await p.getPlaylist("PLOzDu-MXXLliO9fBNZOQTBDddoA3FzZUo");
    expect(pl).not.toBeNull();
    expect(pl?.tracks.length).toBeGreaterThan(0);
  }, 30000);
});
```

- [ ] **Step 2: Run it live once**

Run: `cd apps/web && CATALOG_LIVE=1 npx vitest run lib/catalog/youtube/contract`
Expected: 4 PASS. A failure means the provider drifted — recapture fixtures (Task 2) and fix
`map.ts`.

- [ ] **Step 3: Confirm it skips by default**

Run: `npm test --workspace apps/web -- lib/catalog/youtube/contract`
Expected: skipped, not failed.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/catalog/youtube/contract.test.ts
git commit -m "test(catalog): network-gated provider contract test"
```

---

## Verification

- [ ] `npm run typecheck && npm test && npm run build` all pass
- [ ] `CATALOG_LIVE=1` contract test passes against the live provider
- [ ] With a dev server and a valid Firebase ID token:
      `GET /api/catalog/search?q=daft+punk` returns clean song titles with structured artists,
      and `tracks/` gains documents keyed by song id
- [ ] Every returned track has `isEmbeddable: true`, a `texture`, and empty `labels`
- [ ] The same search twice hits the cache — the second call does not reach the provider
- [ ] `GET /api/catalog/browse?label=Lo-Fi` resolves to `lofi` and returns only playable tracks
- [ ] `GET /api/catalog/browse?label=polka` returns 400
- [ ] Every route returns 401 without a Bearer token
- [ ] Update roadmap §10: ledger row 9 closed; row 10 (`/api/library/search`) moves to phase 2,
      since it needs collections to exist

## Not done in this phase

The design-system screens still render mock data. Wiring them to these routes is phase 8.
