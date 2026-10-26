import { readJsonObject } from "@/lib/api/request-body";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { invalidateFeedContext } from "../../../feed/_context";
import { ensureTrack } from "@/lib/catalog/ensure-track";

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
  const body = (await readJsonObject(req)) as Record<string, unknown>;
  const patch: Record<string, unknown> = { trackId };

  if (body.isLiked === true && !(await ensureTrack(trackId))) {
    return Response.json({ error: "Track is unavailable" }, { status: 404 });
  }

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
    invalidateFeedContext(uid);
  }
  return Response.json(patch);
}
