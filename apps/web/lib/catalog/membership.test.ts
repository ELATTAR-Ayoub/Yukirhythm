import { describe, expect, it } from "vitest";
import type { Timestamp } from "firebase-admin/firestore";
import type { Track } from "./model";
import {
  COLLECTION_MAX_BYTES,
  estimatedDocumentBytes,
  membershipFromTrack,
  membershipIsComplete,
  trackFromMembership,
} from "./membership";

const timestamp = { toMillis: () => 1 } as Timestamp;
const track: Track = {
  trackId: "song-1",
  type: "track",
  title: "Song",
  artists: [{ artistId: "artist-1", name: "Artist" }],
  album: { albumId: "album-1", name: "Album" },
  durationSec: 201,
  artwork: [{ url: "https://img/1.jpg", width: 640, height: 640 }],
  texture: "tx-k-silk",
  source: {
    provider: "youtube",
    videoId: "song-1",
    url: "https://youtube.com/watch?v=song-1",
    aliasVideoIds: [],
  },
  isEmbeddable: true,
  isLive: false,
  isFamilySafe: true,
  stats: { viewCount: 10, likeCount: 2, playCount: 0 },
  publishedAt: null,
  labels: [],
  labelIds: [],
  keywords: [],
  enrichedAt: null,
  schemaVersion: 1,
};

describe("complete collection memberships", () => {
  it("round-trips every stable render and playback field", () => {
    const membership = membershipFromTrack(track, timestamp, "user-1");
    expect(membershipIsComplete(membership)).toBe(true);
    expect(trackFromMembership(membership)).toMatchObject({
      trackId: "song-1",
      title: "Song",
      artists: track.artists,
      durationSec: 201,
      artwork: track.artwork,
      texture: "tx-k-silk",
      source: track.source,
    });
  });

  it("keeps a realistic 170-track playlist below the safety ceiling", () => {
    const memberships = Array.from({ length: 170 }, (_, index) =>
      membershipFromTrack(
        {
          ...track,
          trackId: `song-${index}`,
          title: `Song ${index} ${"x".repeat(80)}`,
          source: { ...track.source, videoId: `song-${index}` },
        },
        timestamp,
        "user-1"
      )
    );
    expect(estimatedDocumentBytes({ tracks: memberships })).toBeLessThan(
      COLLECTION_MAX_BYTES
    );
  });
});
