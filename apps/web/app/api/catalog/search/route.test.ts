import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as accountSearch } from "./route";
import { GET as guestCatalog } from "../../guest/catalog/route";
import {
  setCatalogProvider,
  type CatalogProvider,
} from "@/lib/catalog/provider";
import { clearRequestCache } from "@/lib/catalog/request-cache";
import type { ProviderTrack } from "@/lib/catalog/types";
import { adminDb } from "@/lib/firebase/admin";

vi.mock("@/lib/firebase/verify", () => ({
  uidFromRequest: vi.fn(async () => "account-user"),
  unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
}));
vi.mock("@/lib/firebase/admin", () => ({
  adminDb: vi.fn(() => {
    throw new Error("Search must not use Firestore");
  }),
}));
const search = vi.fn();
const getTrack = vi.fn();
const id = "a5uQMwRMHcs";
const track = (videoId = id): ProviderTrack => ({
  providerTrackId: videoId,
  videoId,
  type: "track",
  title: "Exact video",
  artists: [{ artistId: "artist", name: "Artist" }],
  album: null,
  durationSec: 200,
  artwork: [],
  isEmbeddable: true,
  isLive: false,
  isFamilySafe: true,
  viewCount: 0,
  likeCount: 0,
  publishedAt: null,
  keywords: [],
  categoryName: "Music",
});
beforeEach(() => {
  vi.clearAllMocks();
  clearRequestCache();
  getTrack.mockReset().mockImplementation(async (id: string) => track(id));
  search
    .mockReset()
    .mockResolvedValue({
      query: "Daft Punk",
      type: "song",
      tracks: [track()],
      artists: [],
      playlists: [],
    });
  setCatalogProvider({ search, getTrack } as unknown as CatalogProvider);
});
describe.each([
  ["account", accountSearch, "/api/catalog/search"],
  ["guest", guestCatalog, "/api/guest/catalog"],
] as const)("%s exact video search", (_name, handler, path) => {
  const request = (q: string) =>
    handler(new Request(`http://localhost${path}?q=${encodeURIComponent(q)}`));
  it.each([
    id,
    `https://youtu.be/${id}?t=30`,
    `https://music.youtube.com/watch?v=${id}`,
  ])("returns only the requested track for %s", async (query) => {
    const response = await request(query);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.tracks).toHaveLength(1);
    expect(body.tracks[0]).toMatchObject({
      trackId: id,
      source: { videoId: id },
    });
    expect(getTrack).toHaveBeenCalledWith(id);
    expect(search).not.toHaveBeenCalled();
    expect(adminDb).not.toHaveBeenCalled();
  });
  it("does not return a different song for unavailable or blocked videos", async () => {
    getTrack.mockResolvedValueOnce(null);
    expect((await (await request(id)).json()).tracks).toEqual([]);
    clearRequestCache();
    getTrack.mockResolvedValueOnce({ ...track(), isEmbeddable: false });
    expect((await (await request(id)).json()).tracks).toEqual([]);
    clearRequestCache();
    getTrack.mockResolvedValueOnce(track("differentID"));
    expect((await (await request(id)).json()).tracks).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });
  it("keeps distinct case-sensitive IDs separate in the request cache", async () => {
    const first = await (await request(id)).json();
    const second = await (await request(id.toLowerCase())).json();
    expect(first.tracks[0].trackId).toBe(id);
    expect(second.tracks[0].trackId).toBe(id.toLowerCase());
    expect(getTrack).toHaveBeenCalledTimes(2);
    await request(`https://youtu.be/${id}`);
    expect(getTrack).toHaveBeenCalledTimes(2);
  });
  it("continues using text search for artist and song names", async () => {
    const result = await request("Daft Punk");
    expect(result.status).toBe(200);
    expect(search).toHaveBeenCalledWith("Daft Punk", {
      type: "song",
      limit: 40,
    });
    expect(getTrack).not.toHaveBeenCalled();
  });
});
