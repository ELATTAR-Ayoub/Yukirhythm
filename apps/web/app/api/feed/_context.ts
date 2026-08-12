import { adminDb } from "@/lib/firebase/admin";
import type { Collection, Track, TrackState } from "@/lib/catalog/model";
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
  const [tasteSnap, owned, stateSnap] = await Promise.all([
    db.collection("users").doc(uid).collection("views").doc("taste").get(),
    db.collection("collections").where("ownerId", "==", uid).get(),
    db.collection("users").doc(uid).collection("trackState").get(),
  ]);
  type TasteEvent = Omit<StatEvent, "startedAtMs"> &
    Pick<Track, "artists" | "labels"> & {
      startedAt?: number | { toMillis?: () => number };
      startedAtMs?: number;
    };
  const storedEvents = tasteSnap.exists
    ? ((tasteSnap.data()?.events ?? []) as TasteEvent[])
    : [];
  const events: StatEvent[] = storedEvents.map((e) => {
    return {
      ...e,
      startedAtMs: typeof e.startedAtMs === "number"
        ? e.startedAtMs
        : typeof e.startedAt === "number"
          ? e.startedAt
          : (e.startedAt as unknown as { toMillis?: () => number })?.toMillis?.() ?? 0,
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

  const completionCounts = new Map<string, number>();
  for (const event of events) {
    if (event.completed) {
      completionCounts.set(event.trackId, (completionCounts.get(event.trackId) ?? 0) + 1);
    }
  }
  const topPlayed = [...completionCounts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([trackId]) => trackId);

  const tasteTracks = new Map<string, Track>();
  for (const event of storedEvents) {
    // Recommendation profiling reads only artists and labels. Supplying those
    // signals from the bounded view avoids a catalogue document read per song.
    tasteTracks.set(event.trackId, {
      trackId: event.trackId,
      artists: event.artists ?? [],
      labels: event.labels ?? [],
    } as Track);
  }
  const missingLiked = likedTrackIds.filter((id) => !tasteTracks.has(id));
  if (missingLiked.length) {
    const likedDocs = await db.getAll(
      ...missingLiked.map((id) => db.collection("tracks").doc(id))
    );
    likedDocs.forEach((doc) => {
      if (doc.exists) tasteTracks.set(doc.id, doc.data() as Track);
    });
  }

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
