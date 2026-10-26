import { describe, it, expect, beforeEach, beforeAll } from "vitest";

import { adminDb } from "@/lib/firebase/admin";
import { withEventIds } from "@/lib/catalog/__integration__/event-body";
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
import { readFeedSnapshot, writeFeedSnapshot } from "../feed/_snapshot";

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
    body: body ? JSON.stringify(withEventIds(body)) : undefined,
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

  it("stores sampled and near-complete states without counting samples as skips", async () => {
    const uid = await currentUid();
    await postEvents(
      auth(token, "POST", {
        events: [
          { eventId: "sample_event_123", trackId: "t1", listenedSec: 30 },
          { eventId: "near_event_12345", trackId: "t1", listenedSec: 160 },
        ],
      })
    );
    const docs = await adminDb()
      .collection("playEvents")
      .where("userId", "==", uid)
      .get();
    const engagements = docs.docs.map(
      (doc) => (doc.data() as PlayEvent).engagement
    );
    expect(engagements).toContain("sampled");
    expect(engagements).toContain("near-complete");
    const state = await trackState(uid, "t1");
    expect(state?.playCount).toBe(2);
    expect(state?.completedCount).toBe(1);
    expect(state?.skipCount).toBe(0);
  });

  it("deduplicates a retried client event without incrementing counters twice", async () => {
    const uid = await currentUid();
    const event = {
      eventId: "listen_session_123",
      trackId: "t1",
      listenedSec: 60,
    };
    const first = await postEvents(auth(token, "POST", { events: [event] }));
    const retry = await postEvents(auth(token, "POST", { events: [event] }));
    expect(((await first.json()) as { written: number }).written).toBe(1);
    expect(((await retry.json()) as { written: number }).written).toBe(0);
    expect((await trackState(uid, "t1"))?.playCount).toBe(1);
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

describe("adversarial event and cache consistency", () => {
  beforeEach(async () => {
    await clearFirestore();
    await ingestTracks([providerTrack("t1", 200), providerTrack("t2", 200)]);
    await ensureUser(auth(token, "POST", {}));
  });
  const event = (over: Record<string, unknown> = {}) => ({
    eventId: "shared-listen-123",
    trackId: "t1",
    durationSec: 200,
    listenedSec: 120,
    startedAt: Date.now() - 1000,
    ...over,
  });

  it("isolates identical event IDs belonging to different users", async () => {
    const other = await mintIdToken(`isolation-${Date.now()}@example.com`);
    await ensureUser(auth(other, "POST", {}));
    await postEvents(auth(token, "POST", { events: [event()] }));
    await postEvents(
      auth(other, "POST", { events: [event({ trackId: "t2" })] })
    );
    const docs = await adminDb().collection("playEvents").get();
    expect(docs.size).toBe(2);
    expect(new Set(docs.docs.map((d) => d.data().userId)).size).toBe(2);
  });

  it("does not let a retry overwrite an accepted listen", async () => {
    await postEvents(auth(token, "POST", { events: [event()] }));
    await postEvents(
      auth(token, "POST", {
        events: [event({ trackId: "t2", listenedSec: 5 })],
      })
    );
    const docs = await adminDb().collection("playEvents").get();
    expect(docs.size).toBe(1);
    expect(docs.docs[0].data().trackId).toBe("t1");
    expect((await trackState(await currentUid(), "t1"))?.playCount).toBe(1);
  });

  it("merges simultaneous tab uploads without losing either taste event", async () => {
    await Promise.all([
      postEvents(auth(token, "POST", { events: [event()], tasteSnapshot: [] })),
      postEvents(
        auth(token, "POST", {
          events: [event({ eventId: "second-listen-123", trackId: "t2" })],
          tasteSnapshot: [],
        })
      ),
    ]);
    const taste = await adminDb()
      .collection("users")
      .doc(await currentUid())
      .collection("views")
      .doc("taste")
      .get();
    expect(taste.data()?.events).toHaveLength(2);
    expect((await adminDb().collection("playEvents").get()).size).toBe(2);
  });

  it("ignores malformed elements and invalid IDs without a 500", async () => {
    const result = await postEvents(
      auth(token, "POST", {
        events: [
          null,
          "bad",
          [],
          event({ eventId: "../escape" }),
          event({ trackId: "a/b" }),
        ],
      })
    );
    expect(result.status).toBe(200);
    expect((await result.json()).written).toBe(0);
  });

  it("does not resurrect cleared history when a delayed upload arrives", async () => {
    const old = event({ startedAt: Date.now() - 60000 });
    await postEvents(auth(token, "POST", { events: [old] }));
    await clearHistory(auth(token, "DELETE"));
    const retry = await postEvents(
      auth(token, "POST", { events: [{ ...old, eventId: "late-listen-123" }] })
    );
    expect((await retry.json()).written).toBe(0);
    expect((await adminDb().collection("playEvents").get()).size).toBe(0);
    expect(
      (
        await adminDb()
          .collection("users")
          .doc(await currentUid())
          .collection("views")
          .doc("taste")
          .get()
      ).exists
    ).toBe(false);
  });

  it("rejects a stale feed generation after preferences change", async () => {
    const uid = await currentUid();
    await patchUser(
      auth(token, "PATCH", { privacy: { personalization: false } })
    );
    await writeFeedSnapshot(
      uid,
      "you-might-like",
      { personalized: true, items: [{ trackId: "t1" }] },
      0
    );
    expect(await readFeedSnapshot(uid, "you-might-like", false)).toBeNull();
  });
});
