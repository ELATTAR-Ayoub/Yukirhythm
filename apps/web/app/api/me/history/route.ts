import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";

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

  // Delete this user's play events.
  const events = await db.collection("playEvents").where("userId", "==", uid).get();
  let deleted = 0;
  for (const doc of events.docs) {
    await doc.ref.delete();
    deleted++;
  }

  // Zero the behavioural counters, preserving like state.
  const states = await db
    .collection("users")
    .doc(uid)
    .collection("trackState")
    .get();
  for (const doc of states.docs) {
    await doc.ref.set(
      {
        playCount: 0,
        completedCount: 0,
        skipCount: 0,
        totalListenedSec: 0,
        lastPlayedAt: null,
      },
      { merge: true }
    );
  }

  return Response.json({ ok: true, deletedEvents: deleted });
}
