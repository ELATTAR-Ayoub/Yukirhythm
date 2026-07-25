import { adminDb } from "@/lib/firebase/admin";
import type { Collection, PlayEvent, TrackState } from "@/lib/catalog/model";
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
};

export async function loadFeedContext(uid: string): Promise<FeedContext> {
  const db = adminDb();

  const evSnap = await db
    .collection("playEvents")
    .where("userId", "==", uid)
    .get();
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
  const owned = await db
    .collection("collections")
    .where("ownerId", "==", uid)
    .get();
  for (const doc of owned.docs) {
    for (const t of (doc.data() as Collection).tracks ?? [])
      exclude.add(t.trackId);
  }

  // overlay: liked + play counts
  const stateSnap = await db
    .collection("users")
    .doc(uid)
    .collection("trackState")
    .get();
  const states = stateSnap.docs.map((d) => d.data() as TrackState);
  const likedTrackIds = states.filter((s) => s.isLiked).map((s) => s.trackId);
  for (const id of likedTrackIds) exclude.add(id);

  const topPlayed = [...states]
    .sort((a, b) => (b.completedCount ?? 0) - (a.completedCount ?? 0))
    .slice(0, 5)
    .map((s) => s.trackId);

  return { events, exclude, topPlayed, likedTrackIds };
}
