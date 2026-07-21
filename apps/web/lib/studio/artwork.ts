import type { Collection, Track } from "@/lib/catalog/model";

/**
 * Where a track's picture comes from.
 *
 * Enrichment stores provider thumbnails on `Track.artwork` (spec D6), but most
 * of the catalogue predates it. Every track is a YouTube video and the track id
 * IS the video id — StudioProvider plays it as `watch?v=${track.id}` — so a
 * usable thumbnail can always be derived, and no backfill migration is needed.
 *
 * Pure. The procedural `Texture` remains the last-resort fallback, applied by
 * the `Artwork` component when these return "" or the URL fails to load.
 */

/** The standard YouTube thumbnail. `hqdefault` exists for every video. */
export function youtubeThumbUrl(videoId: string): string {
  if (!videoId) return "";
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** The best available picture for a track, or "" if there is none. */
export function trackArtUrl(track: Track): string {
  // Widest wins: these render into everything from a 36px row thumbnail to a
  // full-bleed vinyl face, and downscaling looks better than upscaling.
  const best = (track.artwork ?? [])
    .filter((a) => Boolean(a?.url))
    .reduce<{ url: string; width: number } | null>(
      (win, a) => (win === null || a.width > win.width ? a : win),
      null
    );
  if (best) return best.url;
  return youtubeThumbUrl(track.source?.videoId || track.trackId || "");
}

/** A collection's own cover image, or "" when it draws a texture/mosaic. */
export function collectionArtUrl(collection: Collection): string {
  return collection.cover === "image" ? (collection.imageUrl ?? "") : "";
}
