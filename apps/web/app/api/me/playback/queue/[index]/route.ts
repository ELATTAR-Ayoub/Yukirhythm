import { Timestamp } from "firebase-admin/firestore";
import { gone } from "@/lib/api/disabled";
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import type { PlaybackState } from "@/lib/catalog/model";

export const runtime = "nodejs";

type Params = { params: Promise<{ index: string }> };

const ref = (uid: string) =>
  adminDb().collection("users").doc(uid).collection("playback").doc("current");

/**
 * Remove the entry at `index` in the main queue. If it sits strictly before
 * the current cursor, queueIndex is decremented so the currently-playing
 * track does not shift underneath the listener. Removing the cursor's own
 * slot leaves the index in place — addressing the track that follows — and
 * clamps to -1 if that slot was also the last one left.
 */
export async function DELETE(
  req: Request,
  { params }: Params
): Promise<Response> {
  if (process.env.ENABLE_LEGACY_PLAYBACK_SYNC !== "true") return gone("Playback queue sync");
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const { index } = await params;
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0) {
    return Response.json({ error: "Bad index" }, { status: 400 });
  }

  const r = ref(uid);
  let status = 200;
  let result: Partial<PlaybackState> = {};
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
    // Removing an item strictly before the cursor shifts everything after it
    // left by one, so the cursor must move too to stay on the same track.
    // Removing the cursor's own slot leaves the index put: there is no
    // currently-playing track left to protect there, and the same position
    // now addresses whatever used to follow it — dropping what's playing
    // means moving on, not rewinding to the previous track. If that slot was
    // also the last one, nothing is left to address: clamp to -1 rather than
    // point one past the end of the shorter queue.
    let nextIndex =
      i < state.queueIndex ? state.queueIndex - 1 : state.queueIndex;
    if (nextIndex >= nextQueue.length) nextIndex = -1;

    result = {
      queue: nextQueue,
      queueIndex: nextIndex,
      updatedAt: Timestamp.now(),
    };
    tx.update(r, result);
  });

  if (status !== 200) {
    return Response.json({ error: "Request failed" }, { status });
  }
  return Response.json(result);
}
