import { describe, it, expect } from "vitest";
import { LIKED_SONGS, MOCK_COLLECTIONS, MOCK_TRACKS } from "./mock-data";
import { filterLibrary, sortTracks } from "./library-utils";

const ALL = [LIKED_SONGS, ...MOCK_COLLECTIONS];

describe("filterLibrary", () => {
  it("puts pinned collections first for the playlists filter", () => {
    const result = filterLibrary(ALL, "playlists");
    expect(result[0].id).toBe(LIKED_SONGS.id); // pinned by default
    expect(result.every((c) => c.kind === "music")).toBe(true);
  });

  it("shows only podcasts for the podcasts filter", () => {
    const result = filterLibrary(ALL, "podcasts");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((c) => c.kind === "podcast")).toBe(true);
  });

  it("shows only Liked Songs for the liked filter", () => {
    expect(filterLibrary(ALL, "liked").map((c) => c.id)).toEqual([LIKED_SONGS.id]);
  });

  it("sorts a system collection ahead of pinned ones", () => {
    const liked = { ...LIKED_SONGS, system: true, pinned: true };
    const pinned = { ...MOCK_COLLECTIONS[0], pinned: true };
    const plain = { ...MOCK_COLLECTIONS[1], pinned: false };

    const out = filterLibrary([plain, pinned, liked], "playlists");
    expect(out[0].id).toBe(liked.id);
  });
});

describe("sortTracks", () => {
  it("sorts alphabetically for alpha, keeps order for recent", () => {
    const alpha = sortTracks(MOCK_TRACKS, "alpha").map((t) => t.title);
    expect(alpha).toEqual([...alpha].sort((a, b) => a.localeCompare(b)));
    expect(sortTracks(MOCK_TRACKS, "recent")).toEqual(MOCK_TRACKS);
  });
});
