import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { getCatalogProvider } from "@/lib/catalog/provider";
import { ingestTracks } from "@/lib/catalog/ingest";
import {
  blendYouMightLike,
  buildRecentTasteProfile,
  diversifyByArtist,
  type BlendInput,
} from "@/lib/catalog/recommend";
import {
  coldStartTracks,
  YOU_MIGHT_LIKE_QUERIES,
} from "@/lib/catalog/cold-start";
import { loadFeedContext } from "../_context";
import type { Collection, Track, User } from "@/lib/catalog/model";
import { readFeedSnapshot, writeFeedSnapshot } from "../_snapshot";

export const runtime = "nodejs";

/** A globally popular track to seed radio for a brand-new user. */
async function coldSeed(): Promise<string | null> {
  const snap = await adminDb()
    .collection("tracks")
    .where("isEmbeddable", "==", true)
    .orderBy("stats.viewCount", "desc")
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

export async function GET(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const cached = await readFeedSnapshot(
    uid,
    "you-might-like",
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

  // Radio: related tracks off the user's most-played seeds (or a cold seed).
  const seeds = personalized
    ? (taste.seedTrackIds.length ? taste.seedTrackIds : ctx.topPlayed).slice(
        0,
        6
      )
    : [];
  if (seeds.length === 0) {
    // Needs the popularity composite index; an undeployed index must not 500
    // the feed — the cold-start below covers the gap.
    const cold = await coldSeed().catch((err) => {
      console.error("feed/you-might-like: cold seed query failed", err);
      return null;
    });
    if (cold) seeds.push(cold);
  }

  // Co-listen does not depend on provider radio. Start its only Firestore
  // query now so it overlaps the slower related-track/ingest work below.
  const publicCollectionsPromise =
    personalized && ctx.likedTrackIds.length
      ? db
          .collection("collections")
          .where("visibility", "==", "public")
          .limit(200)
          .get()
      : Promise.resolve(null);

  const radio: BlendInput["radio"] = [];
  const seedGroups = await Promise.all(
    seeds.map(async (seedId) => {
      try {
        const [seedDoc, related] = await Promise.all([
          db.collection("tracks").doc(seedId).get(),
          provider.getRelatedTracks(seedId),
        ]);
        return {
          seedAffinity: taste.trackAffinity.get(seedId) ?? 1,
          seedTitle: seedDoc.exists
            ? (seedDoc.data() as Track).title
            : "a track you played",
          tracks: related.filter((track) => track.isEmbeddable),
        };
      } catch (err) {
        // One dead seed must not kill the feed — the cold-start below still
        // answers, and other seeds may have succeeded.
        console.error(
          `feed/you-might-like: radio for seed "${seedId}" failed`,
          err
        );
        return {
          seedAffinity: taste.trackAffinity.get(seedId) ?? 1,
          seedTitle: "a track you played",
          tracks: [],
        };
      }
    })
  );
  const seedTracks = [
    ...new Map(
      seedGroups
        .flatMap((group) => group.tracks)
        .map((track) => [track.providerTrackId, track])
    ).values(),
  ];
  if (seedTracks.length) await ingestTracks(seedTracks);
  for (const group of seedGroups) {
    for (const track of group.tracks.slice(0, 10)) {
      radio.push({
        trackId: track.providerTrackId,
        seedTitle: group.seedTitle,
        affinity: group.seedAffinity,
      });
    }
  }

  // A brand-new deployment has no seeds at all (empty catalogue), or seeds
  // whose related-tracks come back empty — prime the radio through the
  // provider instead. coldStartTracks ingests its results, so the doc
  // resolution below finds them.
  if (radio.length === 0) {
    const cold = await coldStartTracks(YOU_MIGHT_LIKE_QUERIES, 20);
    for (const t of cold) {
      if (!ctx.exclude.has(t.providerTrackId)) {
        radio.push({
          trackId: t.providerTrackId,
          seedTitle: "popular right now",
        });
      }
    }
  }

  // Co-listen: tracks appearing alongside the user's liked tracks in OTHER
  // users' public collections.
  const coCount = new Map<string, number>();
  const publicSnap = await publicCollectionsPromise;
  if (publicSnap) {
    const likedSet = new Set(ctx.likedTrackIds);
    for (const doc of publicSnap.docs) {
      const c = doc.data() as Collection;
      if (c.ownerId === uid) continue;
      const ids = (c.tracks ?? []).map((t) => t.trackId);
      if (!ids.some((id) => likedSet.has(id))) continue;
      for (const id of ids)
        if (!likedSet.has(id)) coCount.set(id, (coCount.get(id) ?? 0) + 1);
    }
  }
  const coListen = [...coCount.entries()].map(([trackId, count]) => ({
    trackId,
    count,
  }));

  const labelMatch: BlendInput["labelMatch"] = [];
  const topLabels = [...taste.labelAffinity.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  for (const [label, affinity] of topLabels) {
    try {
      const snap = await db
        .collection("tracks")
        .where("labelIds", "array-contains", label)
        .limit(20)
        .get();
      for (const doc of snap.docs) {
        labelMatch.push({ trackId: doc.id, label, affinity });
      }
    } catch (err) {
      console.error(`feed/you-might-like: label "${label}" failed`, err);
    }
  }

  const candidateIds = [
    ...new Set([
      ...radio.map((item) => item.trackId),
      ...coListen.map((item) => item.trackId),
      ...labelMatch.map((item) => item.trackId),
    ]),
  ];
  const candidateDocs = candidateIds.length
    ? await db.getAll(...candidateIds.map((id) => db.collection("tracks").doc(id)))
    : [];
  const candidates = new Map<string, Track>();
  candidateDocs.forEach((doc, index) => {
    if (doc.exists) candidates.set(candidateIds[index], doc.data() as Track);
  });
  const maxViews = Math.max(
    1,
    ...[...candidates.values()].map((track) => track.stats?.viewCount ?? 0)
  );
  const artistMatch: NonNullable<BlendInput["artistMatch"]> = [];
  const quality: NonNullable<BlendInput["quality"]> = [];
  for (const [trackId, track] of candidates) {
    const artistAffinity = Math.max(
      0,
      ...track.artists.map(
        (artist) => taste.artistAffinity.get(artist.artistId) ?? 0
      )
    );
    if (artistAffinity > 0) {
      artistMatch.push({
        trackId,
        artist: track.artists[0]?.name ?? "an artist you play",
        affinity: artistAffinity,
      });
    }
    quality.push({
      trackId,
      score: Math.log1p(track.stats?.viewCount ?? 0) / Math.log1p(maxViews),
    });
  }

  const recs = blendYouMightLike(
    {
      radio,
      coListen,
      labelMatch,
      artistMatch,
      quality,
      exclude: ctx.exclude,
    },
    60
  );

  const items = diversifyByArtist(recs, candidates, 15).map(
    (recommendation) => ({
      ...recommendation,
      track: candidates.get(recommendation.trackId)!,
    })
  );

  const result = { personalized, items };
  await writeFeedSnapshot(uid, "you-might-like", result);
  return Response.json(result);
}
