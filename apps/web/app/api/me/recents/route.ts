import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import type { Collection, PlayEvent, Track } from "@/lib/catalog/model";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

type RecentItem = {
  eventId: string;
  trackId: string;
  startedAtMs: number;
  listenedSec: number;
  track: Track | null;
  /** Provenance — the "— from {collection}" line. */
  collection: { collectionId: string; title: string } | null;
};

/**
 * Play history, newest-first, paginated. The cursor is the last item's
 * startedAt millis; passing it returns the next page with no overlap. Each row
 * resolves its track and, when the play came from a collection, that
 * collection's title.
 */
export async function GET(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const params = new URL(req.url).searchParams;
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(params.get("limit")) || DEFAULT_LIMIT)
  );
  const cursor = Number(params.get("cursor"));

  const db = adminDb();
  let q = db
    .collection("playEvents")
    .where("userId", "==", uid)
    .orderBy("startedAt", "desc");
  if (Number.isFinite(cursor) && cursor > 0) {
    q = q.startAfter(Timestamp.fromMillis(cursor));
  }
  const snap = await q.limit(limit).get();

  const trackCache = new Map<string, Track | null>();
  const collCache = new Map<string, { collectionId: string; title: string } | null>();

  const items: RecentItem[] = [];
  for (const doc of snap.docs) {
    const e = doc.data() as PlayEvent;

    if (!trackCache.has(e.trackId)) {
      const t = await db.collection("tracks").doc(e.trackId).get();
      trackCache.set(e.trackId, t.exists ? (t.data() as Track) : null);
    }
    let collection = null;
    if (e.collectionId) {
      if (!collCache.has(e.collectionId)) {
        const c = await db.collection("collections").doc(e.collectionId).get();
        collCache.set(
          e.collectionId,
          c.exists
            ? { collectionId: e.collectionId, title: (c.data() as Collection).title }
            : null
        );
      }
      collection = collCache.get(e.collectionId) ?? null;
    }

    items.push({
      eventId: e.eventId,
      trackId: e.trackId,
      startedAtMs: (e.startedAt as unknown as { toMillis(): number }).toMillis(),
      listenedSec: e.listenedSec,
      track: trackCache.get(e.trackId) ?? null,
      collection,
    });
  }

  const nextCursor =
    items.length === limit ? items[items.length - 1].startedAtMs : null;

  return Response.json({ items, nextCursor });
}
