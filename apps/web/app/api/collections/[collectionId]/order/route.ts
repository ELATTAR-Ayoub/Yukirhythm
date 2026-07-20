import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import type { Collection, CollectionTrack } from "@/lib/catalog/model";

export const runtime = "nodejs";

type Params = { params: Promise<{ collectionId: string }> };

/**
 * Reorders membership. The body's trackIds must be a permutation of the current
 * membership — anything else is a client bug, rejected with 400 rather than
 * silently dropping or inventing tracks. Each entry keeps its addedAt/addedBy.
 */
export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const { collectionId } = await params;
  const body = (await req.json().catch(() => ({}))) as { trackIds?: unknown };
  const order = Array.isArray(body.trackIds)
    ? body.trackIds.filter((t): t is string => typeof t === "string")
    : null;
  if (!order) return Response.json({ error: "trackIds required" }, { status: 400 });

  const db = adminDb();
  const ref = db.collection("collections").doc(collectionId);

  let status = 200;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      status = 404;
      return;
    }
    const c = snap.data() as Collection;
    if (c.ownerId !== uid) {
      status = 403;
      return;
    }

    const byId = new Map(c.tracks.map((t) => [t.trackId, t]));
    const isPermutation =
      order.length === c.tracks.length && order.every((id) => byId.has(id));
    if (!isPermutation) {
      status = 400;
      return;
    }

    const next: CollectionTrack[] = order.map((id) => byId.get(id)!);
    tx.update(ref, { tracks: next, updatedAt: Timestamp.now() });
  });

  if (status !== 200) {
    return Response.json({ error: "Request failed" }, { status });
  }
  return Response.json({ ok: true });
}
