import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { gone } from "@/lib/api/disabled";
import { computeStats } from "@/lib/catalog/stats";
import { loadFeedContext } from "../../feed/_context";

export const runtime = "nodejs";

function validTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: Request): Promise<Response> {
  if (process.env.ENABLE_LEGACY_LISTENING_SYNC !== "true") return gone("Listening statistics");
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const raw = new URL(req.url).searchParams.get("tz") ?? "UTC";
  const tz = validTz(raw) ? raw : "UTC";

  const { events, tasteTracks } = await loadFeedContext(uid);

  // Compute-on-read (see phase-5 plan): the rolling windows decrease as events
  // age out, with no scheduled sweep to maintain a cached rollup.
  return Response.json(computeStats(events, tasteTracks, Date.now(), tz));
}
