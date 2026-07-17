import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();
  const { id } = await params;
  const db = adminDb();
  await db
    .collection("users")
    .doc(uid)
    .update({
      "userData.lovedCollections": FieldValue.arrayUnion(id),
    });
  await db
    .collection("collections")
    .doc(id)
    .update({
      "collectionData.likes": FieldValue.increment(1),
    });
  return Response.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();
  const { id } = await params;
  const db = adminDb();
  await db
    .collection("users")
    .doc(uid)
    .update({
      "userData.lovedCollections": FieldValue.arrayRemove(id),
    });
  await db
    .collection("collections")
    .doc(id)
    .update({
      "collectionData.likes": FieldValue.increment(-1),
    });
  return Response.json({ ok: true });
}
