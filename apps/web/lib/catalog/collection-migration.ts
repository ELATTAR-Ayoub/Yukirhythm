import type { Timestamp } from "firebase-admin/firestore";
import type { Collection, Track } from "./model";
import {
  COLLECTION_MAX_BYTES,
  estimatedDocumentBytes,
  membershipFromTrack,
  membershipIsComplete,
} from "./membership";

export type CollectionMigrationResult = {
  collection: Collection;
  changed: boolean;
  unresolvedTrackIds: string[];
  sizeBytes: number;
};

export function migrateCollectionMemberships(
  collection: Collection,
  tracks: ReadonlyMap<string, Track>
): CollectionMigrationResult {
  const unresolvedTrackIds: string[] = [];
  let changed = collection.schemaVersion !== 2;
  const memberships = collection.tracks.map((entry) => {
    if (membershipIsComplete(entry)) return entry;
    const track = tracks.get(entry.trackId);
    if (!track) {
      unresolvedTrackIds.push(entry.trackId);
      return entry;
    }
    changed = true;
    return membershipFromTrack(
      track,
      entry.addedAt as Timestamp,
      entry.addedBy
    );
  });
  const totalDurationSec = memberships.reduce(
    (sum, entry) => sum + (entry.durationSec ?? 0),
    0
  );
  if (totalDurationSec !== collection.stats.totalDurationSec) changed = true;
  const migrated: Collection = {
    ...collection,
    schemaVersion: unresolvedTrackIds.length ? collection.schemaVersion : 2,
    tracks: memberships,
    stats: {
      ...collection.stats,
      trackCount: memberships.length,
      totalDurationSec,
    },
  };
  const sizeBytes = estimatedDocumentBytes(migrated);
  if (sizeBytes > COLLECTION_MAX_BYTES) {
    throw new Error(
      `Collection ${collection.collectionId} would be ${sizeBytes} bytes`
    );
  }
  return { collection: migrated, changed, unresolvedTrackIds, sizeBytes };
}
