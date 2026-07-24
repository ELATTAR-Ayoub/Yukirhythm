import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { getCatalogProvider } from "@/lib/catalog/provider";
import { ingestTracks, toTrackDoc } from "@/lib/catalog/ingest";
import { artistAffinityFrom, scoreNewReleases } from "@/lib/catalog/recommend";
import { coldStartTracks, NEW_RELEASES_QUERIES } from "@/lib/catalog/cold-start";
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

  // Cold start / thin candidates: globally popular catalogue tracks. Guarded —
  // this is the query that needs the (isEmbeddable, stats.viewCount) composite
  // index, and an undeployed index must degrade to the provider fallback
  // below, not to a 500.
  if (candidates.size < 6) {
    try {
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
    } catch (err) {
      console.error("feed/new-releases: popular-tracks query failed", err);
    }
  }

  // Still thin — a fresh deployment with an empty catalogue. Prime it through
  // the provider; coldStartTracks ingests what it finds, so this branch stops
  // running once it has succeeded once.
  if (candidates.size < 6) {
    const cold = await coldStartTracks(NEW_RELEASES_QUERIES, 30);
    for (const t of cold) {
      const id = t.providerTrackId;
      if (!ctx.exclude.has(id) && !candidates.has(id)) {
        candidates.set(id, toTrackDoc(t));
      }
    }
  }

  const ranked = scoreNewReleases([...candidates.values()], affinity, Date.now()).slice(0, 20);
  const items = ranked.map((r) => ({ ...r, track: candidates.get(r.trackId)! }));

  return Response.json({ personalized, items });
}
