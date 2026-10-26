import { ApiError, createBackendClient } from "@/lib/api/backend";
import {
  DEFAULT_PRIVACY,
  type Collection,
  type Track,
  type TrackState,
  type User,
} from "@/lib/catalog/model";
import type { Timestamp } from "firebase-admin/firestore";
import {
  clearSavedListens,
  localListeningStats,
  savedListens,
} from "./browser-history";
import { activeGuestId } from "./guest-session";
import { readBrowserPlayback } from "./browser-playback";

type LocalCollection = Collection & { isPinned?: boolean };
type GuestData = {
  version: 1;
  user: User;
  collections: LocalCollection[];
  tracks: Record<string, Track>;
  states: Record<string, TrackState>;
};
const timestamp = () =>
  ({
    _seconds: Math.floor(Date.now() / 1000),
    _nanoseconds: 0,
  }) as unknown as Timestamp;
const ok = { ok: true as const };

function initial(uid: string): GuestData {
  return {
    version: 1,
    user: {
      userId: uid,
      displayName: "Guest",
      handle: null,
      email: "",
      avatarUrl: null,
      bio: null,
      authProvider: "guest",
      counts: { followerCount: 0, followingCount: 0, collectionCount: 0 },
      privacy: { ...DEFAULT_PRIVACY },
      settings: { audioQuality: "auto", language: "en", theme: "system" },
      createdAt: timestamp(),
    },
    collections: [],
    tracks: {},
    states: {},
  };
}

/** Every personal operation is a local read/modify/write; only catalog metadata uses HTTP. */
export function createGuestBackend(uid: string) {
  const key = `yukirhythm:guest-data:v1:${uid}`;
  function read(): GuestData {
    if (activeGuestId() !== uid)
      throw new ApiError(401, "Guest session has ended");
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initial(uid);
      const data = JSON.parse(raw) as GuestData;
      if (
        data.version !== 1 ||
        data.user?.userId !== uid ||
        !Array.isArray(data.collections) ||
        !data.tracks ||
        !data.states
      )
        throw new Error();
      return data;
    } catch {
      throw new ApiError(
        500,
        "Couldn't read guest data. Your saved data has not been overwritten."
      );
    }
  }
  function write(data: GuestData) {
    if (activeGuestId() !== uid)
      throw new ApiError(401, "Guest session has ended");
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      throw new ApiError(
        507,
        "Couldn't save on this device. Browser storage may be full or blocked."
      );
    }
  }
  async function catalog(op: string, params: Record<string, string>) {
    const res = await fetch(
      `/api/guest/catalog?${new URLSearchParams({ op, ...params })}`,
      { cache: "no-store" }
    );
    if (!res.ok)
      throw new ApiError(
        res.status,
        "Music discovery is temporarily unavailable. Try again when online."
      );
    const result = await res.json();
    // Re-read after awaiting network: never overwrite a newer like or playlist edit.
    const data = read();
    const tracks: Track[] = result.tracks ?? (result.trackId ? [result] : []);
    tracks.forEach((t) => {
      data.tracks[t.trackId] = t;
    });
    // Bound disposable catalog entries, retaining every personal reference.
    const retained = new Set([
      ...Object.keys(data.states),
      ...(readBrowserPlayback(uid)?.queue ?? []),
      ...savedListens(uid).map((event) => event.trackId),
      ...data.collections.flatMap((c) => c.tracks.map((t) => t.trackId)),
    ]);
    const disposable = Object.keys(data.tracks).filter(
      (id) => !retained.has(id)
    );
    disposable
      .slice(0, Math.max(0, disposable.length - 200))
      .forEach((id) => delete data.tracks[id]);
    write(data);
    return result;
  }
  function membership(data: GuestData, id: string) {
    const track = data.tracks[id];
    if (!track)
      throw new ApiError(
        404,
        "Track is unavailable. Search for it again before saving."
      );
    return { ...track, addedAt: timestamp(), addedBy: uid };
  }
  function recount(c: LocalCollection) {
    c.stats.trackCount = c.tracks.length;
    c.stats.totalDurationSec = c.tracks.reduce(
      (sum, t) => sum + (t.durationSec ?? 0),
      0
    );
    c.updatedAt = timestamp();
  }
  return createBackendClient(
    async () => null,
    async (url, init) => {
      const parsed = new URL(url, "http://local");
      const parts = parsed.pathname
        .split("/")
        .filter(Boolean)
        .map(decodeURIComponent);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const data = read();
      if (parts[1] === "catalog") {
        if (parts[2] === "search" || parts[2] === "suggest")
          return catalog(parts[2], { q: parsed.searchParams.get("q") ?? "" });
        if (parts[2] === "tracks" && !parts[3])
          return {
            ...(await catalog("search", {
              q: `${parsed.searchParams.get("label") ?? "music"} music`,
            })),
            label: parsed.searchParams.get("label"),
          };
        if (parts[2] === "tracks")
          return data.tracks[parts[3]] ?? catalog("track", { id: parts[3] });
        if (parts[2] === "artists") return catalog("artist", { id: parts[3] });
      }
      if (parts[1] === "feed") {
        if (parts[2] === "jump-back-in")
          return { collections: data.collections };
        const seed = parsed.searchParams.get("trackId");
        const favorite = data.user.privacy.personalization
          ? Object.values(data.states)
              .filter((s) => s.isLiked)
              .map((s) => data.tracks[s.trackId])
              .filter(Boolean)
              .at(-1)
          : undefined;
        const response = seed
          ? await catalog("similar", { id: seed })
          : await catalog("search", {
              q:
                parts[2] === "new-releases"
                  ? `new music releases ${new Date().getFullYear()}`
                  : favorite
                    ? `${favorite.artists[0]?.name ?? favorite.title} music`
                    : "popular music",
            });
        return {
          personalized: !!favorite && parts[2] !== "new-releases",
          seedTrackId: seed,
          items: (response.tracks as Track[]).map((track, index) => ({
            track,
            trackId: track.trackId,
            score: 1 / (index + 1),
            reason: seed
              ? "Similar music"
              : favorite
                ? "Based on your device library"
                : "Discover music",
            recommendationId: `guest-${track.trackId}`,
          })),
        };
      }
      if (parts[1] === "events")
        return { ...ok, written: body.events?.length ?? 0 }; // archive already saved by the player
      if (parts[1] === "me") {
        if (parts.length === 2) {
          if (method === "PATCH") {
            data.user = {
              ...data.user,
              displayName: body.displayName ?? data.user.displayName,
              bio: body.bio ?? data.user.bio,
              privacy: {
                ...data.user.privacy,
                ...body.privacy,
                publicProfile: false,
              },
              settings: { ...data.user.settings, ...body.settings },
            };
          }
          if (method !== "GET") write(data);
          return data.user;
        }
        if (parts[2] === "likes") {
          const trackIds = Object.values(data.states)
            .filter((s) => s.isLiked)
            .map((s) => s.trackId);
          return {
            trackIds,
            tracks: trackIds.map((id) => data.tracks[id]).filter(Boolean),
          };
        }
        if (parts[2] === "library") {
          const q = (parsed.searchParams.get("q") ?? "").toLowerCase();
          return {
            collections: data.collections.filter((c) =>
              `${c.title} ${c.tags.join(" ")}`.toLowerCase().includes(q)
            ),
            tracks: Object.values(data.states)
              .filter((s) => s.isLiked)
              .map((s) => data.tracks[s.trackId])
              .filter(
                (t) =>
                  t &&
                  `${t.title} ${t.artists.map((a) => a.name).join(" ")}`
                    .toLowerCase()
                    .includes(q)
              ),
          };
        }
        if (parts[2] === "tracks") {
          membership(data, parts[3]);
          const state = data.states[parts[3]] ?? {
            trackId: parts[3],
            isLiked: false,
            likedAt: null,
            playCount: 0,
            completedCount: 0,
            skipCount: 0,
            totalListenedSec: 0,
            lastPlayedAt: null,
            resumeSec: 0,
            addedAt: timestamp(),
          };
          if (typeof body.isLiked === "boolean") {
            state.isLiked = body.isLiked;
            state.likedAt = body.isLiked ? timestamp() : null;
          }
          if (typeof body.resumeSec === "number")
            state.resumeSec = Math.max(0, body.resumeSec);
          data.states[parts[3]] = state;
          write(data);
          return state;
        }
        if (parts[2] === "pins") {
          const c = data.collections.find((c) => c.collectionId === parts[3]);
          if (!c) throw new ApiError(404, "Playlist not found");
          c.isPinned = !!body.isPinned;
          write(data);
          return { isPinned: c.isPinned };
        }
        if (parts[2] === "history" && method === "DELETE") {
          const count = savedListens(uid).length;
          clearSavedListens(uid);
          return { ...ok, deletedEvents: count };
        }
        if (parts[2] === "stats") return localListeningStats(savedListens(uid));
        if (parts[2] === "recents")
          return {
            items: savedListens(uid).map((e) => ({
              eventId: e.eventId,
              trackId: e.trackId,
              startedAtMs: e.startedAt,
              listenedSec: e.listenedSec,
              track: data.tracks[e.trackId] ?? null,
              collection: null,
            })),
            nextCursor: null,
          };
      }
      if (parts[1] === "collections") {
        if (parts.length === 2) {
          if (method === "GET") return data.collections;
          const ids: string[] = [
            ...new Set<string>(
              body.trackIds ??
                body.tracks?.map((t: { trackId: string }) => t.trackId) ??
                []
            ),
          ];
          if (
            !body.title?.trim() ||
            body.title.length > 300 ||
            ids.length > 5000
          )
            throw new ApiError(400, "Invalid playlist");
          const c: LocalCollection = {
            collectionId: `local-${crypto.randomUUID()}`,
            ownerId: uid,
            role: "playlist",
            contentType: body.contentType ?? "music",
            title: body.title.trim(),
            description: body.description ?? "",
            tags: body.tags ?? [],
            cover: body.cover ?? "texture",
            texture: body.texture ?? "tx-k-silk",
            imageUrl: body.imageUrl ?? null,
            tracks: ids.map((id) => membership(data, id)),
            visibility: "private",
            stats: {
              trackCount: 0,
              totalDurationSec: 0,
              saveCount: 0,
              playCount: 0,
            },
            createdAt: timestamp(),
            updatedAt: timestamp(),
          };
          recount(c);
          data.collections.push(c);
          data.user.counts.collectionCount = data.collections.length;
          write(data);
          return c;
        }
        if (parts[2] === "public") return [];
        const c = data.collections.find((c) => c.collectionId === parts[2]);
        if (!c)
          throw new ApiError(404, "This playlist isn't saved on this device");
        if (parts.length === 3) {
          if (method === "GET") return c;
          if (method === "DELETE") {
            data.collections = data.collections.filter((x) => x !== c);
            data.user.counts.collectionCount = data.collections.length;
            write(data);
            return ok;
          }
          if (body.visibility && body.visibility !== "private")
            throw new ApiError(
              403,
              "Guest playlists stay on this device. Sign in to share online."
            );
          for (const field of [
            "title",
            "description",
            "tags",
            "cover",
            "texture",
            "imageUrl",
          ] as const)
            if (body[field] !== undefined)
              Object.assign(c, { [field]: body[field] });
          recount(c);
          write(data);
          return c;
        }
        if (parts[3] === "tracks") {
          if (parts[4]) {
            if (method === "DELETE")
              c.tracks = c.tracks.filter((t) => t.trackId !== parts[4]);
            else if (!c.tracks.some((t) => t.trackId === parts[4])) {
              if (c.tracks.length >= 5000)
                throw new ApiError(400, "Playlist is full");
              c.tracks.push(membership(data, parts[4]));
            }
          } else {
            const ids: string[] = body.trackIds ?? [];
            if (
              ids.length !== c.tracks.length ||
              new Set(ids).size !== ids.length ||
              ids.some((id) => !c.tracks.some((t) => t.trackId === id))
            )
              throw new ApiError(400, "Invalid playlist order");
            c.tracks = ids.map((id) => c.tracks.find((t) => t.trackId === id)!);
          }
          recount(c);
          write(data);
          return ok;
        }
      }
      throw new ApiError(
        403,
        "Sign in to use online sharing and social features. Your guest library stays on this device."
      );
    }
  );
}
