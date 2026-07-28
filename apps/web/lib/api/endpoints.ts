/**
 * The single source of truth for every backend API link.
 *
 * Adding an endpoint is one line here — the whole app references paths by name,
 * never by hand-typed string, so a rename (like the standardization pass) never
 * leaves a stray literal behind. Mirrors the page-route registry in
 * components/studio/shell/routes.ts, one level up: that file owns page URLs,
 * this one owns API URLs.
 *
 * Convention (see spec §8): plural resource nouns, no action words in the path
 * — the HTTP method carries the verb. Per-user resources live under `/me`,
 * shared catalog under `/catalog`, owned playlists under `/collections`, other
 * users under `/users`. A collection is filtered with query params, never an
 * action segment.
 *
 * This registry covers the FULL system, not only what is built today. Entries
 * marked (planned) resolve to real routes as their phase lands; the URL is
 * stable from now so callers and tests can be written against it early.
 */

const API = "/api";

const enc = encodeURIComponent;

/** Append a query string, dropping empty/undefined values. */
function qs(
  params: Record<string, string | number | undefined | null>
): string {
  const usable = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (!usable.length) return "";
  return "?" + usable.map(([k, v]) => `${k}=${enc(String(v))}`).join("&");
}

export const endpoints = {
  /** Shared catalog (search + canonical track/artist records). */
  catalog: {
    search: (q: string, type?: "song" | "album" | "artist" | "playlist") =>
      `${API}/catalog/search${qs({ q, type })}`,
    suggest: (q: string) => `${API}/catalog/suggest${qs({ q })}`,
    tracksByIds: (trackIds: string[]) =>
      `${API}/catalog/tracks${qs({ ids: trackIds.join(",") })}`,
    /** Tracks filtered by a taxonomy label — the explore tiles. */
    tracksByLabel: (label: string) => `${API}/catalog/tracks${qs({ label })}`,
    track: (trackId: string) => `${API}/catalog/tracks/${enc(trackId)}`,
    artist: (artistId: string) => `${API}/catalog/artists/${enc(artistId)}`,
  },

  /** Owned playlists and their membership. */
  collections: {
    list: () => `${API}/collections`,
    create: () => `${API}/collections`,
    one: (id: string) => `${API}/collections/${enc(id)}`,
    /** PATCH here reorders; body is the ordered trackIds. */
    tracks: (id: string) => `${API}/collections/${enc(id)}/tracks`,
    track: (id: string, trackId: string) =>
      `${API}/collections/${enc(id)}/tracks/${enc(trackId)}`,
    /** Save / unsave another user's public collection. (planned — phase 6) */
    save: (id: string) => `${API}/collections/${enc(id)}/save`,
    /** Another user's public collections. (planned — phase 6) */
    publicOf: (ownerId: string) =>
      `${API}/collections/public${qs({ ownerId })}`,
  },

  /** The authenticated user — everything scoped to the caller's token. */
  me: {
    root: () => `${API}/me`,
    /** The caller's own collections and liked tracks by title/tag. */
    library: (q: string) => `${API}/me/library${qs({ q })}`,
    /** Liked Songs — the virtual collection. */
    likes: () => `${API}/me/likes`,
    /** Per-track overlay: like, resume position. */
    track: (trackId: string) => `${API}/me/tracks/${enc(trackId)}`,
    /** Pin / unpin a collection. */
    pin: (collectionId: string) => `${API}/me/pins/${enc(collectionId)}`,
    /** Persisted playback state. (planned — phase 3) */
    playback: () => `${API}/me/playback`,
    playbackQueue: () => `${API}/me/playback/queue`,
    playbackQueueItem: (index: number) => `${API}/me/playback/queue/${index}`,
    /** Listening stats rollup. (planned — phase 5) */
    stats: () => `${API}/me/stats`,
    /** History with provenance, paginated. (planned — phase 5) */
    recents: (cursor?: string) => `${API}/me/recents${qs({ cursor })}`,
    /** Clear listening history. (planned — phase 4) */
    history: () => `${API}/me/history`,
  },

  /** Recommendation feeds. (planned — phase 7) */
  feed: {
    jumpBackIn: () => `${API}/feed/jump-back-in`,
    newReleases: () => `${API}/feed/new-releases`,
    youMightLike: () => `${API}/feed/you-might-like`,
  },

  /** Batched play/behaviour events. (planned — phase 4) */
  events: {
    ingest: () => `${API}/events`,
  },

  shares: {
    playlists: () => `${API}/shares/playlists`,
  },

  /** Other users — the social surface. Music sharing lives here. (planned — phase 6) */
  users: {
    /** Public profile; 404 unless the user made it public. */
    profile: (userId: string) => `${API}/users/${enc(userId)}`,
    follow: (userId: string) => `${API}/users/${enc(userId)}/follow`,
    followers: (userId: string) => `${API}/users/${enc(userId)}/followers`,
    following: (userId: string) => `${API}/users/${enc(userId)}/following`,
  },
} as const;

export type Endpoints = typeof endpoints;
