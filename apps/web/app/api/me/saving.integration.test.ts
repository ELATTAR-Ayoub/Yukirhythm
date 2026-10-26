import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { adminDb } from "@/lib/firebase/admin";
import {
  clearFirestore,
  mintIdToken,
} from "@/lib/catalog/__integration__/emulator";
import {
  setCatalogProvider,
  type CatalogProvider,
} from "@/lib/catalog/provider";
import type { ProviderTrack } from "@/lib/catalog/types";
import { GET as search } from "../catalog/search/route";
import { GET as likes } from "./likes/route";
import { PUT as like } from "./tracks/[trackId]/route";
import { GET as list, POST as create } from "../collections/route";
import { PUT as add } from "../collections/[collectionId]/tracks/[trackId]/route";
import { PUT as pin } from "./pins/[collectionId]/route";

const track = (id: string): ProviderTrack => ({
  providerTrackId: id,
  videoId: id,
  type: "track",
  title: `Song ${id}`,
  artists: [{ artistId: "artist", name: "Artist" }],
  album: null,
  durationSec: 120,
  artwork: [],
  isEmbeddable: true,
  isLive: false,
  isFamilySafe: true,
  viewCount: 0,
  likeCount: 0,
  publishedAt: null,
  keywords: [],
  categoryName: null,
});
const provider: CatalogProvider = {
  search: async () => ({
    query: "songs",
    type: "song",
    tracks: [track("fresh")],
    artists: [],
    playlists: [],
  }),
  getTrack: async (id) => (id === "gone" ? null : track(id)),
  getTracks: async (ids) => ids.map(track),
  suggest: async () => [],
  getArtist: async () => null,
  getRelatedTracks: async () => [],
  getPlaylist: async () => null,
};
let token: string;
const req = (method = "GET", body?: unknown) =>
  new Request("http://localhost/api/catalog/search?q=songs", {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
const ctx = (trackId: string) => ({ params: Promise.resolve({ trackId }) });

beforeAll(async () => {
  token = await mintIdToken(`saving-${Date.now()}@example.com`);
});
beforeEach(async () => {
  await clearFirestore();
  setCatalogProvider(provider);
});
afterAll(() => setCatalogProvider(null));

describe("saving transient search results", () => {
  it("persists a searched track on like and reads it back after a fresh library load", async () => {
    expect((await search(req())).status).toBe(200);
    expect(
      (await adminDb().collection("tracks").doc("fresh").get()).exists
    ).toBe(false);
    // Prime an empty list first, as the app does on sign-in.
    expect((await (await likes(req())).json()).trackIds).toEqual([]);
    expect(
      (await like(req("PUT", { isLiked: true }), ctx("fresh"))).status
    ).toBe(200);
    const saved = await likes(req());
    expect(saved.headers.get("Cache-Control")).toContain("no-store");
    const body = await saved.json();
    expect(body.trackIds).toEqual(["fresh"]);
    expect(body.tracks[0].title).toBe("Song fresh");
    await like(req("PUT", { isLiked: false }), ctx("fresh"));
    expect((await (await likes(req())).json()).trackIds).toEqual([]);
  });

  it("persists selected search tracks during create and add, and restores a pin", async () => {
    const response = await create(
      req("POST", { title: "Saved", trackIds: ["fresh"] })
    );
    expect(response.status).toBe(201);
    const collection = await response.json();
    expect(
      collection.tracks.map((t: { trackId: string }) => t.trackId)
    ).toEqual(["fresh"]);
    const params = {
      params: Promise.resolve({
        collectionId: collection.collectionId,
        trackId: "second",
      }),
    };
    expect((await add(req("PUT"), params)).status).toBe(200);
    await pin(req("PUT", { isPinned: true }), {
      params: Promise.resolve({ collectionId: collection.collectionId }),
    });
    const library = await (await list(req())).json();
    expect(library[0].isPinned).toBe(true);
    expect(
      library[0].tracks.map((t: { trackId: string }) => t.trackId)
    ).toEqual(["fresh", "second"]);
  });

  it("reports an unavailable track instead of storing a broken like", async () => {
    expect(
      (await like(req("PUT", { isLiked: true }), ctx("gone"))).status
    ).toBe(404);
    expect((await (await likes(req())).json()).trackIds).toEqual([]);
  });
});
