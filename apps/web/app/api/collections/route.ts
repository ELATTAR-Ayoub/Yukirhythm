import { readJsonObject } from "@/lib/api/request-body";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { textureForId } from "@/lib/catalog/texture";
import { ensureTrack } from "@/lib/catalog/ensure-track";
import {
  type Collection,
  type CollectionTrack,
  type Track,
  MAX_TRACKS_PER_COLLECTION,
} from "@/lib/catalog/model";
import {
  COLLECTION_MAX_BYTES,
  estimatedDocumentBytes,
  membershipFromTrack,
} from "@/lib/catalog/membership";

export const runtime = "nodejs";

const COVERS = ["texture", "mosaic", "image"] as const;

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
    if (
      c.exists &&
      ["public", "unlisted"].includes((c.data() as Collection).visibility)
    ) {
      savedCollections.push(c.data() as Collection);
    }
  }

  // Owned and saved are distinguishable by ownerId (saved have ownerId !== uid).
  const pins = await db
    .collection("users")
    .doc(uid)
    .collection("collectionState")
    .where("isPinned", "==", true)
    .get();
  const pinnedIds = new Set(pins.docs.map((doc) => doc.id));
  return Response.json(
    [...owned, ...savedCollections].map((collection) => ({
      ...collection,
      isPinned: pinnedIds.has(collection.collectionId),
    })),
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

/**
 * Create. Accepts all seven wizard fields in one call. stats are computed from
 * the initial tracks so the Library never fans out reads to render a count.
 */
export async function POST(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const body = (await readJsonObject(req)) as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title)
    return Response.json({ error: "Title is required" }, { status: 400 });

  const db = adminDb();
  const ref = db.collection("collections").doc();
  const now = Timestamp.now();

  const rawTrackIds = Array.isArray(body.trackIds)
    ? body.trackIds.filter((t): t is string => typeof t === "string")
    : [];
  const uniqueTrackIds = [...new Set(rawTrackIds)];
  if (
    uniqueTrackIds.length > MAX_TRACKS_PER_COLLECTION ||
    uniqueTrackIds.some((id) => !id || id.length > 300 || id.includes("/"))
  ) {
    return Response.json({ error: "Invalid track list" }, { status: 400 });
  }
  if (
    title.length > 300 ||
    (typeof body.description === "string" && body.description.length > 5000) ||
    (Array.isArray(body.tags) &&
      (body.tags.length > 20 ||
        body.tags.some((tag) => typeof tag !== "string" || tag.length > 60)))
  ) {
    return Response.json(
      { error: "Playlist details are too long" },
      { status: 400 }
    );
  }
  const trackRefs = uniqueTrackIds.map((trackId) =>
    db.collection("tracks").doc(trackId)
  );
  const trackSnaps = trackRefs.length ? await db.getAll(...trackRefs) : [];
  const trackById = new Map<string, Track>();
  for (const snap of trackSnaps) {
    if (snap.exists) trackById.set(snap.id, snap.data() as Track);
    else {
      const track = await ensureTrack(snap.id);
      if (!track)
        return Response.json(
          { error: "Track is unavailable" },
          { status: 404 }
        );
      trackById.set(snap.id, track);
    }
  }
  const tracks: CollectionTrack[] = [];
  let totalDurationSec = 0;
  for (const trackId of uniqueTrackIds) {
    const track = trackById.get(trackId);
    if (!track) continue;
    tracks.push(membershipFromTrack(track, now, uid));
    totalDurationSec += track.durationSec ?? 0;
  }

  const cover = COVERS.includes(body.cover as (typeof COVERS)[number])
    ? (body.cover as Collection["cover"])
    : tracks.length
      ? "mosaic"
      : "texture";

  const collection: Collection = {
    collectionId: ref.id,
    schemaVersion: 2,
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

  if (estimatedDocumentBytes(collection) > COLLECTION_MAX_BYTES) {
    return Response.json({ error: "Collection is too large" }, { status: 413 });
  }

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
