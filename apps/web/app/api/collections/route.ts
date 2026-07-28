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
const TRACK_BATCH_SIZE = 100;

export async function GET(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const db = adminDb();
  const owned = (
    await db.collection("collections").where("ownerId", "==", uid).get()
  ).docs.map((d) => d.data() as Collection);

  // Merge in saved references, resolved to their live docs. A collection turned
  // private since it was saved is dropped from the merge, but the saved record
  // survives (it reappears if the owner republishes).
  const saved = await db
    .collection("users")
    .doc(uid)
    .collection("savedCollections")
    .get();
  const savedCollections: Collection[] = [];
  for (const s of saved.docs) {
    const c = await db.collection("collections").doc(s.id).get();
    if (c.exists && (c.data() as Collection).visibility !== "private") {
      savedCollections.push(c.data() as Collection);
    }
  }

  // Owned and saved are distinguishable by ownerId (saved have ownerId !== uid).
  return Response.json([...owned, ...savedCollections]);
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
  if (!title)
    return Response.json({ error: "Title is required" }, { status: 400 });

  const db = adminDb();
  const ref = db.collection("collections").doc();
  const now = Timestamp.now();

  const rawTrackIds = Array.isArray(body.trackIds)
    ? [
        ...new Set(
          body.trackIds.filter((t): t is string => typeof t === "string")
        ),
      ]
    : [];
  const tracks: CollectionTrack[] = rawTrackIds.map((trackId) => ({
    trackId,
    addedAt: now,
    addedBy: uid,
  }));

  // Resolve and validate initial membership in bounded parallel batches.
  const trackChunks = Array.from(
    { length: Math.ceil(rawTrackIds.length / TRACK_BATCH_SIZE) },
    (_, index) =>
      rawTrackIds.slice(
        index * TRACK_BATCH_SIZE,
        (index + 1) * TRACK_BATCH_SIZE
      )
  );
  const trackSnapshots = (
    await Promise.all(
      trackChunks.map((chunk) =>
        db.getAll(
          ...chunk.map((trackId) => db.collection("tracks").doc(trackId))
        )
      )
    )
  ).flat();
  const realTracks = trackSnapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => snapshot.data() as Track);
  if (realTracks.length !== rawTrackIds.length) {
    return Response.json(
      { error: "One or more tracks are unavailable" },
      { status: 400 }
    );
  }
  const totalDurationSec = realTracks.reduce(
    (total, track) => total + (track.durationSec ?? 0),
    0
  );

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
