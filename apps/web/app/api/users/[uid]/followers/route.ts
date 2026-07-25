import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import type { FollowEdge } from "@/lib/catalog/model";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** Paginated list of the target's followers, newest first. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ uid: string }> }
): Promise<Response> {
  const me = await uidFromRequest(req);
  if (!me) return unauthorized();

  const { uid: userId } = await params;
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(sp.get("limit")) || DEFAULT_LIMIT)
  );
  const cursor = Number(sp.get("cursor"));

  const { Timestamp } = await import("firebase-admin/firestore");
  let q = adminDb()
    .collection("users")
    .doc(userId)
    .collection("followers")
    .orderBy("followedAt", "desc");
  if (Number.isFinite(cursor) && cursor > 0)
    q = q.startAfter(Timestamp.fromMillis(cursor));

  const snap = await q.limit(limit).get();
  const items = snap.docs.map((d) => {
    const e = d.data() as FollowEdge;
    return {
      userId: e.userId,
      followedAtMs: (
        e.followedAt as unknown as { toMillis(): number }
      ).toMillis(),
    };
  });
  const nextCursor =
    items.length === limit ? items[items.length - 1].followedAtMs : null;
  return Response.json({ items, nextCursor });
}
