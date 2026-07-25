import { describe, it, expect, beforeEach, beforeAll } from "vitest";

import { adminDb } from "@/lib/firebase/admin";
import { ingestTracks } from "@/lib/catalog/ingest";
import {
  clearFirestore,
  mintIdToken,
} from "@/lib/catalog/__integration__/emulator";
import type { ProviderTrack } from "@/lib/catalog/types";
import type { StatsRollup } from "@/lib/catalog/model";

import { POST as ensureUser } from "./route";
import { POST as postEvents } from "../events/route";
import { GET as getStats } from "./stats/route";
import { GET as getRecents } from "./recents/route";

function providerTrack(id: string, durationSec: number): ProviderTrack {
  return {
    providerTrackId: id,
    videoId: id,
    type: "track",
    title: `Track ${id}`,
    artists: [{ artistId: `UC${id}`, name: `Artist ${id}` }],
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

const auth = (token: string, path = "/x", method = "GET", body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });

let token: string;
const DAY = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  token = await mintIdToken(`stats-${Date.now()}@x.com`);
});

describe("GET /api/me/stats against real Firestore", () => {
  beforeEach(async () => {
    await clearFirestore();
    await ingestTracks([providerTrack("t1", 200), providerTrack("t2", 200)]);
    await ensureUser(auth(token, "/api/me", "POST", {}));
  });

  it("401 without a token", async () => {
    expect((await getStats(auth(""))).status).toBe(401);
  });

  it("computes minutes, top artist, and hour buckets from real events", async () => {
    const now = Date.now();
    await postEvents(
      auth(token, "/api/events", "POST", {
        events: [
          {
            trackId: "t1",
            listenedSec: 180,
            startedAt: now,
            clientHourOfDay: 9,
          },
          {
            trackId: "t1",
            listenedSec: 120,
            startedAt: now,
            clientHourOfDay: 9,
          },
          {
            trackId: "t2",
            listenedSec: 60,
            startedAt: now,
            clientHourOfDay: 22,
          },
        ],
      })
    );
    const s = (await (await getStats(auth(token))).json()) as StatsRollup;
    expect(s.minutesAllTime).toBe(6); // (180+120+60)/60
    expect(s.topArtists[0].artistId).toBe("UCt1");
    expect(s.topArtists[0].plays).toBe(2);
    expect(s.topTrackIds[0]).toBe("t1");
    expect(s.byHour[9]).toBe(1);
    expect(s.byHour[22]).toBe(0.5);
  });

  it("drops an 8-day-old play from minutesWeek", async () => {
    const now = Date.now();
    await postEvents(
      auth(token, "/api/events", "POST", {
        events: [
          { trackId: "t1", listenedSec: 600, startedAt: now },
          { trackId: "t1", listenedSec: 600, startedAt: now - 8 * DAY },
        ],
      })
    );
    const s = (await (await getStats(auth(token))).json()) as StatsRollup;
    expect(s.minutesWeek).toBe(10);
    expect(s.minutesMonth).toBe(20);
  });

  it("produces a genre split from a labelled track", async () => {
    await adminDb()
      .collection("tracks")
      .doc("t1")
      .set({ labelIds: ["lofi"] }, { merge: true });
    await postEvents(
      auth(token, "/api/events", "POST", {
        events: [{ trackId: "t1", listenedSec: 300, startedAt: Date.now() }],
      })
    );
    const s = (await (await getStats(auth(token))).json()) as StatsRollup;
    expect(s.genreSplit).toEqual([{ label: "lofi", pct: 100 }]);
  });
});

describe("GET /api/me/recents against real Firestore", () => {
  beforeEach(async () => {
    await clearFirestore();
    await ingestTracks([providerTrack("t1", 200)]);
    await ensureUser(auth(token, "/api/me", "POST", {}));
    // a collection so provenance resolves
    await adminDb().collection("collections").doc("c1").set({
      collectionId: "c1",
      ownerId: "someone",
      title: "Night Drive",
    });
  });

  it("returns newest-first with collection provenance", async () => {
    const now = Date.now();
    await postEvents(
      auth(token, "/api/events", "POST", {
        events: [
          {
            trackId: "t1",
            listenedSec: 100,
            startedAt: now - 2000,
            collectionId: "c1",
          },
          { trackId: "t1", listenedSec: 100, startedAt: now },
        ],
      })
    );
    const body = (await (
      await getRecents(auth(token, "/api/me/recents"))
    ).json()) as {
      items: {
        startedAtMs: number;
        collection: { title: string } | null;
        track: { title: string } | null;
      }[];
    };
    expect(body.items).toHaveLength(2);
    expect(body.items[0].startedAtMs).toBeGreaterThan(
      body.items[1].startedAtMs
    ); // newest first
    expect(body.items[0].track?.title).toBe("Track t1");
    expect(body.items[1].collection?.title).toBe("Night Drive");
  });

  it("paginates via the cursor without overlap", async () => {
    const now = Date.now();
    await postEvents(
      auth(token, "/api/events", "POST", {
        events: [0, 1, 2].map((i) => ({
          trackId: "t1",
          listenedSec: 60,
          startedAt: now - i * 1000,
        })),
      })
    );
    const page1 = (await (
      await getRecents(auth(token, "/api/me/recents?limit=2"))
    ).json()) as {
      items: { eventId: string }[];
      nextCursor: number | null;
    };
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).toBeGreaterThan(0);

    const page2 = (await (
      await getRecents(
        auth(token, `/api/me/recents?limit=2&cursor=${page1.nextCursor}`)
      )
    ).json()) as {
      items: { eventId: string }[];
    };
    expect(page2.items).toHaveLength(1);
    const ids1 = new Set(page1.items.map((i) => i.eventId));
    expect(ids1.has(page2.items[0].eventId)).toBe(false); // no overlap
  });
});
