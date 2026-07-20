import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { LIKED_COLLECTION_ID, type Track } from "@/lib/catalog/model";

export const runtime = "nodejs";

/**
 * Liked Songs is virtual (spec D8): assembled from users/{uid}/trackState where
 * isLiked, newest-first, resolved against tracks/. There is no stored
 * collections/liked document, so likes have exactly one source of truth.
 */
export async function GET(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const db = adminDb();
  const liked = await db
    .collection("users")
    .doc(uid)
    .collection("trackState")
    .where("isLiked", "==", true)
    .orderBy("likedAt", "desc")
    .get();

  const trackIds = liked.docs.map((d) => d.id);
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
