import { readJsonObject } from "@/lib/api/request-body";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { LIKED_COLLECTION_ID, type Collection } from "@/lib/catalog/model";
import {
  estimatedDocumentBytes,
  COLLECTION_MAX_BYTES,
} from "@/lib/catalog/membership";

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
  if (
    c.ownerId !== uid &&
    c.visibility !== "public" &&
    c.visibility !== "unlisted"
  ) {
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

  const body = (await readJsonObject(req)) as Record<string, unknown>;
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

  const ref = adminDb().collection("collections").doc(collectionId);
  const updated = await adminDb().runTransaction(async (tx) => {
    const current = await tx.get(ref);
    if (!current.exists) return { status: 404, collection: null };
    if (current.data()?.ownerId !== uid)
      return { status: 403, collection: null };
    const collection = { ...current.data(), ...patch };
    if (estimatedDocumentBytes(collection) > COLLECTION_MAX_BYTES)
      return { status: 413, collection: null };
    tx.update(ref, patch);
    return { status: 200, collection };
  });
  return updated.collection
    ? Response.json(updated.collection)
    : Response.json({ error: "Request failed" }, { status: updated.status });
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

  const db = adminDb();
  const status = await db.runTransaction(async (tx) => {
    const ref = db.collection("collections").doc(collectionId);
    const current = await tx.get(ref);
    if (!current.exists) return 404;
    if (current.data()?.ownerId !== uid) return 403;
    tx.delete(ref);
    tx.set(
      db.collection("users").doc(uid),
      { counts: { collectionCount: FieldValue.increment(-1) } },
      { merge: true }
    );
    return 200;
  });
  if (status !== 200)
    return Response.json({ error: "Request failed" }, { status });
  return Response.json({ ok: true });
}
