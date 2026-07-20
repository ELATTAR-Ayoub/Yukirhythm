import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { getCatalogProvider } from "@/lib/catalog/provider";
import { ingestTracks } from "@/lib/catalog/ingest";
import { cacheKey, readCache, writeCache } from "@/lib/catalog/cache";
import type {
  CatalogSearchResult,
  CatalogSearchType,
} from "@/lib/catalog/types";

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
  const cached = await readCache<CatalogSearchResult>(key);
  if (cached) return Response.json(cached);

  try {
    const provider = await getCatalogProvider();
    const result = await provider.search(q, { type, limit: DEFAULT_LIMIT });

    // A non-embeddable track cannot be played by the IFrame player, so it must
    // never reach the UI.
    const playable = result.tracks.filter((t) => t.isEmbeddable);
    const body: CatalogSearchResult = { ...result, tracks: playable };

    await ingestTracks(playable);
    await writeCache(key, body);
    return Response.json(body);
  } catch {
    return Response.json(
      { error: "Search is temporarily unavailable" },
      { status: 502 }
    );
  }
}
