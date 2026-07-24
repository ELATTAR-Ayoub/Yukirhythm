import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { setCatalogProvider, type CatalogProvider } from "./provider";
import type { ProviderTrack } from "./types";

const { readCache, writeCache, ingestTracks } = vi.hoisted(() => ({
  readCache: vi.fn(),
  writeCache: vi.fn(),
  ingestTracks: vi.fn(),
}));

vi.mock("./cache", () => ({
  cacheKey: (q: string, t: string) => `${t}:${q}`,
  readCache,
  writeCache,
}));
vi.mock("./ingest", () => ({ ingestTracks }));

import { coldStartTracks } from "./cold-start";

function pt(id: string, over: Partial<ProviderTrack> = {}): ProviderTrack {
  return {
    providerTrackId: id,
    videoId: id,
    type: "track",
    title: `Track ${id}`,
    artists: [{ artistId: `a-${id}`, name: `Artist ${id}` }],
    album: null,
    durationSec: 200,
    artwork: [],
    isEmbeddable: true,
    isLive: false,
    isFamilySafe: true,
    viewCount: 1000,
    likeCount: 0,
    publishedAt: null,
    keywords: [],
    categoryName: null,
    ...over,
  };
}

function stubProvider(
  byQuery: Record<string, ProviderTrack[]>
): CatalogProvider {
  return {
    async search(query) {
      const tracks = byQuery[query];
      if (tracks === undefined) throw new Error(`no stub for ${query}`);
      return { query, type: "song", tracks, artists: [], playlists: [] };
    },
    async suggest() {
      return [];
    },
    async getTrack() {
      return null;
    },
    async getTracks() {
      return [];
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
}

describe("coldStartTracks", () => {
  beforeEach(() => {
    readCache.mockResolvedValue(null);
    writeCache.mockResolvedValue(undefined);
    ingestTracks.mockResolvedValue(undefined);
  });
  afterEach(() => {
    setCatalogProvider(null);
    vi.clearAllMocks();
  });

  it("searches, drops non-embeddable tracks, ingests and dedupes across queries", async () => {
    setCatalogProvider(
      stubProvider({
        a: [pt("t1"), pt("dead", { isEmbeddable: false })],
        b: [pt("t1"), pt("t2")],
      })
    );
    const got = await coldStartTracks(["a", "b"], 10);
    expect(got.map((t) => t.providerTrackId)).toEqual(["t1", "t2"]);
    expect(ingestTracks).toHaveBeenCalledTimes(2);
    const ingestedIds = ingestTracks.mock.calls.flatMap(([tracks]) =>
      (tracks as ProviderTrack[]).map((t) => t.providerTrackId)
    );
    expect(ingestedIds).not.toContain("dead");
  });

  it("serves from cache without touching the provider", async () => {
    readCache.mockResolvedValue([pt("cached")]);
    setCatalogProvider(stubProvider({})); // any real search would throw
    const got = await coldStartTracks(["a"], 10);
    expect(got.map((t) => t.providerTrackId)).toEqual(["cached"]);
    expect(ingestTracks).not.toHaveBeenCalled();
    expect(writeCache).not.toHaveBeenCalled();
  });

  it("skips a failing query and still answers from the others", async () => {
    setCatalogProvider(stubProvider({ good: [pt("t1")] })); // "bad" throws
    const got = await coldStartTracks(["bad", "good"], 10);
    expect(got.map((t) => t.providerTrackId)).toEqual(["t1"]);
  });

  it("caps the result at the limit", async () => {
    setCatalogProvider(stubProvider({ a: [pt("t1"), pt("t2"), pt("t3")] }));
    const got = await coldStartTracks(["a"], 2);
    expect(got).toHaveLength(2);
  });

  it("does not cache an empty provider answer", async () => {
    setCatalogProvider(
      stubProvider({ a: [pt("dead", { isEmbeddable: false })] })
    );
    const got = await coldStartTracks(["a"], 10);
    expect(got).toEqual([]);
    expect(writeCache).not.toHaveBeenCalled();
  });

  it("still returns tracks when caching fails", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    writeCache.mockRejectedValue(new Error("rules"));
    setCatalogProvider(stubProvider({ a: [pt("t1")] }));
    const got = await coldStartTracks(["a"], 10);
    expect(got.map((t) => t.providerTrackId)).toEqual(["t1"]);
    errSpy.mockRestore();
  });
});
