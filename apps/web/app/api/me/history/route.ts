import { adminDb } from "@/lib/firebase/admin";
import { invalidateFeedContext } from "../../feed/_context";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

/**
 * Clears the caller's listening history: deletes their playEvents and zeroes
 * the per-track overlay counters. Likes survive — clearing history is not
 * unliking, so isLiked/likedAt are left untouched.
 */
export async function DELETE(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const db = adminDb();
  const userRef = db.collection("users").doc(uid);
  const cutoff = Date.now();
  // Fence in-flight uploads before deleting. Transactions ingesting an older
  // listen will retry against this cutoff instead of restoring cleared data.
  await db.runTransaction(async (tx) => {
    await tx.get(userRef);
    tx.set(
      userRef,
      { historyClearedAtMs: cutoff, feedRevision: FieldValue.increment(1) },
      { merge: true }
    );
    tx.delete(userRef.collection("views").doc("taste"));
    tx.delete(userRef.collection("feeds").doc("you-might-like"));
    tx.delete(userRef.collection("feeds").doc("new-releases"));
  });

  // Delete this user's play events.
  let deleted = 0;
  const removed = new Map<
    string,
    { plays: number; completed: number; skipped: number; seconds: number }
  >();
  for (;;) {
    const events = await db
      .collection("playEvents")
      .where("userId", "==", uid)
      .where("startedAt", "<=", new Date(cutoff))
      .orderBy("startedAt", "desc")
      .limit(200)
      .get();
    if (events.empty) break;
    const batch = db.batch();
    for (const doc of events.docs) {
      const event = doc.data();
      const count = removed.get(event.trackId) ?? {
        plays: 0,
        completed: 0,
        skipped: 0,
        seconds: 0,
      };
      count.plays += 1;
      count.completed += event.completed ? 1 : 0;
      count.skipped += event.skipped ? 1 : 0;
      count.seconds += event.listenedSec ?? 0;
      removed.set(event.trackId, count);
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += events.size;
  }

  // Zero the behavioural counters, preserving like state.
  const states = await db
    .collection("users")
    .doc(uid)
    .collection("trackState")
    .get();
  for (const doc of states.docs) {
    await db.runTransaction(async (tx) => {
      const current = (await tx.get(doc.ref)).data();
      if (!current) return;
      const recent = (current.lastPlayedAt?.toMillis?.() ?? 0) > cutoff;
      const count = removed.get(doc.id);
      const next = {
        playCount: recent
          ? Math.max(0, (current.playCount ?? 0) - (count?.plays ?? 0))
          : 0,
        completedCount: recent
          ? Math.max(0, (current.completedCount ?? 0) - (count?.completed ?? 0))
          : 0,
        skipCount: recent
          ? Math.max(0, (current.skipCount ?? 0) - (count?.skipped ?? 0))
          : 0,
        totalListenedSec: recent
          ? Math.max(0, (current.totalListenedSec ?? 0) - (count?.seconds ?? 0))
          : 0,
        lastPlayedAt: recent ? current.lastPlayedAt : null,
      };
      tx.set(doc.ref, next, { merge: true });
    });
  }

  invalidateFeedContext(uid);
  return Response.json({
    ok: true,
    deletedEvents: deleted,
    clearedAtMs: cutoff,
  });
}
