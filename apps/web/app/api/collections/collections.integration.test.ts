import { describe, it, expect, beforeEach, beforeAll } from "vitest";

import { adminDb } from "@/lib/firebase/admin";
import { ingestTracks } from "@/lib/catalog/ingest";
import {
  clearFirestore,
  mintIdToken,
} from "@/lib/catalog/__integration__/emulator";
import type { Collection, User } from "@/lib/catalog/model";
import type { ProviderTrack } from "@/lib/catalog/types";

import { POST as createUser } from "../me/route";
import { GET as listCollections, POST as createCollection } from "./route";
import {
  GET as getCollection,
  PATCH as patchCollection,
  DELETE as deleteCollection,
} from "./[collectionId]/route";
import {
  PUT as addTrack,
  DELETE as removeTrack,
} from "./[collectionId]/tracks/[trackId]/route";
import { PATCH as reorder } from "./[collectionId]/tracks/route";

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

const j = (body: unknown, token: string, method = "POST") =>
  new Request("http://localhost/api/collections", {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

const auth = (token: string, method = "GET") =>
  new Request("http://localhost/x", {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });

let token: string;
let otherToken: string;

beforeAll(async () => {
  token = await mintIdToken(`owner-${Date.now()}@x.com`);
  otherToken = await mintIdToken(`other-${Date.now()}@x.com`);
});

async function freshUsers(): Promise<void> {
  await createUser(
    new Request("http://localhost/api/me", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: "{}",
    })
  );
}

describe("collections against real Firestore", () => {
  beforeEach(async () => {
    await clearFirestore();
    await ingestTracks([
      providerTrack("t1", 100),
      providerTrack("t2", 200),
      providerTrack("t3", 50),
    ]);
    await freshUsers();
  });

  it("401 without a token", async () => {
    expect((await createCollection(j({ title: "x" }, "", "POST"))).status).toBe(
      401
    );
  });

  it("creates a playlist with the seven fields and computed stats", async () => {
    const res = await createCollection(
      j(
        {
          title: "Night Drive",
          description: "neon",
          tags: ["night", "synth"],
          contentType: "music",
          cover: "mosaic",
          trackIds: ["t1", "t2"],
        },
        token,
        "POST"
      )
    );
    expect(res.status).toBe(201);
    const c = (await res.json()) as Collection;

    expect(c.role).toBe("playlist");
    expect(c.contentType).toBe("music");
    expect(c.tags).toEqual(["night", "synth"]);
    expect(c.tracks.map((t) => t.trackId)).toEqual(["t1", "t2"]);
    expect(c.stats.trackCount).toBe(2);
    expect(c.stats.totalDurationSec).toBe(300); // 100 + 200, from real track docs
    expect(c.visibility).toBe("private");

    // owner's collectionCount bumped, read back from real Firestore
    const user = (
      await adminDb().collection("users").doc(c.ownerId).get()
    ).data() as User;
    expect(user.counts.collectionCount).toBe(1);
  });

  it("lists only the caller's collections", async () => {
    await createCollection(j({ title: "Mine" }, token, "POST"));
    const res = await listCollections(auth(token));
    const list = (await res.json()) as Collection[];
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Mine");
  });

  it("hides a private collection from other users but allows the owner", async () => {
    const created = (await (
      await createCollection(j({ title: "Secret" }, token, "POST"))
    ).json()) as Collection;
    const params = {
      params: Promise.resolve({ collectionId: created.collectionId }),
    };

    expect((await getCollection(auth(token), params)).status).toBe(200);
    expect((await getCollection(auth(otherToken), params)).status).toBe(403);
  });

  it("keeps collectionCount consistent across create then delete", async () => {
    const created = (await (
      await createCollection(j({ title: "Temp" }, token, "POST"))
    ).json()) as Collection;
    const params = {
      params: Promise.resolve({ collectionId: created.collectionId }),
    };

    await deleteCollection(auth(token, "DELETE"), params);

    const user = (
      await adminDb().collection("users").doc(created.ownerId).get()
    ).data() as User;
    expect(user.counts.collectionCount).toBe(0);
    expect((await getCollection(auth(token), params)).status).toBe(404);
  });

  it("refuses to delete the virtual Liked Songs id", async () => {
    const res = await deleteCollection(auth(token, "DELETE"), {
      params: Promise.resolve({ collectionId: "liked" }),
    });
    expect(res.status).toBe(409);
  });

  it("renames only for the owner", async () => {
    const created = (await (
      await createCollection(j({ title: "Old" }, token, "POST"))
    ).json()) as Collection;
    const params = {
      params: Promise.resolve({ collectionId: created.collectionId }),
    };

    const forbidden = await patchCollection(
      j({ title: "Hacked" }, otherToken, "PATCH"),
      params
    );
    expect(forbidden.status).toBe(403);

    await patchCollection(j({ title: "New" }, token, "PATCH"), params);
    const c = (await (
      await getCollection(auth(token), params)
    ).json()) as Collection;
    expect(c.title).toBe("New");
  });
});

describe("membership against real Firestore", () => {
  let collectionId: string;

  beforeEach(async () => {
    await clearFirestore();
    await ingestTracks([
      providerTrack("t1", 100),
      providerTrack("t2", 200),
      providerTrack("t3", 50),
    ]);
    await freshUsers();
    const created = (await (
      await createCollection(j({ title: "P", trackIds: ["t1"] }, token, "POST"))
    ).json()) as Collection;
    collectionId = created.collectionId;
  });

  const trackParams = (trackId: string) => ({
    params: Promise.resolve({ collectionId, trackId }),
  });

  it("adds a track and updates stats transactionally", async () => {
    await addTrack(auth(token, "PUT"), trackParams("t2"));
    const c = (
      await adminDb().collection("collections").doc(collectionId).get()
    ).data() as Collection;
    expect(c.tracks.map((t) => t.trackId)).toEqual(["t1", "t2"]);
    expect(c.stats.trackCount).toBe(2);
    expect(c.stats.totalDurationSec).toBe(300);
  });

  it("does not add the same track twice", async () => {
    await addTrack(auth(token, "PUT"), trackParams("t1"));
    const c = (
      await adminDb().collection("collections").doc(collectionId).get()
    ).data() as Collection;
    expect(c.tracks).toHaveLength(1);
  });

  it("stays consistent under concurrent adds", async () => {
    await Promise.all([
      addTrack(auth(token, "PUT"), trackParams("t2")),
      addTrack(auth(token, "PUT"), trackParams("t3")),
    ]);
    const c = (
      await adminDb().collection("collections").doc(collectionId).get()
    ).data() as Collection;
    expect(c.stats.trackCount).toBe(c.tracks.length);
    expect(c.tracks.length).toBe(3);
  });

  it("removes a track and decrements stats", async () => {
    await addTrack(auth(token, "PUT"), trackParams("t2"));
    await removeTrack(auth(token, "DELETE"), trackParams("t1"));
    const c = (
      await adminDb().collection("collections").doc(collectionId).get()
    ).data() as Collection;
    expect(c.tracks.map((t) => t.trackId)).toEqual(["t2"]);
    expect(c.stats.trackCount).toBe(1);
    expect(c.stats.totalDurationSec).toBe(200);
  });

  it("403 when a non-owner mutates membership", async () => {
    const res = await addTrack(auth(otherToken, "PUT"), trackParams("t2"));
    expect(res.status).toBe(403);
  });

  it("reorders a real permutation, preserving addedAt", async () => {
    await addTrack(auth(token, "PUT"), trackParams("t2"));
    const before = (
      await adminDb().collection("collections").doc(collectionId).get()
    ).data() as Collection;
    const t1AddedAt = before.tracks.find((t) => t.trackId === "t1")!.addedAt;

    const res = await reorder(j({ trackIds: ["t2", "t1"] }, token, "PATCH"), {
      params: Promise.resolve({ collectionId }),
    });
    expect(res.status).toBe(200);

    const after = (
      await adminDb().collection("collections").doc(collectionId).get()
    ).data() as Collection;
    expect(after.tracks.map((t) => t.trackId)).toEqual(["t2", "t1"]);
    expect(after.tracks.find((t) => t.trackId === "t1")!.addedAt).toEqual(
      t1AddedAt
    );
  });

  it("rejects a reorder that is not a permutation", async () => {
    const res = await reorder(
      j({ trackIds: ["t1", "does-not-exist"] }, token, "PATCH"),
      { params: Promise.resolve({ collectionId }) }
    );
    expect(res.status).toBe(400);
  });
});
