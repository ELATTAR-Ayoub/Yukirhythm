import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import type { Audio } from "@/constants/interfaces";

export const runtime = "nodejs";

export async function PUT(req: Request) {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();
  const { audio } = (await req.json()) as { audio: Audio };
  const db = adminDb();
  const ref = db.collection("users").doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const current: Audio[] = snap.data()!.userData?.lovedSongs ?? [];
    if (current.some((s) => s.ID === audio.ID)) return; // already loved
    tx.update(ref, { "userData.lovedSongs": [...current, audio] });
  });
  return Response.json({ ok: true });
}
