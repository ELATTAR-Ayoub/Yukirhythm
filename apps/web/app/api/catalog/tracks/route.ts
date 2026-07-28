import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { resolveLabel } from "@/lib/catalog/taxonomy";
import type { Track } from "@/lib/catalog/model";

const LIMIT = 40;
const MAX_IDS = 100;

export async function GET(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const params = new URL(req.url).searchParams;
  const rawIds = (params.get("ids") ?? "").trim();
  if (rawIds) {
    const ids = [
      ...new Set(rawIds.split(",").map((trackId) => trackId.trim())),
    ].filter(Boolean);
    if (ids.length > MAX_IDS) {
      return Response.json(
        { error: `At most ${MAX_IDS} track ids are allowed` },
        { status: 400 }
      );
    }

    const db = adminDb();
    const snapshots = await db.getAll(
      ...ids.map((trackId) => db.collection("tracks").doc(trackId))
    );
    const tracksById = new Map<string, Track>();
    snapshots.forEach((snapshot) => {
      if (!snapshot.exists) return;
      const track = snapshot.data() as Track;
      tracksById.set(track.trackId, track);
    });

    return Response.json({
      tracks: ids
        .map((trackId) => tracksById.get(trackId))
        .filter((track): track is Track => track !== undefined),
      missingTrackIds: ids.filter((trackId) => !tracksById.has(trackId)),
    });
  }

  const raw = (params.get("label") ?? "").trim();
  // Enrichment writes only canonical slugs, so a free-form string can never
  // match. Resolving here is what lets "Lo-Fi" and "lo fi" both work.
  const label = resolveLabel(raw);
  if (!label) {
    return Response.json({ error: "Unknown label" }, { status: 400 });
  }

  const snap = await adminDb()
    .collection("tracks")
    .where("isEmbeddable", "==", true)
    // labelIds is the flat mirror of labels[].label — array-contains cannot
    // match a nested field, so querying labels directly would return nothing.
    .where("labelIds", "array-contains", label)
    .limit(LIMIT)
    .get();

  return Response.json({ label, tracks: snap.docs.map((d) => d.data()) });
}
