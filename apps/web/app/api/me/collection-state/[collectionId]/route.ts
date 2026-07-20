import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";

export const runtime = "nodejs";

type Params = { params: Promise<{ collectionId: string }> };

/**
 * Pin state lives per-user, not on the collection, so pinning works identically
 * for owned collections and (phase 6) saved ones.
 */
export async function PUT(req: Request, { params }: Params): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const { collectionId } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = { collectionId };

  if (typeof body.isPinned === "boolean") patch.isPinned = body.isPinned;
  if (body.opened === true) patch.lastOpenedAt = Timestamp.now();

  const ref = adminDb()
    .collection("users")
    .doc(uid)
    .collection("collectionState")
    .doc(collectionId);
  await ref.set(patch, { merge: true });
  return Response.json((await ref.get()).data());
}
