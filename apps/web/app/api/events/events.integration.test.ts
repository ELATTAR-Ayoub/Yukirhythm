import { describe, it, expect, beforeEach, beforeAll } from "vitest";

import { adminDb } from "@/lib/firebase/admin";
import { ingestTracks } from "@/lib/catalog/ingest";
import {
  clearFirestore,
  mintIdToken,
} from "@/lib/catalog/__integration__/emulator";
import type { PlayEvent, TrackState } from "@/lib/catalog/model";
import type { ProviderTrack } from "@/lib/catalog/types";

import { POST as ensureUser, PATCH as patchUser } from "../me/route";
import { PUT as likeTrack } from "../me/tracks/[trackId]/route";
import { POST as postEvents } from "./route";
import { DELETE as clearHistory } from "../me/history/route";

function providerTrack(id: string, durationSec: number): ProviderTrack {
  return {
    providerTrackId: id,
    videoId: id,
    type: "track",
    title: `Track ${id}`,
    artists: [{ artistId: "UCx", name: "Artist" }],
    album: null,
    durationSec,
    artwork: [],
    isEmbeddable: true,
    isLive: false,
    isFamilySafe: true,
    viewCount: 0,
    likeCount: 0,
    publishedAt: null,
    keywords: [],
    categoryName: null,
  };
}

const auth = (token: string, method = "GET", body?: unknown) =>
  new Request("http://localhost/x", {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });

let token: string;

async function trackState(
  uid: string,
  trackId: string
): Promise<TrackState | undefined> {
  const snap = await adminDb()
    .collection("users")
    .doc(uid)
    .collection("trackState")
    .doc(trackId)
    .get();
  return snap.exists ? (snap.data() as TrackState) : undefined;
}

async function currentUid(): Promise<string> {
  const users = await adminDb().collection("users").get();
  return users.docs[0].id;
}

beforeAll(async () => {
  token = await mintIdToken(`events-${Date.now()}@x.com`);
});

describe("POST /api/events against real Firestore", () => {
  beforeEach(async () => {
    await clearFirestore();
    await ingestTracks([
      providerTrack("t1", 200), // threshold 30s
      providerTrack("t2", 40), // threshold 20s
    ]);
    await ensureUser(auth(token, "POST", {}));
  });

  it("401 without a token", async () => {
    expect((await postEvents(auth("", "POST", { events: [] }))).status).toBe(
      401
    );
  });

  it("writes events and rolls counters, scoring completion correctly", async () => {
    const uid = await currentUid();
    await postEvents(
      auth(token, "POST", {
        events: [
          {
            trackId: "t1",
            listenedSec: 120,
            source: "collection",
            clientHourOfDay: 9,
          }, // completed
          { trackId: "t1", listenedSec: 5, source: "search" }, // skipped
          { trackId: "t2", listenedSec: 25 }, // completed (>= 20)
        ],
      })
    );

    const events = await adminDb()
      .collection("playEvents")
      .where("userId", "==", uid)
      .get();
    expect(events.size).toBe(3);

    const s1 = await trackState(uid, "t1");
    expect(s1?.playCount).toBe(2);
    expect(s1?.completedCount).toBe(1);
    expect(s1?.skipCount).toBe(1);
    expect(s1?.totalListenedSec).toBe(125);

    const s2 = await trackState(uid, "t2");
    expect(s2?.completedCount).toBe(1);
    expect(s2?.skipCount).toBe(0);
  });

  it("captures provenance and clientHourOfDay on the event", async () => {
    const uid = await currentUid();
    await postEvents(
      auth(token, "POST", {
        events: [
          {
            trackId: "t1",
            listenedSec: 60,
            collectionId: "c9",
            clientHourOfDay: 23,
            source: "recommendation",
            recommendationId: "rec1",
          },
        ],
      })
    );
    const doc = (
      await adminDb().collection("playEvents").where("userId", "==", uid).get()
    ).docs[0].data() as PlayEvent;
    expect(doc.collectionId).toBe("c9");
    expect(doc.clientHourOfDay).toBe(23);
    expect(doc.source).toBe("recommendation");
    expect(doc.recommendationId).toBe("rec1");
  });

  it("skips malformed events without failing the batch", async () => {
    const uid = await currentUid();
    const res = await postEvents(
      auth(token, "POST", {
        events: [
          { trackId: "t1", listenedSec: 60 },
          { listenedSec: 60 }, // no trackId
          { trackId: "t2", listenedSec: -3 }, // bad duration
        ],
      })
    );
    expect(((await res.json()) as { written: number }).written).toBe(1);
    const events = await adminDb()
      .collection("playEvents")
      .where("userId", "==", uid)
      .get();
    expect(events.size).toBe(1);
  });

  it("writes nothing when saveHistory is off, but still 200s", async () => {
    await patchUser(auth(token, "PATCH", { privacy: { saveHistory: false } }));
    const uid = await currentUid();
    const res = await postEvents(
      auth(token, "POST", { events: [{ trackId: "t1", listenedSec: 60 }] })
    );
    expect(res.status).toBe(200);
    // gate reports it did nothing, and nothing reached the store
    expect(((await res.json()) as { skipped?: string }).skipped).toBe(
      "saveHistory off"
    );
    const events = await adminDb()
      .collection("playEvents")
      .where("userId", "==", uid)
      .get();
    expect(events.size).toBe(0);
  });
});

describe("DELETE /api/me/history against real Firestore", () => {
  beforeEach(async () => {
    await clearFirestore();
    await ingestTracks([providerTrack("t1", 200)]);
    await ensureUser(auth(token, "POST", {}));
  });

  it("clears events and counters but keeps likes", async () => {
    const uid = await currentUid();
    await likeTrack(auth(token, "PUT", { isLiked: true }), {
      params: Promise.resolve({ trackId: "t1" }),
    });
    await postEvents(
      auth(token, "POST", { events: [{ trackId: "t1", listenedSec: 120 }] })
    );

    await clearHistory(auth(token, "DELETE"));

    const events = await adminDb()
      .collection("playEvents")
      .where("userId", "==", uid)
      .get();
    expect(events.size).toBe(0);

    const s = await trackState(uid, "t1");
    expect(s?.playCount).toBe(0);
    expect(s?.totalListenedSec).toBe(0);
    // like survives — clearing history is not unliking
    expect(s?.isLiked).toBe(true);
  });
});
