import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { getCatalogProvider } from "@/lib/catalog/provider";
import { ingestTracks } from "@/lib/catalog/ingest";
import { blendYouMightLike, type BlendInput } from "@/lib/catalog/recommend";
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
  const user = (await db.collection("users").doc(uid).get()).data() as User | undefined;
  const personalized = user?.privacy?.personalization !== false;

  const ctx = await loadFeedContext(uid);
  const provider = await getCatalogProvider();

  // Radio: related tracks off the user's most-played seeds (or a cold seed).
  const seeds = personalized && ctx.topPlayed.length ? ctx.topPlayed.slice(0, 3) : [];
  if (seeds.length === 0) {
    const cold = await coldSeed();
    if (cold) seeds.push(cold);
  }

  const radio: BlendInput["radio"] = [];
  for (const seedId of seeds) {
    const seedDoc = await db.collection("tracks").doc(seedId).get();
    const seedTitle = seedDoc.exists ? (seedDoc.data() as Track).title : "a track you played";
    const related = await provider.getRelatedTracks(seedId);
    const embeddable = related.filter((t) => t.isEmbeddable);
    if (embeddable.length) await ingestTracks(embeddable);
    for (const t of embeddable.slice(0, 10)) {
      radio.push({ trackId: t.providerTrackId, seedTitle });
    }
  }

  // Co-listen: tracks appearing alongside the user's liked tracks in OTHER
  // users' public collections.
  const coCount = new Map<string, number>();
  if (personalized && ctx.likedTrackIds.length) {
    const publicSnap = await db
      .collection("collections")
      .where("visibility", "==", "public")
      .limit(200)
      .get();
    const likedSet = new Set(ctx.likedTrackIds);
    for (const doc of publicSnap.docs) {
      const c = doc.data() as Collection;
      if (c.ownerId === uid) continue;
      const ids = (c.tracks ?? []).map((t) => t.trackId);
      if (!ids.some((id) => likedSet.has(id))) continue;
      for (const id of ids) if (!likedSet.has(id)) coCount.set(id, (coCount.get(id) ?? 0) + 1);
    }
  }
  const coListen = [...coCount.entries()].map(([trackId, count]) => ({ trackId, count }));

  // Label affinity is a no-op until enrichment populates labelIds; wired so it
  // lights up for free later.
  const labelMatch: BlendInput["labelMatch"] = [];

  const recs = blendYouMightLike({ radio, coListen, labelMatch, exclude: ctx.exclude });

  // Resolve to track docs for the UI.
  const items = [];
  for (const r of recs) {
    const t = await db.collection("tracks").doc(r.trackId).get();
    if (t.exists) items.push({ ...r, track: t.data() as Track });
  }

  return Response.json({ personalized, items });
}
