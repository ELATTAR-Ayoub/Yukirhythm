import { describe, it, expect, beforeEach, beforeAll } from "vitest";

import { adminDb } from "@/lib/firebase/admin";
import { setCatalogProvider } from "@/lib/catalog/provider";
import { ingestTracks } from "@/lib/catalog/ingest";
import { textureForId } from "@/lib/catalog/texture";
import {
  clearFirestore,
  mintIdToken,
} from "@/lib/catalog/__integration__/emulator";
import type { CatalogProvider } from "@/lib/catalog/provider";
import type { ProviderTrack } from "@/lib/catalog/types";
import type { Track } from "@/lib/catalog/model";

import { GET as searchGET } from "./search/route";
import { GET as browseGET } from "./browse/route";
import { GET as suggestGET } from "./suggest/route";

/**
 * End-to-end against the real emulators: a real ID token is verified by the
 * real Admin SDK, the route runs, and results are written to and read from
 * real Firestore. The provider is stubbed to a fixed set so the assertions do
 * not depend on YouTube's live ranking — the network path itself is covered by
 * the contract test.
 */

function track(id: string, over: Partial<ProviderTrack> = {}): ProviderTrack {
  return {
    providerTrackId: id,
    videoId: id,
    type: "track",
    title: `Track ${id}`,
    artists: [{ artistId: "UCartist", name: "An Artist" }],
    album: null,
    durationSec: 200,
    artwork: [{ url: "https://x/1.jpg", width: 120, height: 120 }],
    isEmbeddable: true,
    isLive: false,
    isFamilySafe: true,
    viewCount: 100,
    likeCount: 5,
    publishedAt: null,
    keywords: [],
    categoryName: "Music",
    ...over,
  };
}

const stubProvider: CatalogProvider = {
  async search(query, { type }) {
    return {
      query,
      type,
      tracks: [
        track("playable1"),
        track("blocked1", { isEmbeddable: false }),
        track("playable2"),
      ],
      artists: [],
      playlists: [],
    };
  },
  async suggest() {
    return ["daft punk", "daft punk discovery"];
  },
  async getTrack(id) {
    return track(id);
  },
  async getTracks(ids) {
    return ids.map((id) => track(id));
  },
  async getArtist() {
    return null;
  },
  async getRelatedTracks() {
    return [];
  },
  async getPlaylist() {
    return null;
  },
};

const req = (path: string, token?: string) =>
  new Request(`http://localhost${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

let token: string;

beforeAll(async () => {
  setCatalogProvider(stubProvider);
  token = await mintIdToken(`u-${Date.now()}@example.com`);
});

describe("GET /api/catalog/search", () => {
  beforeEach(() => clearFirestore());

  it("401 without a real token", async () => {
    expect((await searchGET(req("/api/catalog/search?q=x"))).status).toBe(401);
  });

  it("400 on an empty query", async () => {
    const res = await searchGET(req("/api/catalog/search?q=", token));
    expect(res.status).toBe(400);
  });

  it("hides non-embeddable tracks and ingests the rest into real Firestore", async () => {
    const res = await searchGET(req("/api/catalog/search?q=daft+punk", token));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { tracks: { providerTrackId: string }[] };
    expect(body.tracks.map((t) => t.providerTrackId)).toEqual([
      "playable1",
      "playable2",
    ]);

    // the blocked track never reached the store
    const stored = await adminDb().collection("tracks").get();
    expect(stored.docs.map((d) => d.id).sort()).toEqual(["playable1", "playable2"]);

    const one = (
      await adminDb().collection("tracks").doc("playable1").get()
    ).data() as Track;
    expect(one.texture).toBe(textureForId("playable1"));
  });

  it("serves the second identical query from the cache", async () => {
    let calls = 0;
    setCatalogProvider({
      ...stubProvider,
      async search(query, opts) {
        calls++;
        return stubProvider.search(query, opts);
      },
    });

    await searchGET(req("/api/catalog/search?q=cached", token));
    await searchGET(req("/api/catalog/search?q=cached", token));
    expect(calls).toBe(1);

    setCatalogProvider(stubProvider);
  });
});

describe("GET /api/catalog/browse", () => {
  beforeEach(() => clearFirestore());

  it("400 on a label outside the vocabulary", async () => {
    const res = await browseGET(req("/api/catalog/browse?label=polka", token));
    expect(res.status).toBe(400);
  });

  it("resolves a provider spelling and returns only matching playable tracks", async () => {
    // Seed real docs: one lofi + playable, one lofi + blocked, one other genre.
    await ingestTracks([track("lofiA"), track("lofiBlocked"), track("jazzA")]);
    await adminDb()
      .collection("tracks")
      .doc("lofiA")
      .set({ labelIds: ["lofi"] }, { merge: true });
    await adminDb()
      .collection("tracks")
      .doc("lofiBlocked")
      .set({ labelIds: ["lofi"], isEmbeddable: false }, { merge: true });
    await adminDb()
      .collection("tracks")
      .doc("jazzA")
      .set({ labelIds: ["jazz"] }, { merge: true });

    const res = await browseGET(req("/api/catalog/browse?label=Lo-Fi", token));
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      label: string;
      tracks: { trackId: string }[];
    };
    expect(body.label).toBe("lofi");
    expect(body.tracks.map((t) => t.trackId)).toEqual(["lofiA"]);
  });
});

describe("GET /api/catalog/suggest", () => {
  it("401 without a token", async () => {
    expect((await suggestGET(req("/api/catalog/suggest?q=x"))).status).toBe(401);
  });

  it("returns suggestions for the caller", async () => {
    const res = await suggestGET(req("/api/catalog/suggest?q=daft", token));
    const body = (await res.json()) as { suggestions: string[] };
    expect(body.suggestions.length).toBeGreaterThan(0);
  });
});
