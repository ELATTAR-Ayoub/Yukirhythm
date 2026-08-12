import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import {
  MAX_TRACKS_PER_COLLECTION,
  type Collection,
  type CollectionTrack,
  type Track,
} from "@/lib/catalog/model";
import {
  COLLECTION_MAX_BYTES,
  estimatedDocumentBytes,
  membershipFromTrack,
} from "@/lib/catalog/membership";

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
  const trackRef = db.collection("tracks").doc(trackId);

  let status = 200;
  await db.runTransaction(async (tx) => {
    const [snap, trackSnap] =
      op === "add"
        ? await Promise.all([tx.get(ref), tx.get(trackRef)])
        : [await tx.get(ref), null];
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
        if (!trackSnap?.exists) {
          status = 404;
          return;
        }
        next = [
          ...current,
          membershipFromTrack(trackSnap.data() as Track, Timestamp.now(), uid),
        ];
      }
    } else {
      next = current.filter((t) => t.trackId !== trackId);
    }

    const changed = current.find((entry) => entry.trackId === trackId);
    const previousDuration = c.stats?.totalDurationSec ?? 0;
    const totalDurationSec =
      op === "add"
        ? has
          ? previousDuration
          : previousDuration + ((trackSnap!.data() as Track).durationSec ?? 0)
        : has
          ? Math.max(0, previousDuration - (changed?.durationSec ?? 0))
          : previousDuration;

    const patch = {
      tracks: next,
      stats: {
        ...(c.stats ?? { saveCount: 0, playCount: 0 }),
        trackCount: next.length,
        totalDurationSec,
      },
      updatedAt: Timestamp.now(),
      schemaVersion: 2,
    };
    if (estimatedDocumentBytes({ ...c, ...patch }) > COLLECTION_MAX_BYTES) {
      status = 413;
      return;
    }

    tx.update(ref, patch);
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
