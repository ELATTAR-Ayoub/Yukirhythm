import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { getCatalogProvider } from "@/lib/catalog/provider";
import { ingestTracks, toTrackDoc } from "@/lib/catalog/ingest";
import { cacheKey, readCache, writeCache } from "@/lib/catalog/cache";
import type { CatalogSearchType } from "@/lib/catalog/types";
import type { Track } from "@/lib/catalog/model";

/** What search returns to the client: canonical Track shape, like every other route. */
type SearchResponse = {
  query: string;
  type: CatalogSearchType;
  tracks: Track[];
};

const MAX_QUERY_LEN = 200;
const DEFAULT_LIMIT = 20;
const TYPES: CatalogSearchType[] = ["song", "album", "artist", "playlist"];

export async function GET(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) return Response.json({ error: "Query is required" }, { status: 400 });
  if (q.length > MAX_QUERY_LEN)
    return Response.json({ error: "Query is too long" }, { status: 400 });

  const rawType = url.searchParams.get("type") ?? "song";
  const type = (TYPES as string[]).includes(rawType)
    ? (rawType as CatalogSearchType)
    : "song";

  const key = cacheKey(q, type);
  const cached = await readCache<SearchResponse>(key);
  if (cached) return Response.json(cached);

  try {
    const provider = await getCatalogProvider();
    const result = await provider.search(q, { type, limit: DEFAULT_LIMIT });

    // A non-embeddable track cannot be played by the IFrame player, so it must
    // never reach the UI.
    const playable = result.tracks.filter((t) => t.isEmbeddable);
    await ingestTracks(playable);

    // Return the canonical Track shape (trackId, texture, …) — the same shape
    // /catalog/tracks and the store use — so a search result can be liked or
    // added to a playlist without a field-name mismatch.
    const body: SearchResponse = {
      query: result.query,
      type: result.type,
      tracks: playable.map(toTrackDoc),
    };

    await writeCache(key, body);
    return Response.json(body);
  } catch {
    return Response.json(
      { error: "Search is temporarily unavailable" },
      { status: 502 }
    );
  }
}
