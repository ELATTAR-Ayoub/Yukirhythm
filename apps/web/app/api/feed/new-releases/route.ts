import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { getCatalogProvider } from "@/lib/catalog/provider";
import { toTrackDoc } from "@/lib/catalog/ingest";
import { cachedSingleFlight } from "@/lib/catalog/request-cache";
import type { Track } from "@/lib/catalog/model";

export const runtime = "nodejs";
const TTL = 8 * 60 * 60 * 1000;
type Feed = {
  personalized: false;
  items: Array<{
    trackId: string;
    score: number;
    reason: string;
    recommendationId: string;
    track: Track;
  }>;
};

export async function GET(req: Request): Promise<Response> {
  if (!(await uidFromRequest(req))) return unauthorized();
  try {
    const body = await cachedSingleFlight<Feed>(
      "feed:new-releases:v2",
      TTL,
      async () => {
        const provider = await getCatalogProvider();
        const groups = await Promise.all(
          ["new music this week", "new songs"].map((q) =>
            provider.search(q, { type: "song", limit: 20 })
          )
        );
        const tracks = [
          ...new Map(
            groups
              .flatMap((group) => group.tracks)
              .filter((track) => track.isEmbeddable)
              .map((track) => [track.providerTrackId, toTrackDoc(track)])
          ).values(),
        ].slice(0, 20);
        return {
          personalized: false,
          items: tracks.map((track, index) => ({
            trackId: track.trackId,
            score: 1 - index / Math.max(1, tracks.length),
            reason: "New release",
            recommendationId: `new:${track.trackId}`,
            track,
          })),
        };
      }
    );
    return Response.json(body, {
      headers: { "Cache-Control": "private, max-age=28800" },
    });
  } catch {
    return Response.json(
      { error: "New releases are temporarily unavailable" },
      { status: 502 }
    );
  }
}
