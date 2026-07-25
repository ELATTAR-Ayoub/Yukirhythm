import { describe, it, expect, beforeEach, beforeAll } from "vitest";

import { adminDb } from "@/lib/firebase/admin";
import {
  clearFirestore,
  mintIdToken,
} from "@/lib/catalog/__integration__/emulator";
import type { Collection, PublicProfile, User } from "@/lib/catalog/model";

import { POST as ensureUser, PATCH as patchUser } from "../me/route";
import { POST as createCollection } from "../collections/route";
import { GET as listCollections } from "../collections/route";
import { PATCH as patchCollection } from "../collections/[collectionId]/route";
import {
  PUT as save,
  DELETE as unsave,
} from "../collections/[collectionId]/save/route";
import { GET as publicCollections } from "../collections/public/route";
import { PUT as follow, DELETE as unfollow } from "./[uid]/follow/route";
import { GET as followers } from "./[uid]/followers/route";
import { GET as getProfile } from "./[uid]/route";

// two real users
let tokenA: string;
let tokenB: string;
let uidA: string;
let uidB: string;

const auth = (token: string, path = "/x", method = "GET", body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });

async function uidOf(token: string): Promise<string> {
  // ensure-user returns the doc with userId = token uid
  const res = await ensureUser(auth(token, "/api/me", "POST", {}));
  return ((await res.json()) as User).userId;
}

beforeAll(async () => {
  tokenA = await mintIdToken(`social-a-${Date.now()}@x.com`);
  tokenB = await mintIdToken(`social-b-${Date.now()}@x.com`);
});

describe("follow graph against real Firestore", () => {
  beforeEach(async () => {
    await clearFirestore();
    uidA = await uidOf(tokenA);
    uidB = await uidOf(tokenB);
  });

  it("writes both edges and both counts, idempotently", async () => {
    await follow(auth(tokenA, "/x", "PUT"), {
      params: Promise.resolve({ uid: uidB }),
    });
    await follow(auth(tokenA, "/x", "PUT"), {
      params: Promise.resolve({ uid: uidB }),
    }); // no-op

    const a = (
      await adminDb().collection("users").doc(uidA).get()
    ).data() as User;
    const b = (
      await adminDb().collection("users").doc(uidB).get()
    ).data() as User;
    expect(a.counts.followingCount).toBe(1);
    expect(b.counts.followerCount).toBe(1);

    const edge = await adminDb()
      .collection("users")
      .doc(uidB)
      .collection("followers")
      .doc(uidA)
      .get();
    expect(edge.exists).toBe(true);
  });

  it("rejects following yourself", async () => {
    const res = await follow(auth(tokenA, "/x", "PUT"), {
      params: Promise.resolve({ uid: uidA }),
    });
    expect(res.status).toBe(400);
  });

  it("unfollow removes both edges and decrements", async () => {
    await follow(auth(tokenA, "/x", "PUT"), {
      params: Promise.resolve({ uid: uidB }),
    });
    await unfollow(auth(tokenA, "/x", "DELETE"), {
      params: Promise.resolve({ uid: uidB }),
    });
    const b = (
      await adminDb().collection("users").doc(uidB).get()
    ).data() as User;
    expect(b.counts.followerCount).toBe(0);
    const edge = await adminDb()
      .collection("users")
      .doc(uidB)
      .collection("followers")
      .doc(uidA)
      .get();
    expect(edge.exists).toBe(false);
  });

  it("lists followers", async () => {
    await follow(auth(tokenA, "/x", "PUT"), {
      params: Promise.resolve({ uid: uidB }),
    });
    const list = (await (
      await followers(auth(tokenB), { params: Promise.resolve({ uid: uidB }) })
    ).json()) as {
      items: { userId: string }[];
    };
    expect(list.items.map((i) => i.userId)).toContain(uidA);
  });
});

describe("public profile against real Firestore", () => {
  beforeEach(async () => {
    await clearFirestore();
    uidA = await uidOf(tokenA);
    uidB = await uidOf(tokenB);
  });

  it("404s a private profile even to an authenticated caller", async () => {
    const res = await getProfile(auth(tokenA), {
      params: Promise.resolve({ uid: uidB }),
    });
    expect(res.status).toBe(404);
  });

  it("returns a projection without private fields once public", async () => {
    await patchUser(
      auth(tokenB, "/api/me", "PATCH", { privacy: { publicProfile: true } })
    );
    const res = await getProfile(auth(tokenA), {
      params: Promise.resolve({ uid: uidB }),
    });
    expect(res.status).toBe(200);
    const p = (await res.json()) as PublicProfile & {
      email?: string;
      privacy?: unknown;
    };
    expect(p.userId).toBe(uidB);
    expect(p.email).toBeUndefined();
    expect(p.privacy).toBeUndefined();
  });
});

describe("saved collections against real Firestore", () => {
  let publicId: string;

  beforeEach(async () => {
    await clearFirestore();
    uidA = await uidOf(tokenA);
    uidB = await uidOf(tokenB);
    // B publishes a public playlist
    const c = (await (
      await createCollection(
        auth(tokenB, "/api/collections", "POST", { title: "B's Mix" })
      )
    ).json()) as Collection;
    publicId = c.collectionId;
    await patchCollection(
      auth(tokenB, "/x", "PATCH", { visibility: "public" }),
      {
        params: Promise.resolve({ collectionId: publicId }),
      }
    );
  });

  it("A saves B's public collection; saveCount rises and it joins A's library", async () => {
    await save(auth(tokenA, "/x", "PUT"), {
      params: Promise.resolve({ collectionId: publicId }),
    });

    const c = (
      await adminDb().collection("collections").doc(publicId).get()
    ).data() as Collection;
    expect(c.stats.saveCount).toBe(1);

    const lib = (await (
      await listCollections(auth(tokenA))
    ).json()) as Collection[];
    expect(lib.map((x) => x.collectionId)).toContain(publicId);
  });

  it("cannot save your own collection", async () => {
    const res = await save(auth(tokenB, "/x", "PUT"), {
      params: Promise.resolve({ collectionId: publicId }),
    });
    expect(res.status).toBe(400);
  });

  it("cannot save a private collection", async () => {
    await patchCollection(
      auth(tokenB, "/x", "PATCH", { visibility: "private" }),
      {
        params: Promise.resolve({ collectionId: publicId }),
      }
    );
    const res = await save(auth(tokenA, "/x", "PUT"), {
      params: Promise.resolve({ collectionId: publicId }),
    });
    expect(res.status).toBe(403);
  });

  it("a collection turned private drops from the library but the record survives and returns", async () => {
    await save(auth(tokenA, "/x", "PUT"), {
      params: Promise.resolve({ collectionId: publicId }),
    });

    // owner turns it private
    await patchCollection(
      auth(tokenB, "/x", "PATCH", { visibility: "private" }),
      {
        params: Promise.resolve({ collectionId: publicId }),
      }
    );
    let lib = (await (
      await listCollections(auth(tokenA))
    ).json()) as Collection[];
    expect(lib.map((x) => x.collectionId)).not.toContain(publicId);
    // the saved record is retained
    const rec = await adminDb()
      .collection("users")
      .doc(uidA)
      .collection("savedCollections")
      .doc(publicId)
      .get();
    expect(rec.exists).toBe(true);

    // republished -> reappears
    await patchCollection(
      auth(tokenB, "/x", "PATCH", { visibility: "public" }),
      {
        params: Promise.resolve({ collectionId: publicId }),
      }
    );
    lib = (await (await listCollections(auth(tokenA))).json()) as Collection[];
    expect(lib.map((x) => x.collectionId)).toContain(publicId);
  });

  it("unsave decrements saveCount", async () => {
    await save(auth(tokenA, "/x", "PUT"), {
      params: Promise.resolve({ collectionId: publicId }),
    });
    await unsave(auth(tokenA, "/x", "DELETE"), {
      params: Promise.resolve({ collectionId: publicId }),
    });
    const c = (
      await adminDb().collection("collections").doc(publicId).get()
    ).data() as Collection;
    expect(c.stats.saveCount).toBe(0);
  });

  it("lists another user's public collections, hiding private ones", async () => {
    await createCollection(
      auth(tokenB, "/api/collections", "POST", { title: "Secret" })
    ); // stays private
    const list = (await (
      await publicCollections(
        auth(tokenA, `/api/collections/public?ownerId=${uidB}`)
      )
    ).json()) as Collection[];
    expect(list.map((c) => c.title)).toContain("B's Mix");
    expect(list.map((c) => c.title)).not.toContain("Secret");
  });
});
