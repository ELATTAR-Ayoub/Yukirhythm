import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import {
  MAX_TRACKS_PER_COLLECTION,
  type Collection,
  type CollectionTrack,
  type Track,
} from "@/lib/catalog/model";

export const runtime = "nodejs";

type Params = { params: Promise<{ collectionId: string; trackId: string }> };

/**
 * Membership changes run in a transaction because stats.trackCount and
 * totalDurationSec are denormalised — the Library renders them directly and
 * must never disagree with the tracks array.
 */
async function mutate(
  req: Request,
  { params }: Params,
  op: "add" | "remove"
): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const { collectionId, trackId } = await params;
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

    const current = c.tracks ?? [];
    const has = current.some((t) => t.trackId === trackId);
    let next: CollectionTrack[];

    if (op === "add") {
      if (has) next = current;
      else if (current.length >= MAX_TRACKS_PER_COLLECTION) {
        status = 409;
        return;
      } else {
        next = [
          ...current,
          { trackId, addedAt: Timestamp.now(), addedBy: uid },
        ];
      }
    } else {
      next = current.filter((t) => t.trackId !== trackId);
    }

    // Recompute totalDurationSec from the real track docs.
    let totalDurationSec = 0;
    for (const t of next) {
      const ts = await tx.get(db.collection("tracks").doc(t.trackId));
      if (ts.exists) totalDurationSec += (ts.data() as Track).durationSec ?? 0;
    }

    tx.update(ref, {
      tracks: next,
      stats: {
        ...(c.stats ?? { saveCount: 0, playCount: 0 }),
        trackCount: next.length,
        totalDurationSec,
      },
      updatedAt: Timestamp.now(),
    });
  });

  if (status !== 200) {
    return Response.json({ error: "Request failed" }, { status });
  }
  return Response.json({ ok: true });
}

export async function PUT(req: Request, ctx: Params): Promise<Response> {
  return mutate(req, ctx, "add");
}

export async function DELETE(req: Request, ctx: Params): Promise<Response> {
  return mutate(req, ctx, "remove");
}
