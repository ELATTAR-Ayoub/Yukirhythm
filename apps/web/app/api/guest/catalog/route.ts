import { getCatalogProvider } from "@/lib/catalog/provider";
import { toArtistDoc, toTrackDoc } from "@/lib/catalog/ingest";
import { cachedSingleFlight } from "@/lib/catalog/request-cache";

/** Public, read-only provider access. Never creates Firebase users or database documents. */
export async function GET(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const op = params.get("op") ?? "search";
  const q = (params.get("q") ?? "").trim();
  const id = params.get("id") ?? "";
  if (
    !["search", "suggest", "track", "similar", "artist"].includes(op) ||
    q.length > 200 ||
    id.length > 200 ||
    ((op === "search" || op === "suggest") && !q) ||
    (["track", "similar", "artist"].includes(op) && !/^[\w-]+$/.test(id))
  ) {
    return Response.json({ error: "Invalid catalog request" }, { status: 400 });
  }
  try {
    const result = await cachedSingleFlight(
      `guest-catalog:v1:${op}:${q.toLowerCase()}:${id}`,
      15 * 60_000,
      async () => {
        const provider = await getCatalogProvider();
        if (op === "suggest") return { suggestions: await provider.suggest(q) };
        if (op === "track") {
          const track = await provider.getTrack(id);
          return track?.isEmbeddable ? toTrackDoc(track) : null;
        }
        if (op === "artist") {
          const artist = await provider.getArtist(id);
          return artist ? toArtistDoc(artist) : null;
        }
        const tracks =
          op === "similar"
            ? await provider.getRelatedTracks(id)
            : (await provider.search(q, { type: "song", limit: 40 })).tracks;
        return {
          tracks: tracks.filter((t) => t.isEmbeddable).map(toTrackDoc),
          artists: [],
        };
      }
    );
    if (!result) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(result, {
      headers: { "Cache-Control": "public, max-age=900" },
    });
  } catch {
    return Response.json(
      { error: "Music discovery is temporarily unavailable" },
      { status: 502 }
    );
  }
}
