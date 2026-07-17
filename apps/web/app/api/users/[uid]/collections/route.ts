import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { shapeCollection } from "@/lib/api/shape";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const caller = await uidFromRequest(req);
  if (!caller) return unauthorized();
  const { uid } = await params;
  const q = await adminDb()
    .collection("collections")
    .where("collectionData.owner.ID", "==", uid)
    .get();
  return Response.json(
    q.docs.map((d) => shapeCollection(d.id, d.data().collectionData))
  );
}
