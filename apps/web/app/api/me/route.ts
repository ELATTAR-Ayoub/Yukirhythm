import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { shapeUser } from "@/lib/api/shape";

export const runtime = "nodejs";

// getUser(uid)
export async function GET(req: Request) {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();
  const snap = await adminDb().collection("users").doc(uid).get();
  if (!snap.exists) return Response.json(null, { status: 404 });
  return Response.json(shapeUser(uid, snap.data()!.userData));
}

// ensureUserDoc — create-if-missing. Body: the userData fields for a new user.
export async function POST(req: Request) {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();
  const ref = adminDb().collection("users").doc(uid);
  const snap = await ref.get();
  if (snap.exists) return Response.json(shapeUser(uid, snap.data()!.userData));
  const body = await req.json();
  // uid is forced from the token — never trust body.ID
  const userData = { ...body, ID: uid };
  await ref.set({ userData });
  return Response.json(shapeUser(uid, userData), { status: 201 });
}
