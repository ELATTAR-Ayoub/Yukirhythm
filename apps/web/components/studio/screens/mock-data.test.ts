import { describe, it, expect } from "vitest";
import type { MockCollection } from "./mock-data";
import {
  LIKED_SONGS,
  MOCK_COLLECTIONS,
  MOCK_HISTORY,
  getCollectionTracks,
  getTrack,
  recentCollections,
  searchMockCollections,
} from "./mock-data";

describe("mock-data helpers", () => {
  it("resolves collection tracks and drops unknown ids", () => {
    const tracks = getCollectionTracks({ ...LIKED_SONGS, trackIds: ["t1", "nope", "t3"] });
    expect(tracks.map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  it("finds a track by id", () => {
    expect(getTrack("t1")?.title).toBe("Midnight Snowfall");
    expect(getTrack("nope")).toBeUndefined();
  });

  it("searches collections by title and tag, case-insensitive", () => {
    const all = [LIKED_SONGS, ...MOCK_COLLECTIONS];
    expect(searchMockCollections("PIXEL", all).map((c) => c.id)).toContain("c3");
    expect(searchMockCollections("lofi", all).map((c) => c.id)).toContain("c1");
    expect(searchMockCollections("", all)).toEqual([]);
  });

  it("searches the collections it is given, not a module constant", () => {
    const local: MockCollection = {
      id: "local-x",
      title: "Rainy Tapes",
      desc: "",
      texture: "tx-k-silk",
      trackIds: [],
      likes: 0,
      tags: ["rain"],
      kind: "music",
      pinned: false,
    };
    expect(searchMockCollections("rainy", [local]).map((c) => c.id)).toEqual([
      "local-x",
    ]);
    expect(searchMockCollections("rain", [local])).toHaveLength(1);
  });

  it("finds Liked Songs, which a constant-based search could never reach", () => {
    const hits = searchMockCollections("liked", [LIKED_SONGS, ...MOCK_COLLECTIONS]);
    expect(hits.some((c) => c.id === LIKED_SONGS.id)).toBe(true);
  });

  it("dedupes recent collections preserving history order", () => {
    const all = [LIKED_SONGS, ...MOCK_COLLECTIONS];
    const recents = recentCollections(MOCK_HISTORY, all);
    const ids = recents.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe(MOCK_HISTORY[0].collectionId);
  });
});
