import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import type { Collection } from "@/lib/catalog/model";

export const runtime = "nodejs";

type Params = { params: Promise<{ collectionId: string }> };

/**
 * Save another user's collection as a reference (not a copy). Only a public or
 * unlisted collection can be saved, and not your own. Increments saveCount.
 */
export async function PUT(req: Request, { params }: Params): Promise<Response> {
  const me = await uidFromRequest(req);
  if (!me) return unauthorized();

  const { collectionId } = await params;
  const db = adminDb();
  const cRef = db.collection("collections").doc(collectionId);
  const savedRef = db
    .collection("users")
    .doc(me)
    .collection("savedCollections")
    .doc(collectionId);

  let status = 200;
  await db.runTransaction(async (tx) => {
    const cSnap = await tx.get(cRef);
    if (!cSnap.exists) {
      status = 404;
      return;
    }
    const c = cSnap.data() as Collection;
    if (c.ownerId === me) {
      status = 400; // saving your own is meaningless
      return;
    }
    if (c.visibility === "private") {
      status = 403;
      return;
    }
    if ((await tx.get(savedRef)).exists) return; // idempotent

    tx.set(savedRef, {
      collectionId,
      ownerId: c.ownerId,
      savedAt: Timestamp.now(),
      isPinned: false,
    });
    tx.update(cRef, {
      stats: { ...c.stats, saveCount: (c.stats?.saveCount ?? 0) + 1 },
    });
  });

  if (status !== 200)
    return Response.json({ error: "Request failed" }, { status });
  return Response.json({ ok: true, saved: true });
}

export async function DELETE(
  req: Request,
  { params }: Params
): Promise<Response> {
  const me = await uidFromRequest(req);
  if (!me) return unauthorized();

  const { collectionId } = await params;
  const db = adminDb();
  const cRef = db.collection("collections").doc(collectionId);
  const savedRef = db
    .collection("users")
    .doc(me)
    .collection("savedCollections")
    .doc(collectionId);

  await db.runTransaction(async (tx) => {
    // All reads before any write — Firestore transactions require it.
    const savedSnap = await tx.get(savedRef);
    if (!savedSnap.exists) return; // idempotent
    const cSnap = await tx.get(cRef);

    tx.delete(savedRef);
    if (cSnap.exists) {
      const c = cSnap.data() as Collection;
      tx.update(cRef, {
        stats: {
          ...c.stats,
          saveCount: Math.max(0, (c.stats?.saveCount ?? 0) - 1),
        },
      });
    }
  });

  return Response.json({ ok: true, saved: false });
}
