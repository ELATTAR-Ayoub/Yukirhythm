import { LIKED_SONGS_ID, type MockCollection, type MockTrack } from "./mock-data";

export type LibraryFilter = "playlists" | "podcasts" | "liked";
export type TrackSort = "recent" | "alpha";

export const LIBRARY_FILTERS: { value: LibraryFilter; label: string }[] = [
  { value: "playlists", label: "Playlists" },
  { value: "podcasts", label: "Podcasts" },
  { value: "liked", label: "Liked Songs" },
];

/** Pinned first (stable), then the chip's slice of the library. */
export function filterLibrary(
  collections: MockCollection[],
  filter: LibraryFilter
): MockCollection[] {
  const pinnedFirst = [...collections].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned)
  );
  if (filter === "liked") return pinnedFirst.filter((c) => c.id === LIKED_SONGS_ID);
  if (filter === "podcasts") return pinnedFirst.filter((c) => c.kind === "podcast");
  return pinnedFirst.filter((c) => c.kind === "music");
}

/** "recent" = catalogue order (mock stand-in for added-at). */
export function sortTracks(tracks: MockTrack[], sort: TrackSort): MockTrack[] {
  if (sort === "alpha") {
    return [...tracks].sort((a, b) => a.title.localeCompare(b.title));
  }
  return tracks;
}
