import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { getCatalogProvider } from "@/lib/catalog/provider";
import { toTrackDoc } from "@/lib/catalog/ingest";
import { cachedSingleFlight } from "@/lib/catalog/request-cache";
import type { Track } from "@/lib/catalog/model";

export const runtime = "nodejs";
const WEEK = 7 * 24 * 60 * 60 * 1000;
type Item = {
  trackId: string;
  score: number;
  reason: string;
  recommendationId: string;
  track: Track;
};
type SimilarResponse = { seedTrackId: string; items: Item[] };

export async function GET(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();
  const trackId = new URL(req.url).searchParams.get("trackId")?.trim();
  if (!trackId)
    return Response.json({ error: "trackId is required" }, { status: 400 });
  try {
    const body = await cachedSingleFlight<SimilarResponse>(
      `similar:v2:${trackId}`,
      WEEK,
      async () => {
        const related = (
          await (await getCatalogProvider()).getRelatedTracks(trackId)
        )
          .filter(
            (track) => track.isEmbeddable && track.providerTrackId !== trackId
          )
          .slice(0, 20)
          .map(toTrackDoc);
        const artists = new Set<string>();
        const tracks = related
          .filter((track) => {
            const artist = track.artists[0]?.artistId;
            if (artist && artists.has(artist)) return false;
            if (artist) artists.add(artist);
            return true;
          })
          .slice(0, 12);
        return {
          seedTrackId: trackId,
          items: tracks.map((track, index) => ({
            trackId: track.trackId,
            score: 1 - index / Math.max(1, tracks.length),
            reason: "Similar track",
            recommendationId: `similar:${trackId}:${track.trackId}`,
            track,
          })),
        };
      }
    );
    return Response.json(body, {
      headers: { "Cache-Control": "private, max-age=604800" },
    });
  } catch {
    return Response.json(
      { error: "Similar tracks are temporarily unavailable" },
      { status: 502 }
    );
  }
}
