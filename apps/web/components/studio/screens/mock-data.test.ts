import { describe, it, expect } from "vitest";
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
    expect(searchMockCollections("PIXEL").map((c) => c.id)).toContain("c3");
    expect(searchMockCollections("lofi").map((c) => c.id)).toContain("c1");
    expect(searchMockCollections("")).toEqual([]);
  });

  it("dedupes recent collections preserving history order", () => {
    const all = [LIKED_SONGS, ...MOCK_COLLECTIONS];
    const recents = recentCollections(MOCK_HISTORY, all);
    const ids = recents.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe(MOCK_HISTORY[0].collectionId);
  });
});
