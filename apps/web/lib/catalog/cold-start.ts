import { getCatalogProvider } from "./provider";
import { ingestTracks } from "./ingest";
import { cacheKey, readCache, writeCache } from "./cache";
import type { ProviderTrack } from "./types";

/**
 * Cold-start priming for the feed routes.
 *
 * On a brand-new deployment the `tracks` collection is empty (and its
 * popularity composite index may not be deployed), so the feeds' Firestore
 * fallbacks have nothing to answer with. These curated provider searches fill
 * that gap; every result is ingested, so the fallback warms the catalogue and
 * stops being needed once it has run.
 */
export const NEW_RELEASES_QUERIES = ["new music this week", "new songs 2026"];
export const YOU_MIGHT_LIKE_QUERIES = ["top hits", "popular songs"];

/**
 * Provider-searches each query (24h-cached, so cold loads don't hammer the
 * scraper), keeps only embeddable tracks, ingests them, and returns the union
 * deduped by track id, capped at `limit`. A failing query is logged and
 * skipped — a cold start answering with fewer tracks beats one answering with
 * an error.
 */
export async function coldStartTracks(
  queries: string[],
  limit: number
): Promise<ProviderTrack[]> {
  const out = new Map<string, ProviderTrack>();
  for (const q of queries) {
    if (out.size >= limit) break;
    try {
      // "coldstart" prefixes the key: the search route caches a different
      // payload shape (its SearchResponse) under the bare query.
      const key = cacheKey(`coldstart ${q}`, "song");
      let tracks = await readCache<ProviderTrack[]>(key);
      if (!tracks) {
        const provider = await getCatalogProvider();
        const res = await provider.search(q, { type: "song", limit: 20 });
        tracks = res.tracks.filter((t) => t.isEmbeddable);
        // Ingestion is fatal-per-query on purpose: Task 6's you-might-like
        // route depends on cold-start results existing as track docs, so a
        // failed ingest must not be swallowed like a cache miss would be.
        await ingestTracks(tracks);
        // Caching is best-effort only: a transient write failure must not
        // discard tracks that were already searched and ingested. And an
        // empty answer is never cached — the scraper is known-flaky, and
        // caching a zero-result response would freeze both feed shelves
        // empty for a full day on one bad response.
        if (tracks.length > 0) {
          await writeCache(key, tracks).catch((err) =>
            console.error(`cold-start: caching "${q}" failed`, err)
          );
        }
      }
      for (const t of tracks) {
        if (!out.has(t.providerTrackId)) out.set(t.providerTrackId, t);
      }
    } catch (err) {
      console.error(`cold-start: query "${q}" failed`, err);
    }
  }
  return [...out.values()].slice(0, limit);
}
