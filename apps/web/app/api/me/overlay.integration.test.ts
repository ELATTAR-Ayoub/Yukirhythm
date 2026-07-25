import { describe, it, expect, beforeEach, beforeAll } from "vitest";

import { adminDb } from "@/lib/firebase/admin";
import { ingestTracks } from "@/lib/catalog/ingest";
import {
  clearFirestore,
  mintIdToken,
} from "@/lib/catalog/__integration__/emulator";
import type { ProviderTrack } from "@/lib/catalog/types";

import { PUT as putTrackState } from "./tracks/[trackId]/route";
import { GET as getLiked } from "./likes/route";
import { PUT as putCollectionState } from "./pins/[collectionId]/route";

function providerTrack(id: string, title: string): ProviderTrack {
  return {
    providerTrackId: id,
    videoId: id,
    type: "track",
    title,
    artists: [{ artistId: "UCx", name: "Artist" }],
    album: null,
    durationSec: 120,
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

beforeAll(async () => {
  token = await mintIdToken(`overlay-${Date.now()}@x.com`);
});

describe("likes overlay + virtual Liked Songs against real Firestore", () => {
  beforeEach(async () => {
    await clearFirestore();
    await ingestTracks([
      providerTrack("t1", "First"),
      providerTrack("t2", "Second"),
    ]);
  });

  it("401 without a token", async () => {
    const res = await putTrackState(auth("", "PUT", { isLiked: true }), {
      params: Promise.resolve({ trackId: "t1" }),
    });
    expect(res.status).toBe(401);
  });

  it("likes a track and lists it in the virtual collection newest-first", async () => {
    await putTrackState(auth(token, "PUT", { isLiked: true }), {
      params: Promise.resolve({ trackId: "t1" }),
    });
    await putTrackState(auth(token, "PUT", { isLiked: true }), {
      params: Promise.resolve({ trackId: "t2" }),
    });

    const liked = (await (await getLiked(auth(token))).json()) as {
      virtual: boolean;
      trackIds: string[];
      stats: { trackCount: number };
    };
    expect(liked.virtual).toBe(true);
    // t2 liked last, so it sorts first
    expect(liked.trackIds).toEqual(["t2", "t1"]);
    expect(liked.stats.trackCount).toBe(2);

    // there is NO stored collections/liked document (D8 — one source of truth)
    const stored = await adminDb().collection("collections").doc("liked").get();
    expect(stored.exists).toBe(false);
  });

  it("unliking removes the track from the virtual collection", async () => {
    await putTrackState(auth(token, "PUT", { isLiked: true }), {
      params: Promise.resolve({ trackId: "t1" }),
    });
    await putTrackState(auth(token, "PUT", { isLiked: false }), {
      params: Promise.resolve({ trackId: "t1" }),
    });

    const liked = (await (await getLiked(auth(token))).json()) as {
      trackIds: string[];
    };
    expect(liked.trackIds).toEqual([]);
  });

  it("stores a resume position on the overlay", async () => {
    const res = await putTrackState(auth(token, "PUT", { resumeSec: 42 }), {
      params: Promise.resolve({ trackId: "t1" }),
    });
    const state = (await res.json()) as { resumeSec: number; trackId: string };
    expect(state.resumeSec).toBe(42);
    expect(state.trackId).toBe("t1");
  });
});

describe("pin overlay against real Firestore", () => {
  beforeEach(() => clearFirestore());

  it("persists a pin and reads it back", async () => {
    const res = await putCollectionState(
      auth(token, "PUT", { isPinned: true }),
      {
        params: Promise.resolve({ collectionId: "c1" }),
      }
    );
    const state = (await res.json()) as {
      isPinned: boolean;
      collectionId: string;
    };
    expect(state.isPinned).toBe(true);
    expect(state.collectionId).toBe("c1");
  });
});
