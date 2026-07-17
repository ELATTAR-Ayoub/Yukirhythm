import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { shapeUser } from "@/lib/api/shape";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const caller = await uidFromRequest(req);
  if (!caller) return unauthorized();
  const { uid } = await params;
  const snap = await adminDb().collection("users").doc(uid).get();
  if (!snap.exists) return Response.json({}, { status: 404 });
  return Response.json(shapeUser(uid, snap.data()!.userData));
}
