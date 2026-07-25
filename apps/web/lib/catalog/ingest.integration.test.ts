import { describe, it, expect, beforeEach } from "vitest";

import { adminDb } from "@/lib/firebase/admin";
import { ingestTrack, toTrackDoc } from "./ingest";
import { clearFirestore } from "./__integration__/emulator";
import type { ProviderTrack } from "./types";
import type { Track } from "./model";

/**
 * Real Firestore (the emulator engine), no mocks. Every assertion is a genuine
 * write and read-back through the Admin SDK.
 */

const sample: ProviderTrack = {
  providerTrackId: "song1",
  videoId: "vid1",
  type: "track",
  title: "Instant Crush",
  artists: [{ artistId: "UCchannel1", name: "Daft Punk" }],
  album: { albumId: "alb1", name: "Random Access Memories" },
  durationSec: 338,
  artwork: [{ url: "https://x/1.jpg", width: 120, height: 120 }],
  isEmbeddable: true,
  isLive: false,
  isFamilySafe: true,
  viewCount: 10,
  likeCount: 2,
  publishedAt: "2013-12-06T08:00:01Z",
  keywords: ["daft punk", "instant crush"],
  categoryName: "Music",
};

async function readTrack(id: string): Promise<Track | undefined> {
  const snap = await adminDb().collection("tracks").doc(id).get();
  return snap.exists ? (snap.data() as Track) : undefined;
}

describe("toTrackDoc", () => {
  it("uses the provider track id and a deterministic texture", () => {
    const d = toTrackDoc(sample);
    expect(d.trackId).toBe("song1");
    expect(d.source.videoId).toBe("vid1");
    expect(d.source.url).toContain("vid1");
    expect(d.texture).toBeTruthy();
    expect(d.keywords).toEqual(["daft punk", "instant crush"]);
    expect(d.labels).toEqual([]);
    expect(d.labelIds).toEqual([]);
  });
});

describe("ingestTrack against real Firestore", () => {
  beforeEach(() => clearFirestore());

  it("writes the track and its artist, and reads them back", async () => {
    await ingestTrack(sample);

    const track = await readTrack("song1");
    expect(track?.title).toBe("Instant Crush");
    expect(track?.durationSec).toBe(338);
    expect(track?.publishedAt).not.toBeNull();

    const artist = await adminDb()
      .collection("artists")
      .doc("UCchannel1")
      .get();
    expect(artist.exists).toBe(true);
    expect((artist.data() as { name: string }).name).toBe("Daft Punk");
  });

  it("is idempotent — ingesting twice yields one document", async () => {
    await ingestTrack(sample);
    await ingestTrack(sample);

    const all = await adminDb().collection("tracks").get();
    expect(all.size).toBe(1);
  });

  it("collapses aliases — a second video for the same song is recorded, not duplicated", async () => {
    await ingestTrack(sample);
    await ingestTrack({ ...sample, videoId: "vid2" });

    const track = await readTrack("song1");
    expect(track?.source.videoId).toBe("vid1");
    expect(track?.source.aliasVideoIds).toContain("vid2");

    const all = await adminDb().collection("tracks").get();
    expect(all.size).toBe(1);
  });

  it("never overwrites a user-sourced label on re-ingest", async () => {
    await ingestTrack(sample);
    await adminDb()
      .collection("tracks")
      .doc("song1")
      .set(
        {
          labels: [
            { label: "lofi", kind: "genre", source: "user", confidence: 1 },
          ],
        },
        { merge: true }
      );

    await ingestTrack(sample);

    const track = await readTrack("song1");
    expect(track?.labels).toHaveLength(1);
    expect(track?.labels[0].source).toBe("user");
  });

  it("preserves the global play count across re-ingest", async () => {
    await ingestTrack(sample);
    await adminDb()
      .collection("tracks")
      .doc("song1")
      .set(
        { stats: { viewCount: 10, likeCount: 2, playCount: 99 } },
        { merge: true }
      );

    // force the stale-refresh path
    await adminDb()
      .collection("tracks")
      .doc("song1")
      .set(
        { enrichedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) },
        { merge: true }
      );
    await ingestTrack({ ...sample, viewCount: 20 });

    const track = await readTrack("song1");
    expect(track?.stats.playCount).toBe(99);
    expect(track?.stats.viewCount).toBe(20);
  });
});
