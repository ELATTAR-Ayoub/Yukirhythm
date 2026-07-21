import { endpoints } from "./endpoints";
import type {
  Artist,
  Collection,
  Track,
  TrackState,
  User,
} from "@/lib/catalog/model";

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
    },

    me: {
      get: () => request<User | null>(endpoints.me.root()),
      ensure: (input: Partial<User>) =>
        request<User>(endpoints.me.root(), { method: "POST", body: body(input) }),
      update: (patch: Partial<User>) =>
        request<User>(endpoints.me.root(), { method: "PATCH", body: body(patch) }),
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
    },
  };
}

export type BackendClient = ReturnType<typeof createBackendClient>;
