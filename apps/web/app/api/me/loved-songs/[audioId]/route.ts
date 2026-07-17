import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import type { Audio } from "@/constants/interfaces";

export const runtime = "nodejs";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ audioId: string }> }
) {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();
  const { audioId } = await params;
  const db = adminDb();
  const ref = db.collection("users").doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const current: Audio[] = snap.data()!.userData?.lovedSongs ?? [];
    tx.update(ref, {
      "userData.lovedSongs": current.filter((s) => s.ID !== audioId),
    });
  });
  return Response.json({ ok: true });
}
