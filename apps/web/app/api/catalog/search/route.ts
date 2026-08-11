import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { getCatalogProvider } from "@/lib/catalog/provider";
import { toTrackDoc } from "@/lib/catalog/ingest";
import { cachedSingleFlight } from "@/lib/catalog/request-cache";
import type { CatalogSearchType } from "@/lib/catalog/types";
import type { Track } from "@/lib/catalog/model";

type SearchResponse = {
  query: string;
  type: CatalogSearchType;
  tracks: Track[];
};
const MAX_QUERY_LEN = 200;
const DEFAULT_LIMIT = 40;
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

  try {
    const body = await cachedSingleFlight<SearchResponse>(
      `search:v2:${type}:${q.toLocaleLowerCase()}:${DEFAULT_LIMIT}`,
      15 * 60 * 1000,
      async () => {
        const result = await (
          await getCatalogProvider()
        ).search(q, { type, limit: DEFAULT_LIMIT });
        return {
          query: result.query,
          type: result.type,
          tracks: result.tracks
            .filter((track) => track.isEmbeddable)
            .map(toTrackDoc),
        };
      }
    );
    return Response.json(body, {
      headers: { "Cache-Control": "private, max-age=900" },
    });
  } catch {
    return Response.json(
      { error: "Search is temporarily unavailable" },
      { status: 502 }
    );
  }
}
