import { getCatalogProvider } from "./provider";
import type { CatalogSearchResult, CatalogSearchType } from "./types";
import { youtubeVideoId } from "./youtube-input";

/** Shared by signed-in and guest search, including the playlist track picker. */
export async function searchCatalog(
  query: string,
  opts: { type: CatalogSearchType; limit: number }
): Promise<CatalogSearchResult> {
  const provider = await getCatalogProvider();
  const id = youtubeVideoId(query);
  if (!id) return provider.search(query, opts);
  const track = await provider.getTrack(id);
  // Never replace an unavailable exact video with a similarly titled song.
  return {
    query,
    type: opts.type,
    tracks: track?.isEmbeddable && track.videoId === id ? [track] : [],
    artists: [],
    playlists: [],
  };
}
