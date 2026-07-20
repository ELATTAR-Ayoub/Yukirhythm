import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { textureForId } from "@/lib/catalog/texture";
import {
  type Collection,
  type CollectionTrack,
  type Track,
} from "@/lib/catalog/model";

export const runtime = "nodejs";

const COVERS = ["texture", "mosaic", "image"] as const;

export async function GET(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();
  const snap = await adminDb()
    .collection("collections")
    .where("ownerId", "==", uid)
    .get();
  return Response.json(snap.docs.map((d) => d.data()));
}

/**
 * Create. Accepts all seven wizard fields in one call. stats are computed from
 * the initial tracks so the Library never fans out reads to render a count.
 */
export async function POST(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return Response.json({ error: "Title is required" }, { status: 400 });

  const db = adminDb();
  const ref = db.collection("collections").doc();
  const now = Timestamp.now();

  const rawTrackIds = Array.isArray(body.trackIds)
    ? body.trackIds.filter((t): t is string => typeof t === "string")
    : [];
  const tracks: CollectionTrack[] = rawTrackIds.map((trackId) => ({
    trackId,
    addedAt: now,
    addedBy: uid,
  }));

  // Sum durations from the real track docs so totalDurationSec is honest.
  let totalDurationSec = 0;
  for (const t of tracks) {
    const ts = await db.collection("tracks").doc(t.trackId).get();
    if (ts.exists) totalDurationSec += (ts.data() as Track).durationSec ?? 0;
  }

  const cover = COVERS.includes(body.cover as (typeof COVERS)[number])
    ? (body.cover as Collection["cover"])
    : tracks.length
      ? "mosaic"
      : "texture";

  const collection: Collection = {
    collectionId: ref.id,
    ownerId: uid,
    role: body.role === "show" ? "show" : "playlist",
    contentType: body.contentType === "podcast" ? "podcast" : "music",
    title,
    description: typeof body.description === "string" ? body.description : "",
    tags: Array.isArray(body.tags)
      ? body.tags.filter((t): t is string => typeof t === "string")
      : [],
    cover,
    texture:
      typeof body.texture === "string"
        ? (body.texture as Collection["texture"])
        : textureForId(ref.id),
    imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : null,
    tracks,
    visibility: "private",
    stats: {
      trackCount: tracks.length,
      totalDurationSec,
      saveCount: 0,
      playCount: 0,
    },
    createdAt: now,
    updatedAt: now,
  };

  await db.runTransaction(async (tx) => {
    tx.set(ref, collection);
    tx.set(
      db.collection("users").doc(uid),
      { counts: { collectionCount: FieldValue.increment(1) } },
      { merge: true }
    );
  });

  return Response.json(collection, { status: 201 });
}
