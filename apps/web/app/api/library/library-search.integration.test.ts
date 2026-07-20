import { describe, it, expect, beforeEach, beforeAll } from "vitest";

import { ingestTracks } from "@/lib/catalog/ingest";
import {
  clearFirestore,
  mintIdToken,
} from "@/lib/catalog/__integration__/emulator";
import type { ProviderTrack } from "@/lib/catalog/types";
import type { Collection, Track } from "@/lib/catalog/model";

import { POST as createUser } from "../me/route";
import { POST as createCollection } from "../collections/route";
import { PUT as putTrackState } from "../me/track-state/[trackId]/route";
import { GET as librarySearch } from "./search/route";

function providerTrack(id: string, title: string, artist: string): ProviderTrack {
  return {
    providerTrackId: id,
    videoId: id,
    type: "track",
    title,
    artists: [{ artistId: "UCx", name: artist }],
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

const auth = (token: string, path: string, method = "GET", body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });

let owner: string;
let other: string;

beforeAll(async () => {
  owner = await mintIdToken(`libowner-${Date.now()}@x.com`);
  other = await mintIdToken(`libother-${Date.now()}@x.com`);
});

describe("GET /api/library/search against real Firestore", () => {
  beforeEach(async () => {
    await clearFirestore();
    await ingestTracks([
      providerTrack("t1", "Midnight Snowfall", "Aoi Waves"),
      providerTrack("t2", "Cobalt Dreams", "Mint Circuit"),
    ]);
    await createUser(auth(owner, "/api/me", "POST", {}));
    await createUser(auth(other, "/api/me", "POST", {}));
  });

  it("401 without a token", async () => {
    expect((await librarySearch(auth("", "/api/library/search?q=x"))).status).toBe(401);
  });

  it("finds the caller's own collection by title", async () => {
    await createCollection(
      auth(owner, "/api/collections", "POST", { title: "Rainy Tapes", tags: ["rain"] })
    );
    const res = await librarySearch(auth(owner, "/api/library/search?q=rainy"));
    const body = (await res.json()) as { collections: Collection[] };
    expect(body.collections.map((c) => c.title)).toEqual(["Rainy Tapes"]);
  });

  it("finds a collection by tag, case-insensitively", async () => {
    await createCollection(
      auth(owner, "/api/collections", "POST", { title: "Untitled", tags: ["Focus"] })
    );
    const res = await librarySearch(auth(owner, "/api/library/search?q=FOCUS"));
    const body = (await res.json()) as { collections: Collection[] };
    expect(body.collections).toHaveLength(1);
  });

  it("finds liked tracks by title and by artist", async () => {
    await putTrackState(auth(owner, "/x", "PUT", { isLiked: true }), {
      params: Promise.resolve({ trackId: "t1" }),
    });

    const byTitle = (await (
      await librarySearch(auth(owner, "/api/library/search?q=snowfall"))
    ).json()) as { tracks: Track[] };
    expect(byTitle.tracks.map((t) => t.trackId)).toEqual(["t1"]);

    const byArtist = (await (
      await librarySearch(auth(owner, "/api/library/search?q=aoi"))
    ).json()) as { tracks: Track[] };
    expect(byArtist.tracks.map((t) => t.trackId)).toEqual(["t1"]);
  });

  it("never returns another user's private collection", async () => {
    await createCollection(
      auth(other, "/api/collections", "POST", { title: "Rainy Secrets", tags: ["rain"] })
    );
    const res = await librarySearch(auth(owner, "/api/library/search?q=rainy"));
    const body = (await res.json()) as { collections: Collection[] };
    expect(body.collections).toHaveLength(0);
  });
});
