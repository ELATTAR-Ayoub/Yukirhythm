import { describe, expect, it } from "vitest";
import type { Timestamp } from "firebase-admin/firestore";
import type { Collection, Track } from "./model";
import { migrateCollectionMemberships } from "./collection-migration";
import { membershipIsComplete } from "./membership";

const ts = { toMillis: () => 1 } as Timestamp;
const track = (id: string, durationSec: number): Track => ({
  trackId: id,
  type: "track",
  title: `Track ${id}`,
  artists: [{ artistId: `artist-${id}`, name: "Artist" }],
  album: null,
  durationSec,
  artwork: [],
  texture: "tx-k-silk",
  source: {
    provider: "youtube",
    videoId: id,
    url: `https://youtube.com/watch?v=${id}`,
    aliasVideoIds: [],
  },
  isEmbeddable: true,
  isLive: false,
  isFamilySafe: true,
  stats: { viewCount: 0, likeCount: 0, playCount: 0 },
  publishedAt: null,
  labels: [],
  labelIds: [],
  keywords: [],
  enrichedAt: null,
  schemaVersion: 1,
});
const collection: Collection = {
  collectionId: "playlist-1",
  ownerId: "user-1",
  role: "playlist",
  contentType: "music",
  title: "Playlist",
  description: "",
  tags: [],
  cover: "texture",
  texture: "tx-k-silk",
  imageUrl: null,
  tracks: [
    { trackId: "a", addedAt: ts, addedBy: "user-1" },
    { trackId: "b", addedAt: ts, addedBy: "user-1" },
  ],
  visibility: "private",
  stats: { trackCount: 2, totalDurationSec: 0, saveCount: 0, playCount: 0 },
  createdAt: ts,
  updatedAt: ts,
};

describe("collection membership migration", () => {
  it("preserves order and timestamps while completing metadata", () => {
    const result = migrateCollectionMemberships(
      collection,
      new Map([
        ["a", track("a", 100)],
        ["b", track("b", 200)],
      ])
    );
    expect(result.collection.tracks.map((entry) => entry.trackId)).toEqual([
      "a",
      "b",
    ]);
    expect(result.collection.tracks.every(membershipIsComplete)).toBe(true);
    expect(result.collection.tracks[0].addedAt).toBe(ts);
    expect(result.collection.stats.totalDurationSec).toBe(300);
    expect(result.collection.schemaVersion).toBe(2);
    expect(result.unresolvedTrackIds).toEqual([]);
  });

  it("does not mark a playlist migrated when a track is unresolved", () => {
    const result = migrateCollectionMemberships(
      collection,
      new Map([["a", track("a", 100)]])
    );
    expect(result.unresolvedTrackIds).toEqual(["b"]);
    expect(result.collection.schemaVersion).not.toBe(2);
  });
});
