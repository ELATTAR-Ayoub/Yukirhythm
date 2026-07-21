import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";

export const runtime = "nodejs";

type Params = { params: Promise<{ uid: string }> };

/**
 * Follow. One transaction writes both edges — my following/{target} and their
 * followers/{me} — and bumps both counts. Idempotent: following twice is a
 * no-op, so counts never double. Self-follow is rejected.
 */
export async function PUT(req: Request, { params }: Params): Promise<Response> {
  const me = await uidFromRequest(req);
  if (!me) return unauthorized();

  const { uid: target } = await params;
  if (target === me) {
    return Response.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  const db = adminDb();
  const myEdge = db.collection("users").doc(me).collection("following").doc(target);
  const theirEdge = db.collection("users").doc(target).collection("followers").doc(me);

  await db.runTransaction(async (tx) => {
    const exists = (await tx.get(myEdge)).exists;
    if (exists) return; // idempotent

    const now = Timestamp.now();
    tx.set(myEdge, { userId: target, followedAt: now });
    tx.set(theirEdge, { userId: me, followedAt: now });
    tx.set(
      db.collection("users").doc(me),
      { counts: { followingCount: FieldValue.increment(1) } },
      { merge: true }
    );
    tx.set(
      db.collection("users").doc(target),
      { counts: { followerCount: FieldValue.increment(1) } },
      { merge: true }
    );
  });

  return Response.json({ ok: true, following: true });
}

export async function DELETE(req: Request, { params }: Params): Promise<Response> {
  const me = await uidFromRequest(req);
  if (!me) return unauthorized();

  const { uid: target } = await params;
  if (target === me) {
    return Response.json({ error: "Cannot unfollow yourself" }, { status: 400 });
  }

  const db = adminDb();
  const myEdge = db.collection("users").doc(me).collection("following").doc(target);
  const theirEdge = db.collection("users").doc(target).collection("followers").doc(me);

  await db.runTransaction(async (tx) => {
    const exists = (await tx.get(myEdge)).exists;
    if (!exists) return; // idempotent

    tx.delete(myEdge);
    tx.delete(theirEdge);
    tx.set(
      db.collection("users").doc(me),
      { counts: { followingCount: FieldValue.increment(-1) } },
      { merge: true }
    );
    tx.set(
      db.collection("users").doc(target),
      { counts: { followerCount: FieldValue.increment(-1) } },
      { merge: true }
    );
  });

  return Response.json({ ok: true, following: false });
}
