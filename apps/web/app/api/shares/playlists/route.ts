import { Timestamp } from "firebase-admin/firestore";

import { sharedPlaylistHref } from "@/components/studio/shell/routes";
import {
  LIKED_COLLECTION_ID,
  MAX_TRACKS_PER_COLLECTION,
  type Collection,
  type SharedPlaylist,
  type User,
} from "@/lib/catalog/model";
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";

export const runtime = "nodejs";

function millis(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return typeof value === "number" ? value : 0;
}

async function likedTrackIds(uid: string): Promise<string[]> {
  const state = await adminDb()
    .collection("users")
    .doc(uid)
    .collection("trackState")
    .where("isLiked", "==", true)
    .get();

  return [...state.docs]
    .sort((a, b) => millis(b.get("likedAt")) - millis(a.get("likedAt")))
    .slice(0, MAX_TRACKS_PER_COLLECTION)
    .map((doc) => doc.id);
}

/**
 * Publish (or refresh) a link-only playlist snapshot. The opaque id is stored
 * in the sharer's private user subtree, so repeated shares keep the same URL
 * without exposing a predictable user/collection id.
 */
export async function POST(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as {
    collectionId?: unknown;
  };
  const collectionId =
    typeof body.collectionId === "string" ? body.collectionId : "";
  if (!collectionId) {
    return Response.json({ error: "A playlist is required" }, { status: 400 });
  }

  const db = adminDb();
  const isLiked = collectionId === LIKED_COLLECTION_ID;
  const userSnap = await db.collection("users").doc(uid).get();
  const sharingUser = userSnap.exists ? (userSnap.data() as User) : null;

  let ownerId = uid;
  let ownerName = sharingUser?.displayName || "A Yukirhythm listener";
  let source: Omit<
    SharedPlaylist,
    | "shareId"
    | "sharedById"
    | "createdAt"
    | "updatedAt"
    | "ownerId"
    | "ownerName"
  >;

  if (isLiked) {
    source = {
      sourceType: "liked",
      sourceId: LIKED_COLLECTION_ID,
      title: "Liked Songs",
      description: `${ownerName}'s Liked Songs`,
      tags: ["liked"],
      cover: "mosaic",
      texture: "tx-k-ripple",
      imageUrl: null,
      trackIds: await likedTrackIds(uid),
    };
  } else {
    const collectionSnap = await db
      .collection("collections")
      .doc(collectionId)
      .get();
    if (!collectionSnap.exists) {
      return Response.json({ error: "Playlist not found" }, { status: 404 });
    }
    const collection = collectionSnap.data() as Collection;
    if (collection.ownerId !== uid && collection.visibility === "private") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    ownerId = collection.ownerId;
    if (ownerId !== uid) {
      const ownerSnap = await db.collection("users").doc(ownerId).get();
      if (ownerSnap.exists) {
        ownerName =
          (ownerSnap.data() as User).displayName || "A Yukirhythm listener";
      }
    }
    source = {
      sourceType: "collection",
      sourceId: collection.collectionId,
      title: collection.title,
      description: collection.description,
      tags: collection.tags ?? [],
      cover: collection.cover,
      texture: collection.texture,
      imageUrl: collection.imageUrl,
      trackIds: (collection.tracks ?? [])
        .slice(0, MAX_TRACKS_PER_COLLECTION)
        .map((track) => track.trackId),
    };
  }

  const pointerRef = db
    .collection("users")
    .doc(uid)
    .collection("shareLinks")
    .doc(isLiked ? LIKED_COLLECTION_ID : collectionId);
  const freshShareRef = db.collection("sharedPlaylists").doc();
  const now = Timestamp.now();
  let shareId = freshShareRef.id;

  await db.runTransaction(async (tx) => {
    const pointer = await tx.get(pointerRef);
    shareId =
      pointer.exists && typeof pointer.get("shareId") === "string"
        ? (pointer.get("shareId") as string)
        : freshShareRef.id;

    const shareRef = db.collection("sharedPlaylists").doc(shareId);
    const existing = await tx.get(shareRef);
    const snapshot: SharedPlaylist = {
      shareId,
      sharedById: uid,
      ownerId,
      ownerName,
      ...source,
      createdAt: existing.exists
        ? (existing.get("createdAt") as Timestamp)
        : now,
      updatedAt: now,
    };

    tx.set(shareRef, snapshot);
    tx.set(
      pointerRef,
      { shareId, sourceType: source.sourceType, updatedAt: now },
      { merge: true }
    );
  });

  return Response.json({
    shareId,
    path: sharedPlaylistHref(shareId),
  });
}
