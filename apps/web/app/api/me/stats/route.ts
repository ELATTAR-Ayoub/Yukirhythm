import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { computeStats, type StatEvent } from "@/lib/catalog/stats";
import type { PlayEvent, Track } from "@/lib/catalog/model";

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
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const raw = new URL(req.url).searchParams.get("tz") ?? "UTC";
  const tz = validTz(raw) ? raw : "UTC";

  const db = adminDb();
  const snap = await db.collection("playEvents").where("userId", "==", uid).get();

  const events: StatEvent[] = snap.docs.map((d) => {
    const e = d.data() as PlayEvent;
    return {
      ...e,
      startedAtMs: (e.startedAt as unknown as { toMillis(): number }).toMillis(),
    };
  });

  // Load the referenced tracks once for artist/genre resolution.
  const trackIds = [...new Set(events.map((e) => e.trackId))];
  const tracksById = new Map<string, Track>();
  for (const id of trackIds) {
    const t = await db.collection("tracks").doc(id).get();
    if (t.exists) tracksById.set(id, t.data() as Track);
  }

  // Compute-on-read (see phase-5 plan): the rolling windows decrease as events
  // age out, with no scheduled sweep to maintain a cached rollup.
  return Response.json(computeStats(events, tracksById, Date.now(), tz));
}
