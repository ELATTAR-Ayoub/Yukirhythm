import { adminDb } from "@/lib/firebase/admin";
import { ingestTrack } from "./ingest";
import { getCatalogProvider } from "./provider";
import type { Track } from "./model";

/** Search/feed results can be transient. Persist only tracks explicitly saved
 * by the user, before a durable like or playlist membership references them. */
export async function ensureTrack(trackId: string): Promise<Track | null> {
  const ref = adminDb().collection("tracks").doc(trackId);
  const stored = await ref.get();
  if (stored.exists) return stored.data() as Track;
  const track = await (await getCatalogProvider()).getTrack(trackId);
  if (!track || !track.isEmbeddable || track.providerTrackId !== trackId)
    return null;
  await ingestTrack(track);
  return (await ref.get()).data() as Track;
}
