import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { LIKED_COLLECTION_ID, type Track } from "@/lib/catalog/model";

export const runtime = "nodejs";

/**
 * True for Firestore's FAILED_PRECONDITION — the status a composite-index
 * query throws when the index isn't deployed. gRPC status code 9; the admin
 * SDK also surfaces the same fact in the error message. Checked narrowly on
 * purpose: any other error (permissions, network, ...) must rethrow rather
 * than be mistaken for "no likes yet".
 */
function isMissingIndexError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; message?: unknown };
  if (e.code === 9) return true;
  return typeof e.message === "string" && /requires an index/i.test(e.message);
}

/** `likedAt` may be a Firestore Timestamp (has `.toMillis()`) or a plain
 *  number, depending on how it was written. */
function likedAtMillis(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return typeof value === "number" ? value : 0;
}

/**
 * Liked Songs is virtual (spec D8): assembled from users/{uid}/trackState where
 * isLiked, newest-first, resolved against tracks/. There is no stored
 * collections/liked document, so likes have exactly one source of truth.
 */
export async function GET(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const db = adminDb();
  const trackStateRef = db.collection("users").doc(uid).collection("trackState");

  let docs: QueryDocumentSnapshot[];
  try {
    const liked = await trackStateRef
      .where("isLiked", "==", true)
      .orderBy("likedAt", "desc")
      .get();
    docs = liked.docs;
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;
    // The composite index (isLiked + likedAt) in firestore.indexes.json is
    // still the right answer at scale — this is a correctness fallback for
    // while it isn't deployed, not a replacement. The bare equality query
    // only needs the single-field index Firestore creates automatically;
    // sort newest-first in memory instead.
    const liked = await trackStateRef.where("isLiked", "==", true).get();
    docs = [...liked.docs].sort(
      (a, b) => likedAtMillis(b.get("likedAt")) - likedAtMillis(a.get("likedAt"))
    );
  }

  const trackIds = docs.map((d) => d.id);
  const tracks: Track[] = [];
  let totalDurationSec = 0;
  for (const id of trackIds) {
    const ts = await db.collection("tracks").doc(id).get();
    if (ts.exists) {
      const t = ts.data() as Track;
      tracks.push(t);
      totalDurationSec += t.durationSec ?? 0;
    }
  }

  return Response.json({
    collectionId: LIKED_COLLECTION_ID,
    title: "Liked Songs",
    virtual: true,
    trackIds,
    tracks,
    stats: { trackCount: trackIds.length, totalDurationSec },
  });
}
