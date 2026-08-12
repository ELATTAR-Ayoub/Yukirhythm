import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import {
  getCatalogProvider,
  type CatalogProvider,
} from "@/lib/catalog/provider";
import { ingestTracks, toTrackDoc } from "@/lib/catalog/ingest";
import {
  buildRecentTasteProfile,
  diversifyByArtist,
  scoreNewReleases,
} from "@/lib/catalog/recommend";
import { loadFeedContext } from "../_context";
import type { ProviderTrack } from "@/lib/catalog/types";
import type { Track, User } from "@/lib/catalog/model";
import { readFeedSnapshot, writeFeedSnapshot } from "../_snapshot";

export const runtime = "nodejs";

const DAY = 24 * 60 * 60 * 1000;

function publishedMs(track: Track): number {
  return track.publishedAt
    ? (track.publishedAt as unknown as { toMillis(): number }).toMillis()
    : 0;
}

function mergeDetails(
  base: ProviderTrack,
  details: ProviderTrack
): ProviderTrack {
  return {
    ...base,
    durationSec: base.durationSec ?? details.durationSec,
    artwork: base.artwork.length ? base.artwork : details.artwork,
    isEmbeddable: details.isEmbeddable,
    isLive: details.isLive,
    isFamilySafe: details.isFamilySafe,
    viewCount: details.viewCount,
    likeCount: details.likeCount,
    publishedAt: details.publishedAt,
    keywords: details.keywords,
    categoryName: details.categoryName,
  };
}

async function hydrateCandidates(
  provider: CatalogProvider,
  tracks: ProviderTrack[],
  limit = 40
): Promise<ProviderTrack[]> {
  const unique = [
    ...new Map(tracks.map((track) => [track.providerTrackId, track])).values(),
  ].slice(0, limit);
  const hydrated: ProviderTrack[] = [];
  const concurrency = 8;
  for (let index = 0; index < unique.length; index += concurrency) {
    const batch = unique.slice(index, index + concurrency);
    const details = await Promise.all(
      batch.map((track) => provider.getTrack(track.providerTrackId))
    );
    details.forEach((detail, detailIndex) => {
      if (detail) hydrated.push(mergeDetails(batch[detailIndex], detail));
    });
  }
  return hydrated;
}

/** New songs in the listener's genres, with a hard and verifiable date gate. */
export async function GET(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const cached = await readFeedSnapshot(
    uid,
    "new-releases",
    new URL(req.url).searchParams.get("refresh") === "1"
  );
  if (cached) return Response.json(cached);

  const db = adminDb();
  const [userSnap, ctx, provider] = await Promise.all([
    db.collection("users").doc(uid).get(),
    loadFeedContext(uid),
    getCatalogProvider(),
  ]);
  const user = userSnap.data() as User | undefined;
  const personalized = user?.privacy?.personalization !== false;

  const taste = buildRecentTasteProfile(
    personalized ? ctx.events : [],
    ctx.tasteTracks,
    Date.now(),
    personalized ? new Set(ctx.likedTrackIds) : new Set()
  );

  const labels = [...taste.labelAffinity]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => label);
  const artistNames = [
    ...new Set(
      taste.seedTrackIds
        .map((id) => ctx.tasteTracks.get(id)?.artists[0]?.name)
        .filter((name): name is string => Boolean(name))
    ),
  ].slice(0, 2);
  const queries = [
    ...labels.map((label) => `new ${label} songs`),
    ...artistNames.map((artist) => `${artist} new song`),
  ];
  if (queries.length === 0) queries.push("new music this week", "new songs");

  const searchGroups = await Promise.all(
    queries.map(async (query) => {
      try {
        return (await provider.search(query, { type: "song", limit: 20 }))
          .tracks;
      } catch (err) {
        console.error(`feed/new-releases: search "${query}" failed`, err);
        return [];
      }
    })
  );
  const hydrated = await hydrateCandidates(provider, searchGroups.flat());
  if (hydrated.length) await ingestTracks(hydrated);

  const candidates = new Map<string, Track>();
  for (const providerTrack of hydrated) {
    const id = providerTrack.providerTrackId;
    if (!ctx.exclude.has(id) && providerTrack.publishedAt) {
      candidates.set(id, toTrackDoc(providerTrack));
    }
  }

  // Reuse already-enriched catalogue rows as a fast, provider-independent pool.
  try {
    const knownRecent = await db
      .collection("tracks")
      .where("isEmbeddable", "==", true)
      .orderBy("publishedAt", "desc")
      .limit(60)
      .get();
    for (const doc of knownRecent.docs) {
      const track = doc.data() as Track;
      if (!ctx.exclude.has(doc.id) && track.publishedAt) {
        candidates.set(doc.id, track);
      }
    }
  } catch (err) {
    console.error("feed/new-releases: recent catalogue query failed", err);
  }

  const now = Date.now();
  const all = [...candidates.values()];
  let dated = all.filter((track) => {
    const age = now - publishedMs(track);
    return age >= 0 && age <= 90 * DAY;
  });
  if (dated.length < 6) {
    dated = all.filter((track) => {
      const age = now - publishedMs(track);
      return age >= 0 && age <= 180 * DAY;
    });
  }

  const ranked = scoreNewReleases(
    dated,
    taste.artistAffinity,
    now,
    taste.labelAffinity
  );
  const items = diversifyByArtist(ranked, candidates, 15).map(
    (recommendation) => ({
      ...recommendation,
      track: candidates.get(recommendation.trackId)!,
    })
  );

  const result = { personalized, items };
  await writeFeedSnapshot(uid, "new-releases", result);
  return Response.json(result);
}
