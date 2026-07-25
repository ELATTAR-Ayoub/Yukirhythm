import { describe, it, expect } from "vitest";
import type { MockCollection } from "./mock-data";
import {
  LIKED_SONGS,
  MOCK_COLLECTIONS,
  MOCK_HISTORY,
  formatDuration,
  getCollectionTracks,
  getTrack,
  recentCollections,
  searchMockCollections,
} from "./mock-data";

describe("mock-data helpers", () => {
  it("resolves collection tracks and drops unknown ids", () => {
    const tracks = getCollectionTracks({
      ...LIKED_SONGS,
      trackIds: ["t1", "nope", "t3"],
    });
    expect(tracks.map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  it("finds a track by id", () => {
    expect(getTrack("t1")?.title).toBe("Midnight Snowfall");
    expect(getTrack("nope")).toBeUndefined();
  });

  it("searches collections by title and tag, case-insensitive", () => {
    const all = [LIKED_SONGS, ...MOCK_COLLECTIONS];
    expect(searchMockCollections("PIXEL", all).map((c) => c.id)).toContain(
      "c3"
    );
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
    const hits = searchMockCollections("liked", [
      LIKED_SONGS,
      ...MOCK_COLLECTIONS,
    ]);
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

describe("formatDuration", () => {
  it("formats m:ss", () => {
    expect(formatDuration(214)).toBe("3:34");
  });

  it("formats h:mm:ss past an hour", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
  });

  // A track's real length is never 0 — an unknown duration must not claim
  // "0:00" (observed live on the you-might-like shelf before ingestion
  // carried real durations).
  it("renders a zero duration as unknown, not a fake 0:00", () => {
    expect(formatDuration(0)).toBe("--:--");
  });

  it("renders a null/undefined duration as unknown", () => {
    expect(formatDuration(null)).toBe("--:--");
    expect(formatDuration(undefined)).toBe("--:--");
  });

  it("renders a non-finite duration as unknown rather than throwing", () => {
    expect(formatDuration(NaN)).toBe("--:--");
  });

  // Elapsed playback position is legitimately 0 at the start of a track —
  // unlike a track's total duration, that is real data, not an unknown.
  it("keeps a real 0:00 when the caller opts in with zeroIsKnown", () => {
    expect(formatDuration(0, { zeroIsKnown: true })).toBe("0:00");
  });
});
