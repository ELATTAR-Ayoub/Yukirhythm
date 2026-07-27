import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { getCatalogProvider } from "@/lib/catalog/provider";
import { ingestTracks } from "@/lib/catalog/ingest";
import { blendYouMightLike, type BlendInput } from "@/lib/catalog/recommend";
import {
  coldStartTracks,
  YOU_MIGHT_LIKE_QUERIES,
} from "@/lib/catalog/cold-start";
import { loadFeedContext } from "../_context";
import type { Collection, Track, User } from "@/lib/catalog/model";

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

  const db = adminDb();
  const [userSnap, ctx, provider] = await Promise.all([
    db.collection("users").doc(uid).get(),
    loadFeedContext(uid),
    getCatalogProvider(),
  ]);
  const user = userSnap.data() as User | undefined;
  const personalized = user?.privacy?.personalization !== false;

  // Radio: related tracks off the user's most-played seeds (or a cold seed).
  const seeds =
    personalized && ctx.topPlayed.length ? ctx.topPlayed.slice(0, 3) : [];
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
        return { seedTitle: "a track you played", tracks: [] };
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

  // Label affinity is a no-op until enrichment populates labelIds; wired so it
  // lights up for free later.
  const labelMatch: BlendInput["labelMatch"] = [];

  const recs = blendYouMightLike({
    radio,
    coListen,
    labelMatch,
    exclude: ctx.exclude,
  });

  // Resolve to track docs for the UI.
  const recDocs = await Promise.all(
    recs.map((recommendation) =>
      db.collection("tracks").doc(recommendation.trackId).get()
    )
  );
  const items = recs.flatMap((recommendation, index) => {
    const doc = recDocs[index];
    return doc.exists
      ? [{ ...recommendation, track: doc.data() as Track }]
      : [];
  });

  return Response.json({ personalized, items });
}
