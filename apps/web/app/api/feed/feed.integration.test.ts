import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";

import { adminDb } from "@/lib/firebase/admin";
import { ingestTracks } from "@/lib/catalog/ingest";
import { setCatalogProvider } from "@/lib/catalog/provider";
import {
  clearFirestore,
  mintIdToken,
} from "@/lib/catalog/__integration__/emulator";
import type { CatalogProvider } from "@/lib/catalog/provider";
import type { ProviderTrack } from "@/lib/catalog/types";
import type { Collection } from "@/lib/catalog/model";

import { POST as ensureUser } from "../me/route";
import { POST as postEvents } from "../events/route";
import { PUT as likeTrack } from "../me/tracks/[trackId]/route";
import { GET as jumpBackIn } from "./jump-back-in/route";
import { GET as youMightLike } from "./you-might-like/route";
import { GET as newReleases } from "./new-releases/route";

function pt(id: string, over: Partial<ProviderTrack> = {}): ProviderTrack {
  return {
    providerTrackId: id,
    videoId: id,
    type: "track",
    title: `Track ${id}`,
    artists: [{ artistId: `a-${id}`, name: `Artist ${id}` }],
    album: null,
    durationSec: 200,
    artwork: [],
    isEmbeddable: true,
    isLive: false,
    isFamilySafe: true,
    viewCount: 1000,
    likeCount: 0,
    publishedAt: null,
    keywords: [],
    categoryName: null,
    ...over,
  };
}

// Deterministic provider: radio for "seed" returns rel1, rel2.
const stub: CatalogProvider = {
  async search() {
    return { query: "", type: "song", tracks: [], artists: [], playlists: [] };
  },
  async suggest() {
    return [];
  },
  async getTrack() {
    return null;
  },
  async getTracks() {
    return [];
  },
  async getArtist() {
    return null;
  },
  async getRelatedTracks(seed) {
    if (seed === "seed") return [pt("rel1"), pt("rel2")];
    return [];
  },
  async getPlaylist() {
    return null;
  },
};

const auth = (token: string, path = "/x") =>
  new Request(`http://localhost${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
const post = (token: string, path: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

let token: string;
let uid: string;

beforeAll(async () => {
  setCatalogProvider(stub);
  token = await mintIdToken(`feed-${Date.now()}@x.com`);
});
afterAll(() => setCatalogProvider(null));

async function currentUid(): Promise<string> {
  return (await adminDb().collection("users").get()).docs[0].id;
}

describe("feeds against real Firestore", () => {
  beforeEach(async () => {
    await clearFirestore();
    await ingestTracks([pt("seed"), pt("rel1"), pt("rel2"), pt("pop", { viewCount: 999999 })]);
    await ensureUser(post(token, "/api/me", {}));
    uid = await currentUid();
  });

  it("401 without a token", async () => {
    expect((await jumpBackIn(auth(""))).status).toBe(401);
    expect((await youMightLike(auth(""))).status).toBe(401);
    expect((await newReleases(auth(""))).status).toBe(401);
  });

  it("jump-back-in returns recently played collections, newest first", async () => {
    await adminDb().collection("collections").doc("c1").set({ collectionId: "c1", ownerId: uid, title: "One", tracks: [] });
    await adminDb().collection("collections").doc("c2").set({ collectionId: "c2", ownerId: uid, title: "Two", tracks: [] });
    const now = Date.now();
    await postEvents(
      post(token, "/api/events", {
        events: [
          { trackId: "seed", listenedSec: 120, collectionId: "c1", startedAt: now - 5000 },
          { trackId: "seed", listenedSec: 120, collectionId: "c2", startedAt: now },
        ],
      })
    );
    const body = (await (await jumpBackIn(auth(token))).json()) as { collections: Collection[] };
    expect(body.collections.map((c) => c.collectionId)).toEqual(["c2", "c1"]);
  });

  it("you-might-like blends provider radio off the user's most-played, with reasons", async () => {
    // play the seed enough to make it the top track
    await postEvents(
      post(token, "/api/events", {
        events: [{ trackId: "seed", listenedSec: 120, startedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 }],
      })
    );
    const body = (await (await youMightLike(auth(token))).json()) as {
      items: { trackId: string; reason: string; recommendationId: string }[];
    };
    const ids = body.items.map((i) => i.trackId);
    expect(ids).toContain("rel1");
    expect(ids).toContain("rel2");
    expect(ids).not.toContain("seed"); // the seed itself is excluded
    expect(body.items[0].reason).toContain("Because you played");
    expect(body.items[0].recommendationId).toMatch(/^yml:/);
  });

  it("you-might-like cold-starts from a popular seed when there is no history", async () => {
    // no events at all; stub radio only fires for "seed", and "pop" is the cold seed
    // which returns nothing from the stub, so items may be empty — the point is it 200s.
    const res = await youMightLike(auth(token));
    expect(res.status).toBe(200);
  });

  it("new-releases falls back to popular catalogue tracks for a cold user", async () => {
    const body = (await (await newReleases(auth(token))).json()) as {
      items: { trackId: string; recommendationId: string }[];
    };
    // "pop" has the highest viewCount and is not excluded
    expect(body.items.map((i) => i.trackId)).toContain("pop");
    expect(body.items[0].recommendationId).toMatch(/^nr:/);
  });

  it("new-releases surfaces related tracks for a warm listener", async () => {
    // play the seed enough to make it the top track, same pattern as the
    // you-might-like warm test above
    await postEvents(
      post(token, "/api/events", {
        events: [{ trackId: "seed", listenedSec: 120, startedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 }],
      })
    );
    // fresh1/fresh2 are NOT pre-ingested by beforeEach, so they can only reach
    // the response via the live personalized loop's own ingestTracks — unlike
    // rel1/rel2, the popular fallback can't accidentally surface them.
    setCatalogProvider({
      ...stub,
      async getRelatedTracks(seed) {
        return seed === "seed" ? [pt("fresh1"), pt("fresh2")] : [];
      },
    });
    try {
      const res = await newReleases(auth(token, "/api/feed/new-releases"));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: { trackId: string }[] };
      const ids = body.items.map((i) => i.trackId);
      expect(ids).toContain("fresh1");
      expect(ids).toContain("fresh2");
    } finally {
      setCatalogProvider(stub);
    }
  });

  it("excludes tracks already in the user's library", async () => {
    // put rel1 into an owned collection so it is excluded from recommendations
    await adminDb()
      .collection("collections")
      .doc("mine")
      .set({ collectionId: "mine", ownerId: uid, title: "Mine", tracks: [{ trackId: "rel1", addedAt: new Date(), addedBy: uid }] });
    await likeTrack(post(token, "/x", { isLiked: true }), { params: Promise.resolve({ trackId: "seed" }) });
    await postEvents(post(token, "/api/events", { events: [{ trackId: "seed", listenedSec: 120, startedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 }] }));

    const body = (await (await youMightLike(auth(token))).json()) as { items: { trackId: string }[] };
    expect(body.items.map((i) => i.trackId)).not.toContain("rel1"); // in library
    expect(body.items.map((i) => i.trackId)).toContain("rel2");
  });
});

describe("new-releases cold start on an empty catalogue", () => {
  beforeEach(async () => {
    await clearFirestore();
    await ensureUser(post(token, "/api/me", {}));
  });

  it("answers from the provider when the catalogue is empty", async () => {
    setCatalogProvider({
      ...stub,
      async search(query) {
        return {
          query,
          type: "song",
          tracks: [pt("cold1"), pt("cold2")],
          artists: [],
          playlists: [],
        };
      },
    });
    try {
      const res = await newReleases(auth(token, "/api/feed/new-releases"));
      expect(res.status).toBe(200);
      const body = await res.json();
      const ids = body.items.map((i: { trackId: string }) => i.trackId);
      expect(ids).toContain("cold1");
      expect(ids).toContain("cold2");
    } finally {
      setCatalogProvider(stub);
    }
  });

  it("still answers 200 with an empty list when the provider fails too", async () => {
    setCatalogProvider({
      ...stub,
      async search(): Promise<never> {
        throw new Error("scraper down");
      },
    });
    try {
      const res = await newReleases(auth(token, "/api/feed/new-releases"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.items)).toBe(true);
    } finally {
      setCatalogProvider(stub);
    }
  });
});

describe("you-might-like cold start on an empty catalogue", () => {
  beforeEach(async () => {
    await clearFirestore();
    await ensureUser(post(token, "/api/me", {}));
  });

  it("answers from the provider when the catalogue is empty", async () => {
    setCatalogProvider({
      ...stub,
      async search(query) {
        return {
          query,
          type: "song",
          tracks: [pt("cold1"), pt("cold2")],
          artists: [],
          playlists: [],
        };
      },
    });
    try {
      const res = await youMightLike(auth(token, "/api/feed/you-might-like"));
      expect(res.status).toBe(200);
      const body = await res.json();
      const ids = body.items.map((i: { trackId: string }) => i.trackId);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids).toContain("cold1");
      // every item resolves to a real track doc for the UI
      expect(body.items.every((i: { track: unknown }) => i.track)).toBe(true);
    } finally {
      setCatalogProvider(stub);
    }
  });

  it("still answers 200 with an empty list when the provider fails too", async () => {
    setCatalogProvider({
      ...stub,
      async search(): Promise<never> {
        throw new Error("scraper down");
      },
    });
    try {
      const res = await youMightLike(auth(token, "/api/feed/you-might-like"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.items)).toBe(true);
    } finally {
      setCatalogProvider(stub);
    }
  });
});
