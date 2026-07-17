import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import type { Collection } from "@/constants/interfaces";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();
  const db = adminDb();
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) return unauthorized();
  const u = userSnap.data()!.userData;
  const input = (await req.json()) as Collection;
  if (!input.title)
    return Response.json({ error: "Title required" }, { status: 400 });

  const collectionData = {
    title: input.title,
    desc: input.desc,
    thumbnails: [...input.thumbnails],
    owner: { ID: uid, docID: uid, name: u.userName, avatar: u.avatar },
    audio: [...input.audio],
    likes: 0,
    tags: [...input.tags],
    date: input.date,
    private: input.private,
    collectionLengthSec: input.collectionLengthSec,
  };
  const ref = await db.collection("collections").add({ collectionData });
  return Response.json({ id: ref.id }, { status: 201 });
}
