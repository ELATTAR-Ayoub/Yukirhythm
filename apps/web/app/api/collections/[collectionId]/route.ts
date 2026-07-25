import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { LIKED_COLLECTION_ID, type Collection } from "@/lib/catalog/model";

export const runtime = "nodejs";

type Params = { params: Promise<{ collectionId: string }> };

async function load(id: string): Promise<Collection | null> {
  const snap = await adminDb().collection("collections").doc(id).get();
  return snap.exists ? (snap.data() as Collection) : null;
}

export async function GET(req: Request, { params }: Params): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const { collectionId } = await params;
  const c = await load(collectionId);
  if (!c) return Response.json({ error: "Not found" }, { status: 404 });
  // Others may read it only if it is not private.
  if (c.ownerId !== uid && c.visibility === "private") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return Response.json(c);
}

export async function PATCH(
  req: Request,
  { params }: Params
): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const { collectionId } = await params;
  const c = await load(collectionId);
  if (!c) return Response.json({ error: "Not found" }, { status: 404 });
  if (c.ownerId !== uid)
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updatedAt: Timestamp.now() };
  if (typeof body.title === "string" && body.title.trim())
    patch.title = body.title.trim();
  if (typeof body.description === "string")
    patch.description = body.description;
  if (Array.isArray(body.tags))
    patch.tags = body.tags.filter((t) => typeof t === "string");
  if (typeof body.texture === "string") patch.texture = body.texture;
  if (
    body.cover === "texture" ||
    body.cover === "mosaic" ||
    body.cover === "image"
  )
    patch.cover = body.cover;
  if (
    body.visibility === "private" ||
    body.visibility === "unlisted" ||
    body.visibility === "public"
  )
    patch.visibility = body.visibility;

  await adminDb()
    .collection("collections")
    .doc(collectionId)
    .set(patch, { merge: true });
  return Response.json((await load(collectionId)) ?? {});
}

export async function DELETE(
  req: Request,
  { params }: Params
): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const { collectionId } = await params;
  // Liked Songs is virtual (spec D8) — there is nothing to delete.
  if (collectionId === LIKED_COLLECTION_ID) {
    return Response.json(
      { error: "Cannot delete Liked Songs" },
      { status: 409 }
    );
  }

  const c = await load(collectionId);
  if (!c) return Response.json({ error: "Not found" }, { status: 404 });
  if (c.ownerId !== uid)
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const db = adminDb();
  await db.runTransaction(async (tx) => {
    tx.delete(db.collection("collections").doc(collectionId));
    tx.set(
      db.collection("users").doc(uid),
      { counts: { collectionCount: FieldValue.increment(-1) } },
      { merge: true }
    );
  });
  return Response.json({ ok: true });
}
