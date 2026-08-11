import { createHash } from "node:crypto";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { getCatalogProvider } from "@/lib/catalog/provider";
import { toTrackDoc } from "@/lib/catalog/ingest";
import { cachedSingleFlight } from "@/lib/catalog/request-cache";
import type { Track } from "@/lib/catalog/model";

export const runtime = "nodejs";
const TTL = 60 * 60 * 1000;
type Item = {
  trackId: string;
  score: number;
  reason: string;
  recommendationId: string;
  track: Track;
};

export async function GET(req: Request): Promise<Response> {
  if (!(await uidFromRequest(req))) return unauthorized();
  const url = new URL(req.url);
  const seeds = [
    ...new Set(
      url.searchParams
        .getAll("seed")
        .map((seed) => seed.trim())
        .filter(Boolean)
    ),
  ].slice(0, 3);
  const hash = createHash("sha256")
    .update(seeds.sort().join(":") || "cold")
    .digest("hex")
    .slice(0, 16);
  try {
    const body = await cachedSingleFlight<{
      personalized: boolean;
      items: Item[];
    }>(`feed:like:v2:${hash}`, TTL, async () => {
      const provider = await getCatalogProvider();
      const groups = seeds.length
        ? await Promise.all(
            seeds.map((seed) => provider.getRelatedTracks(seed))
          )
        : (
            await Promise.all(
              ["music for you", "popular songs"].map((q) =>
                provider.search(q, { type: "song", limit: 20 })
              )
            )
          ).map((result) => result.tracks);
      const excluded = new Set(seeds);
      const tracks = [
        ...new Map(
          groups
            .flat()
            .filter(
              (track) =>
                track.isEmbeddable && !excluded.has(track.providerTrackId)
            )
            .map((track) => [track.providerTrackId, toTrackDoc(track)])
        ).values(),
      ].slice(0, 20);
      return {
        personalized: seeds.length > 0,
        items: tracks.map((track, index) => ({
          trackId: track.trackId,
          score: 1 - index / Math.max(1, tracks.length),
          reason: seeds.length
            ? "Based on your recent listening"
            : "Popular right now",
          recommendationId: `like:${hash}:${track.trackId}`,
          track,
        })),
      };
    });
    return Response.json(body, {
      headers: { "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return Response.json(
      { error: "Recommendations are temporarily unavailable" },
      { status: 502 }
    );
  }
}
