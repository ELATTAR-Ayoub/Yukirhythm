import { adminDb } from "@/lib/firebase/admin";
import type {
  Collection,
  PlayEvent,
  Track,
  TrackState,
} from "@/lib/catalog/model";
import type { StatEvent } from "@/lib/catalog/stats";

const DAY = 24 * 60 * 60 * 1000;

/** The signals every feed needs about a caller, read once from real Firestore. */
export type FeedContext = {
  events: StatEvent[];
  /** Track ids the user should not be recommended: library + last-7-days plays. */
  exclude: Set<string>;
  /** The user's most-played trackIds, completed first, for radio seeds. */
  topPlayed: string[];
  /** The user's liked trackIds. */
  likedTrackIds: string[];
  tasteTracks: Map<string, Track>;
};

const CACHE_MS = 5 * 60 * 1000;
type CacheEntry = { expiresAt: number; value: Promise<FeedContext> };
const globalCache = globalThis as typeof globalThis & {
  __yukiFeedContextCache?: Map<string, CacheEntry>;
};
const contextCache =
  globalCache.__yukiFeedContextCache ??
  (globalCache.__yukiFeedContextCache = new Map<string, CacheEntry>());

async function readFeedContext(uid: string): Promise<FeedContext> {
  const db = adminDb();

  // These snapshots have no dependency on one another. Reading them together
  // removes two full Firestore round trips from every personalized feed.
  const [evSnap, owned, stateSnap] = await Promise.all([
    db
      .collection("playEvents")
      .where("userId", "==", uid)
      .orderBy("startedAt", "desc")
      .limit(200)
      .get(),
    db.collection("collections").where("ownerId", "==", uid).get(),
    db.collection("users").doc(uid).collection("trackState").get(),
  ]);
  const events: StatEvent[] = evSnap.docs.map((d) => {
    const e = d.data() as PlayEvent;
    return {
      ...e,
      startedAtMs: (
        e.startedAt as unknown as { toMillis(): number }
      ).toMillis(),
    };
  });

  const now = Date.now();
  const exclude = new Set<string>();
  for (const e of events)
    if (e.startedAtMs >= now - 7 * DAY) exclude.add(e.trackId);

  // library: every track in the user's owned collections
  for (const doc of owned.docs) {
    for (const t of (doc.data() as Collection).tracks ?? [])
      exclude.add(t.trackId);
  }

  // overlay: liked + play counts
  const states = stateSnap.docs.map((d) => d.data() as TrackState);
  const likedTrackIds = states.filter((s) => s.isLiked).map((s) => s.trackId);
  for (const id of likedTrackIds) exclude.add(id);

  const topPlayed = [...states]
    .sort((a, b) => (b.completedCount ?? 0) - (a.completedCount ?? 0))
    .slice(0, 5)
    .map((s) => s.trackId);

  const tasteIds = [
    ...new Set([...events.map((event) => event.trackId), ...likedTrackIds]),
  ];
  const tasteDocs = await Promise.all(
    tasteIds.map((id) => db.collection("tracks").doc(id).get())
  );
  const tasteTracks = new Map<string, Track>();
  tasteDocs.forEach((doc, index) => {
    if (doc.exists) tasteTracks.set(tasteIds[index], doc.data() as Track);
  });

  return { events, exclude, topPlayed, likedTrackIds, tasteTracks };
}

export function loadFeedContext(uid: string): Promise<FeedContext> {
  const cached = contextCache.get(uid);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = readFeedContext(uid).catch((error) => {
    contextCache.delete(uid);
    throw error;
  });
  contextCache.set(uid, { expiresAt: Date.now() + CACHE_MS, value });
  return value;
}

export function invalidateFeedContext(uid: string): void {
  contextCache.delete(uid);
}
