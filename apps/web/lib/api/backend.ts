import { endpoints } from "./endpoints";
import type {
  Artist,
  Collection,
  PlaybackState,
  PublicProfile,
  StatsRollup,
  Track,
  TrackState,
  User,
} from "@/lib/catalog/model";

/** A recommended track with why it surfaced — for the feed rails and the loop. */
export type FeedItem = {
  trackId: string;
  score: number;
  reason: string;
  recommendationId: string;
  track: Track;
};

export type RecentsPage = {
  items: {
    eventId: string;
    trackId: string;
    startedAtMs: number;
    listenedSec: number;
    track: Track | null;
    collection: { collectionId: string; title: string } | null;
  }[];
  nextCursor: number | null;
};

/**
 * The typed browser client for the standardized backend. Every method routes
 * through `endpoints` — no hand-typed URLs — and every request carries the
 * caller's Firebase ID token. This is the one client the real screens use
 * (phase 8 wires them onto it); it grows one method per endpoint as later
 * phases land, mirroring `endpoints`.
 *
 * The token is injected by whatever created the client, so this module stays
 * free of Firebase imports and is trivial to test.
 */

export type TokenProvider = () => Promise<string | null>;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createBackendClient(getToken: TokenProvider) {
  async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const token = await getToken();
    const headers = new Headers(init?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init?.body) headers.set("Content-Type", "application/json");

    const res = await fetch(url, { ...init, headers });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}) as { error?: string });
      throw new ApiError(res.status, detail.error ?? res.statusText);
    }
    // 204 and other empty bodies parse to null rather than throwing.
    return (await res.json().catch(() => null)) as T;
  }

  const body = (data: unknown) => JSON.stringify(data);

  return {
    catalog: {
      search: (q: string, type?: "song" | "album" | "artist" | "playlist") =>
        request<{ tracks: Track[]; artists: Artist[] }>(
          endpoints.catalog.search(q, type)
        ),
      suggest: (q: string) =>
        request<{ suggestions: string[] }>(endpoints.catalog.suggest(q)),
      tracksByLabel: (label: string) =>
        request<{ label: string; tracks: Track[] }>(
          endpoints.catalog.tracksByLabel(label)
        ),
      track: (trackId: string) =>
        request<Track>(endpoints.catalog.track(trackId)),
      artist: (artistId: string) =>
        request<Artist>(endpoints.catalog.artist(artistId)),
    },

    /** Batched play/behaviour events — flushed by the transport, gated on consent. */
    events: {
      ingest: (events: unknown[]) =>
        request<{ ok: true; written?: number }>(endpoints.events.ingest(), {
          method: "POST",
          body: body({ events }),
        }),
    },

    shares: {
      publishPlaylist: (collectionId: string) =>
        request<{ shareId: string; path: string }>(
          endpoints.shares.playlists(),
          {
            method: "POST",
            body: body({ collectionId }),
          }
        ),
    },

    /** Recommendation feeds — every item carries a recommendationId + reason. */
    feed: {
      jumpBackIn: () =>
        request<{ collections: Collection[] }>(endpoints.feed.jumpBackIn()),
      newReleases: () =>
        request<{ personalized: boolean; items: FeedItem[] }>(
          endpoints.feed.newReleases()
        ),
      youMightLike: () =>
        request<{ personalized: boolean; items: FeedItem[] }>(
          endpoints.feed.youMightLike()
        ),
    },

    collections: {
      list: () => request<Collection[]>(endpoints.collections.list()),
      create: (input: Partial<Collection> & { title: string }) =>
        request<Collection>(endpoints.collections.create(), {
          method: "POST",
          body: body(input),
        }),
      get: (id: string) => request<Collection>(endpoints.collections.one(id)),
      update: (id: string, patch: Partial<Collection>) =>
        request<Collection>(endpoints.collections.one(id), {
          method: "PATCH",
          body: body(patch),
        }),
      remove: (id: string) =>
        request<{ ok: true }>(endpoints.collections.one(id), {
          method: "DELETE",
        }),
      reorder: (id: string, trackIds: string[]) =>
        request<{ ok: true }>(endpoints.collections.tracks(id), {
          method: "PATCH",
          body: body({ trackIds }),
        }),
      addTrack: (id: string, trackId: string) =>
        request<{ ok: true }>(endpoints.collections.track(id, trackId), {
          method: "PUT",
        }),
      removeTrack: (id: string, trackId: string) =>
        request<{ ok: true }>(endpoints.collections.track(id, trackId), {
          method: "DELETE",
        }),
      /** Save / unsave another user's public collection. */
      save: (id: string) =>
        request<{ saved: true }>(endpoints.collections.save(id), {
          method: "PUT",
        }),
      unsave: (id: string) =>
        request<{ saved: false }>(endpoints.collections.save(id), {
          method: "DELETE",
        }),
      publicOf: (ownerId: string) =>
        request<Collection[]>(endpoints.collections.publicOf(ownerId)),
    },

    /** Other users — the social surface. */
    users: {
      profile: (userId: string) =>
        request<PublicProfile>(endpoints.users.profile(userId)),
      follow: (userId: string) =>
        request<{ following: true }>(endpoints.users.follow(userId), {
          method: "PUT",
        }),
      unfollow: (userId: string) =>
        request<{ following: false }>(endpoints.users.follow(userId), {
          method: "DELETE",
        }),
      followers: (userId: string) =>
        request<{ items: { userId: string }[]; nextCursor: number | null }>(
          endpoints.users.followers(userId)
        ),
      following: (userId: string) =>
        request<{ items: { userId: string }[]; nextCursor: number | null }>(
          endpoints.users.following(userId)
        ),
    },

    me: {
      get: () => request<User | null>(endpoints.me.root()),
      ensure: (input: Partial<User>) =>
        request<User>(endpoints.me.root(), {
          method: "POST",
          body: body(input),
        }),
      update: (patch: Partial<User>) =>
        request<User>(endpoints.me.root(), {
          method: "PATCH",
          body: body(patch),
        }),
      library: (q: string) =>
        request<{ collections: Collection[]; tracks: Track[] }>(
          endpoints.me.library(q)
        ),
      likes: () =>
        request<{ trackIds: string[]; tracks: Track[] }>(endpoints.me.likes()),
      setTrackState: (
        trackId: string,
        patch: { isLiked?: boolean; resumeSec?: number }
      ) =>
        request<TrackState>(endpoints.me.track(trackId), {
          method: "PUT",
          body: body(patch),
        }),
      setPin: (collectionId: string, patch: { isPinned?: boolean }) =>
        request<{ isPinned: boolean }>(endpoints.me.pin(collectionId), {
          method: "PUT",
          body: body(patch),
        }),

      /** Listening stats, computed for the caller's timezone. */
      stats: (tz?: string) =>
        request<StatsRollup>(
          endpoints.me.stats() + (tz ? `?tz=${encodeURIComponent(tz)}` : "")
        ),
      /** History with provenance, paginated by startedAt-millis cursor. */
      recents: (cursor?: string) =>
        request<RecentsPage>(endpoints.me.recents(cursor)),
      /** Clear listening history — deletes events, zeroes counters, keeps likes. */
      clearHistory: () =>
        request<{ ok: true; deletedEvents: number }>(endpoints.me.history(), {
          method: "DELETE",
        }),

      playback: {
        get: () => request<PlaybackState>(endpoints.me.playback()),
        /** Throttled — flush every ~10s and on pause/stop/unload, not per tick. */
        save: (patch: Partial<PlaybackState>) =>
          request<PlaybackState>(endpoints.me.playback(), {
            method: "PUT",
            body: body(patch),
          }),
        enqueue: (trackId: string, mode: "next" | "end") =>
          request<PlaybackState>(endpoints.me.playbackQueue(), {
            method: "POST",
            body: body({ trackId, mode }),
          }),
        clearQueue: () =>
          request<PlaybackState>(endpoints.me.playbackQueue(), {
            method: "DELETE",
          }),
        removeFromQueue: (index: number) =>
          request<PlaybackState>(endpoints.me.playbackQueueItem(index), {
            method: "DELETE",
          }),
      },
    },
  };
}

export type BackendClient = ReturnType<typeof createBackendClient>;
