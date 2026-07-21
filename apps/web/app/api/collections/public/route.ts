import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import type { Collection } from "@/lib/catalog/model";

export const runtime = "nodejs";

/**
 * Another user's non-private collections. `?ownerId=` is required. Only public
 * and unlisted collections are returned — private ones never leak.
 */
export async function GET(req: Request): Promise<Response> {
  const me = await uidFromRequest(req);
  if (!me) return unauthorized();

  const ownerId = new URL(req.url).searchParams.get("ownerId") ?? "";
  if (!ownerId) return Response.json({ error: "ownerId required" }, { status: 400 });

  const snap = await adminDb()
    .collection("collections")
    .where("ownerId", "==", ownerId)
    .get();

  const visible = snap.docs
    .map((d) => d.data() as Collection)
    .filter((c) => c.visibility !== "private");
  return Response.json(visible);
}
