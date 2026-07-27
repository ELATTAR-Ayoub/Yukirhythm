import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { SCHEMA_VERSION, type Artist, type Track } from "./model";
import { textureForId } from "./texture";
import type { ProviderArtist, ProviderTrack } from "./types";

/** Refresh provider-sourced fields when they are older than this. */
const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export function toTrackDoc(t: ProviderTrack): Track {
  return {
    trackId: t.providerTrackId,
    type: t.type,
    title: t.title,
    artists: t.artists,
    album: t.album,
    durationSec: t.durationSec,
    artwork: t.artwork,
    texture: textureForId(t.providerTrackId),
    source: {
      provider: "youtube",
      videoId: t.videoId,
      url: `https://www.youtube.com/watch?v=${t.videoId}`,
      aliasVideoIds: [],
    },
    isEmbeddable: t.isEmbeddable,
    isLive: t.isLive,
    isFamilySafe: t.isFamilySafe,
    // playCount is global and owned by the event pipeline (phase 4); it starts
    // at zero here and is never overwritten by re-ingest.
    stats: { viewCount: t.viewCount, likeCount: t.likeCount, playCount: 0 },
    publishedAt: t.publishedAt
      ? Timestamp.fromDate(new Date(t.publishedAt))
      : null,
    // Labels are populated by enrichment (phase 4), never at ingest.
    labels: [],
    labelIds: [],
    keywords: t.keywords,
    enrichedAt: Timestamp.now(),
    schemaVersion: SCHEMA_VERSION,
  };
}

export function toArtistDoc(a: ProviderArtist): Artist {
  return {
    artistId: a.artistId,
    name: a.name,
    bio: a.bio,
    artwork: a.artwork,
    subscriberCount: a.subscriberCount,
    relatedArtistIds: a.relatedArtistIds,
    labels: [],
    enrichedAt: Timestamp.now(),
  };
}

function isStale(enrichedAt: unknown): boolean {
  const ts = enrichedAt as { toMillis?: () => number } | null;
  if (!ts?.toMillis) return true;
  return Date.now() - ts.toMillis() > STALE_AFTER_MS;
}

/**
 * Upserts a track and its artists. Safe to call on every search result: an
 * existing fresh document is left alone apart from alias tracking, and
 * user-sourced labels are never overwritten by provider data.
 */
export async function ingestTrack(t: ProviderTrack): Promise<void> {
  if (!t.providerTrackId) return;
  const db = adminDb();
  const ref = db.collection("tracks").doc(t.providerTrackId);
  const snap = await ref.get();
  const next = toTrackDoc(t);

  if (!snap.exists) {
    await ref.set(next);
  } else {
    const prev = snap.data() as Track;
    const aliases = new Set(prev.source?.aliasVideoIds ?? []);
    // A second video resolving to the same song is recorded, not duplicated —
    // this is what keeps play counts from fragmenting across reuploads.
    if (t.videoId && t.videoId !== prev.source?.videoId) aliases.add(t.videoId);

    const userLabels = (prev.labels ?? []).filter((l) => l.source === "user");
    const merged: Partial<Track> = {
      source: {
        ...next.source,
        videoId: prev.source?.videoId ?? next.source.videoId,
        aliasVideoIds: [...aliases],
      },
      labels: userLabels.length ? userLabels : (prev.labels ?? []),
    };
    if (isStale(prev.enrichedAt)) {
      Object.assign(merged, {
        title: next.title,
        artists: next.artists,
        album: next.album,
        durationSec: next.durationSec,
        artwork: next.artwork,
        isEmbeddable: next.isEmbeddable,
        stats: {
          viewCount: next.stats.viewCount,
          likeCount: next.stats.likeCount,
          // never clobber the global play count with a fresh zero
          playCount: prev.stats?.playCount ?? 0,
        },
        keywords: next.keywords,
        enrichedAt: next.enrichedAt,
      });
    }
    await ref.set(merged, { merge: true });
  }

  await Promise.all(
    t.artists
      .filter((a) => Boolean(a.artistId))
      .map(async (a) => {
        const aRef = db.collection("artists").doc(a.artistId);
        const aSnap = await aRef.get();
        // Name-only stub on first sight; the artist route enriches it with a
        // bio. Concurrent duplicate writes are idempotent.
        if (!aSnap.exists) {
          await aRef.set(
            toArtistDoc({
              artistId: a.artistId,
              name: a.name,
              bio: null,
              artwork: [],
              subscriberCount: null,
              relatedArtistIds: [],
            })
          );
        }
      })
  );
}

export async function ingestTracks(tracks: ProviderTrack[]): Promise<void> {
  const unique = [
    ...new Map(
      tracks
        .filter((track) => Boolean(track.providerTrackId))
        .map((track) => [track.providerTrackId, track])
    ).values(),
  ];

  // Cold-start feeds can ingest dozens of tracks. Sequential upserts turn
  // every Firestore read/write into another visible wait; bounded batches
  // retain back-pressure while overlapping independent work.
  const concurrency = 8;
  for (let index = 0; index < unique.length; index += concurrency) {
    await Promise.all(
      unique
        .slice(index, index + concurrency)
        .map((track) => ingestTrack(track))
    );
  }
}
