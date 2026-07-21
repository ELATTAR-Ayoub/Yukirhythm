import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import type { PlaybackState } from "@/lib/catalog/model";

export const runtime = "nodejs";

type Params = { params: Promise<{ index: string }> };

const ref = (uid: string) =>
  adminDb().collection("users").doc(uid).collection("playback").doc("current");

/**
 * Remove the entry at `index` in the main queue. If it sits at or before the
 * current cursor, queueIndex is decremented so the currently-playing track does
 * not shift underneath the listener.
 */
export async function DELETE(req: Request, { params }: Params): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const { index } = await params;
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0) {
    return Response.json({ error: "Bad index" }, { status: 400 });
  }

  const r = ref(uid);
  let status = 200;
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(r);
    if (!snap.exists) {
      status = 404;
      return;
    }
    const state = snap.data() as PlaybackState;
    const queue = state.queue ?? [];
    if (i >= queue.length) {
      status = 400;
      return;
    }

    const nextQueue = queue.filter((_, idx) => idx !== i);
    // Removing an item at or before the cursor shifts everything after it left
    // by one, so the cursor must move too to stay on the same track.
    const nextIndex =
      i <= state.queueIndex ? state.queueIndex - 1 : state.queueIndex;

    tx.update(r, {
      queue: nextQueue,
      queueIndex: nextIndex,
      updatedAt: Timestamp.now(),
    });
  });

  if (status !== 200) {
    return Response.json({ error: "Request failed" }, { status });
  }
  return Response.json((await r.get()).data());
}
