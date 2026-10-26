import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import type { Collection } from "@/lib/catalog/model";

export const runtime = "nodejs";

/**
 * Another user's public collections. Unlisted collections require their
 * direct link and must not be discoverable through a profile listing.
 */
export async function GET(req: Request): Promise<Response> {
  const me = await uidFromRequest(req);
  if (!me) return unauthorized();

  const ownerId = new URL(req.url).searchParams.get("ownerId") ?? "";
  if (!ownerId)
    return Response.json({ error: "ownerId required" }, { status: 400 });

  const snap = await adminDb()
    .collection("collections")
    .where("ownerId", "==", ownerId)
    .get();

  const visible = snap.docs
    .map((d) => d.data() as Collection)
    .filter((c) => c.visibility === "public");
  return Response.json(visible);
}
