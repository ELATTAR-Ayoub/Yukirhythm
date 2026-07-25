import {
  LIKED_SONGS_ID,
  type MockCollection,
  type MockTrack,
} from "./mock-data";

export type LibraryFilter = "playlists" | "podcasts" | "liked";
export type TrackSort = "recent" | "alpha";

export const LIBRARY_FILTERS: { value: LibraryFilter; label: string }[] = [
  { value: "playlists", label: "Playlists" },
  { value: "podcasts", label: "Podcasts" },
  { value: "liked", label: "Liked Songs" },
];

/** System collections (Liked Songs) outrank pinned ones, which outrank the rest. */
function libraryRank(c: MockCollection): number {
  if (c.system) return 0;
  if (c.pinned) return 1;
  return 2;
}

/** System collections first, then pinned (stable), then the chip's slice of the library. */
export function filterLibrary(
  collections: MockCollection[],
  filter: LibraryFilter
): MockCollection[] {
  const ranked = [...collections].sort(
    (a, b) => libraryRank(a) - libraryRank(b)
  );
  if (filter === "liked") return ranked.filter((c) => c.id === LIKED_SONGS_ID);
  if (filter === "podcasts") return ranked.filter((c) => c.kind === "podcast");
  return ranked.filter((c) => c.kind === "music");
}

/** "recent" = catalogue order (mock stand-in for added-at). */
export function sortTracks(tracks: MockTrack[], sort: TrackSort): MockTrack[] {
  if (sort === "alpha") {
    return [...tracks].sort((a, b) => a.title.localeCompare(b.title));
  }
  return tracks;
}
