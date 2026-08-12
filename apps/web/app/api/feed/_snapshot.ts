import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

export type MaterializedFeed = {
  personalized: boolean;
  items: unknown[];
};

function ref(uid: string, feed: string) {
  return adminDb().collection("users").doc(uid).collection("feeds").doc(feed);
}

/** One document read on a cache-miss device; no recommendation fan-out. */
export async function readFeedSnapshot(
  uid: string,
  feed: string,
  refresh: boolean
): Promise<MaterializedFeed | null> {
  if (refresh) return null;
  const snap = await ref(uid, feed).get();
  if (!snap.exists) return null;
  const data = snap.data() as Partial<MaterializedFeed>;
  return typeof data.personalized === "boolean" && Array.isArray(data.items)
    ? { personalized: data.personalized, items: data.items }
    : null;
}

/** The generated result is durable across devices. Browser localStorage is an
 * extra front cache, never the sole copy of this user-owned feed. */
export async function writeFeedSnapshot(
  uid: string,
  feed: string,
  value: MaterializedFeed
): Promise<void> {
  await ref(uid, feed).set({
    ...value,
    generatedAt: Timestamp.now(),
    schemaVersion: 1,
  });
}
