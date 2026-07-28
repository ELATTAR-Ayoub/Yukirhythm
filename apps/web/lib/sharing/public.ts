import { cache } from "react";

import type { SharedPlaylist, Track } from "@/lib/catalog/model";
import { adminDb } from "@/lib/firebase/admin";
import { trackArtUrl, youtubeThumbUrl } from "@/lib/studio/artwork";

export type PublicTrack = {
  id: string;
  title: string;
  artist: string;
  artUrl: string;
  texture: Track["texture"];
  durationSec: number;
  url: string;
};

export type PublicPlaylist = {
  id: string;
  title: string;
  description: string;
  ownerName: string;
  cover: SharedPlaylist["cover"];
  artUrl: string;
  artUrls: string[];
  texture: SharedPlaylist["texture"];
  tracks: PublicTrack[];
};

function toPublicTrack(track: Track): PublicTrack | null {
  // A public page must not work around provider or safety restrictions.
  if (track.isEmbeddable === false || track.isFamilySafe === false) return null;
  const id = track.source?.videoId || track.trackId;
  if (!id) return null;
  const widestArtwork = (track.artwork ?? []).reduce(
    (width, artwork) =>
      artwork?.url ? Math.max(width, artwork.width ?? 0) : width,
    0
  );
  return {
    id: track.trackId,
    title: track.title,
    artist: track.artists?.map((artist) => artist.name).join(", ") || "Unknown",
    // Some provider responses contain only a tiny artist avatar in the track
    // artwork slot. Never stretch that across a public hero/social card.
    artUrl:
      widestArtwork >= 480
        ? trackArtUrl(track)
        : youtubeThumbUrl(id) || trackArtUrl(track),
    texture: track.texture,
    durationSec: track.durationSec ?? 0,
    url: track.source?.url || `https://www.youtube.com/watch?v=${id}`,
  };
}

async function loadTrack(id: string): Promise<PublicTrack | null> {
  const snap = await adminDb().collection("tracks").doc(id).get();
  if (!snap.exists) return null;
  return toPublicTrack(snap.data() as Track);
}

/** Request-memoized because a page and its metadata resolve the same record. */
export const getPublicTrack = cache(loadTrack);

async function loadPlaylist(id: string): Promise<PublicPlaylist | null> {
  const db = adminDb();
  const snap = await db.collection("sharedPlaylists").doc(id).get();
  if (!snap.exists) return null;
  const playlist = snap.data() as SharedPlaylist;

  const tracks: PublicTrack[] = [];
  const trackIds = playlist.trackIds ?? [];
  // Batch reads keep large shared playlists from turning into one network
  // round trip per row while preserving the published order.
  for (let offset = 0; offset < trackIds.length; offset += 100) {
    const refs = trackIds
      .slice(offset, offset + 100)
      .map((trackId) => db.collection("tracks").doc(trackId));
    const snapshots = await db.getAll(...refs);
    for (const trackSnap of snapshots) {
      if (!trackSnap.exists) continue;
      const track = toPublicTrack(trackSnap.data() as Track);
      if (track) tracks.push(track);
    }
  }

  const artUrls = tracks
    .map((track) => track.artUrl)
    .filter(Boolean)
    .slice(0, 4);
  const artUrl =
    playlist.cover === "image" && playlist.imageUrl
      ? playlist.imageUrl
      : (artUrls[0] ?? "");

  return {
    id: playlist.shareId,
    title: playlist.title,
    description: playlist.description,
    ownerName: playlist.ownerName,
    cover: playlist.cover,
    artUrl,
    artUrls,
    texture: playlist.texture,
    tracks,
  };
}

export const getPublicPlaylist = cache(loadPlaylist);
