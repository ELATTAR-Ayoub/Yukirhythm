import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { getCatalogProvider } from "@/lib/catalog/provider";
import { ingestTracks } from "@/lib/catalog/ingest";
import { artistAffinityFrom, scoreNewReleases } from "@/lib/catalog/recommend";
import { loadFeedContext } from "../_context";
import type { Track, User } from "@/lib/catalog/model";

export const runtime = "nodejs";

/**
 * New releases, personalized: candidates are tracks related to the artists the
 * user plays most, scored 0.5·artistAffinity + 0.3·recency + 0.2·popularity.
 * Recency leans on the provider until enrichment backfills publish dates. Cold
 * start (no history, or personalization off): the most popular recent catalogue
 * tracks by view count.
 */
export async function GET(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const db = adminDb();
  const user = (await db.collection("users").doc(uid).get()).data() as User | undefined;
  const personalized = user?.privacy?.personalization !== false;

  const ctx = await loadFeedContext(uid);

  // Resolve the tracks behind the user's events for artist affinity.
  const eventTrackIds = [...new Set(ctx.events.map((e) => e.trackId))];
  const tracksById = new Map<string, Track>();
  for (const id of eventTrackIds) {
    const t = await db.collection("tracks").doc(id).get();
    if (t.exists) tracksById.set(id, t.data() as Track);
  }
  const affinity = artistAffinityFrom(ctx.events, tracksById);

  // Candidates: related to the user's most-played seeds.
  const candidates = new Map<string, Track>();
  if (personalized && ctx.topPlayed.length) {
    const provider = await getCatalogProvider();
    for (const seed of ctx.topPlayed.slice(0, 3)) {
      const related = (await provider.getRelatedTracks(seed)).filter((t) => t.isEmbeddable);
      if (related.length) await ingestTracks(related);
      for (const t of related) {
        const doc = await db.collection("tracks").doc(t.providerTrackId).get();
        if (doc.exists && !ctx.exclude.has(t.providerTrackId)) {
          candidates.set(t.providerTrackId, doc.data() as Track);
        }
      }
    }
  }

  // Cold start / thin candidates: globally popular catalogue tracks.
  if (candidates.size < 6) {
    const popular = await db
      .collection("tracks")
      .where("isEmbeddable", "==", true)
      .orderBy("stats.viewCount", "desc")
      .limit(30)
      .get();
    for (const doc of popular.docs) {
      if (!ctx.exclude.has(doc.id) && !candidates.has(doc.id)) {
        candidates.set(doc.id, doc.data() as Track);
      }
    }
  }

  const ranked = scoreNewReleases([...candidates.values()], affinity, Date.now()).slice(0, 20);
  const items = ranked.map((r) => ({ ...r, track: candidates.get(r.trackId)! }));

  return Response.json({ personalized, items });
}
