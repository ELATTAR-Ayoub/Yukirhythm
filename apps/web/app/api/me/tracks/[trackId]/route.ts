import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { invalidateRequestCache } from "@/lib/catalog/request-cache";
import { invalidateFeedContext } from "../../../feed/_context";

export const runtime = "nodejs";

type Params = { params: Promise<{ trackId: string }> };

/**
 * The per-user overlay (spec §5.6): like state and resume position. This is
 * the single source of truth for likes — Liked Songs is a query over it (D8),
 * not a stored collection.
 */
export async function PUT(req: Request, { params }: Params): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const { trackId } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = { trackId };

  if (typeof body.isLiked === "boolean") {
    patch.isLiked = body.isLiked;
    patch.likedAt = body.isLiked ? Timestamp.now() : null;
  }
  if (typeof body.resumeSec === "number" && body.resumeSec >= 0) {
    patch.resumeSec = Math.floor(body.resumeSec);
  }

  const ref = adminDb()
    .collection("users")
    .doc(uid)
    .collection("trackState")
    .doc(trackId);
  const snap = await ref.get();
  if (!snap.exists) patch.addedAt = Timestamp.now();

  await ref.set(patch, { merge: true });
  if (typeof body.isLiked === "boolean") {
    invalidateRequestCache(`likes:${uid}`);
    invalidateFeedContext(uid);
  }
  return Response.json(patch);
}
