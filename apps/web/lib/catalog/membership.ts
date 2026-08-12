import type { CollectionTrack, Track } from "./model";

export const COLLECTION_WARN_BYTES = 750 * 1024;
export const COLLECTION_MAX_BYTES = 900 * 1024;

export function estimatedDocumentBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function membershipFromTrack(
  track: Track,
  addedAt: CollectionTrack["addedAt"],
  addedBy: string
): CollectionTrack {
  const membership: CollectionTrack = {
    trackId: track.trackId,
    type: track.type,
    title: track.title,
    artists: track.artists,
    album: track.album,
    durationSec: track.durationSec,
    artwork: track.artwork,
    texture: track.texture,
    source: track.source,
    isEmbeddable: track.isEmbeddable,
    isLive: track.isLive,
    isFamilySafe: track.isFamilySafe,
    publishedAt: track.publishedAt,
    labels: track.labels,
    addedAt,
    addedBy,
  };
  if (track.preview !== undefined) membership.preview = track.preview;
  return membership;
}

export function membershipIsComplete(entry: CollectionTrack): boolean {
  return Boolean(
    entry.title &&
    entry.type &&
    entry.artists &&
    entry.artwork &&
    entry.texture &&
    entry.source &&
    typeof entry.isEmbeddable === "boolean" &&
    typeof entry.isLive === "boolean" &&
    typeof entry.isFamilySafe === "boolean" &&
    entry.labels
  );
}

export function trackFromMembership(entry: CollectionTrack): Track | null {
  if (!membershipIsComplete(entry)) return null;
  const track: Track = {
    trackId: entry.trackId,
    type: entry.type!,
    title: entry.title!,
    artists: entry.artists!,
    album: entry.album ?? null,
    durationSec: entry.durationSec ?? null,
    artwork: entry.artwork!,
    texture: entry.texture!,
    source: entry.source!,
    isEmbeddable: entry.isEmbeddable!,
    isLive: entry.isLive!,
    isFamilySafe: entry.isFamilySafe!,
    stats: { viewCount: 0, likeCount: 0, playCount: 0 },
    publishedAt: entry.publishedAt ?? null,
    labels: entry.labels!,
    labelIds: entry.labels!.map((label) => label.label),
    keywords: [],
    enrichedAt: null,
    schemaVersion: 1,
  };
  if (entry.preview !== undefined) track.preview = entry.preview;
  return track;
}
