import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/verify", () => ({
  uidFromRequest: vi.fn(async () => "uid-1"),
  unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
}));

type Stored = Record<string, unknown>;
const documents = new Map<string, Stored>();
let generatedId = 0;

function snapshot(path: string) {
  const value = documents.get(path);
  return {
    exists: Boolean(value),
    data: () => value,
    get: (field: string) => value?.[field],
  };
}

class FakeDocumentReference {
  constructor(readonly path: string) {}

  get id() {
    return this.path.slice(this.path.lastIndexOf("/") + 1);
  }

  collection(name: string) {
    return new FakeCollectionReference(`${this.path}/${name}`);
  }

  async get() {
    return snapshot(this.path);
  }
}

class FakeCollectionReference {
  constructor(readonly path: string) {}

  doc(id?: string) {
    const resolved = id ?? `opaque-share-${++generatedId}`;
    return new FakeDocumentReference(`${this.path}/${resolved}`);
  }

  where(field: string, _op: string, expected: unknown) {
    return {
      get: async () => {
        const prefix = `${this.path}/`;
        const docs = [...documents.entries()]
          .filter(
            ([path, value]) =>
              path.startsWith(prefix) &&
              !path.slice(prefix.length).includes("/") &&
              value[field] === expected
          )
          .map(([path, value]) => ({
            id: path.slice(prefix.length),
            data: () => value,
            get: (name: string) => value[name],
          }));
        return { docs };
      },
    };
  }
}

const fakeDb = {
  collection: (name: string) => new FakeCollectionReference(name),
  runTransaction: async (
    callback: (tx: {
      get: (ref: FakeDocumentReference) => Promise<ReturnType<typeof snapshot>>;
      set: (
        ref: FakeDocumentReference,
        value: Stored,
        options?: { merge?: boolean }
      ) => void;
    }) => Promise<void>
  ) => {
    const tx = {
      get: (ref: FakeDocumentReference) => ref.get(),
      set: (
        ref: FakeDocumentReference,
        value: Stored,
        options?: { merge?: boolean }
      ) => {
        documents.set(
          ref.path,
          options?.merge
            ? { ...(documents.get(ref.path) ?? {}), ...value }
            : value
        );
      },
    };
    await callback(tx);
  },
};

vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fakeDb }));

import { uidFromRequest } from "@/lib/firebase/verify";
import { POST } from "./route";

function request(collectionId: string) {
  return new Request("http://localhost/api/shares/playlists", {
    method: "POST",
    body: JSON.stringify({ collectionId }),
  });
}

describe("POST /api/shares/playlists", () => {
  beforeEach(() => {
    documents.clear();
    generatedId = 0;
    vi.mocked(uidFromRequest).mockResolvedValue("uid-1");
    documents.set("users/uid-1", {
      displayName: "Yuki",
    });
  });

  it("publishes only a snapshot and keeps a stable opaque URL", async () => {
    documents.set("collections/playlist-1", {
      collectionId: "playlist-1",
      ownerId: "uid-1",
      title: "Night Drive",
      description: "After-hours tracks",
      cover: "mosaic",
      texture: "tx-k-marble",
      imageUrl: null,
      visibility: "private",
      tracks: [{ trackId: "track-1" }, { trackId: "track-2" }],
    });

    const first = await POST(request("playlist-1"));
    const firstBody = (await first.json()) as {
      shareId: string;
      path: string;
    };
    const second = await POST(request("playlist-1"));
    const secondBody = (await second.json()) as {
      shareId: string;
      path: string;
    };

    expect(first.status).toBe(200);
    expect(firstBody.shareId).toBe("opaque-share-1");
    expect(secondBody).toEqual(firstBody);
    expect(firstBody.path).toBe("/share/playlist/opaque-share-1");
    expect(documents.get("sharedPlaylists/opaque-share-1")).toMatchObject({
      title: "Night Drive",
      ownerId: "uid-1",
      trackIds: ["track-1", "track-2"],
      sourceType: "collection",
    });
    expect(documents.get("collections/playlist-1")?.visibility).toBe("private");
  });

  it("publishes Liked Songs at the top with newest likes first", async () => {
    documents.set("users/uid-1/trackState/old", {
      isLiked: true,
      likedAt: 100,
    });
    documents.set("users/uid-1/trackState/new", {
      isLiked: true,
      likedAt: 300,
    });
    documents.set("users/uid-1/trackState/not-liked", {
      isLiked: false,
      likedAt: 500,
    });

    const response = await POST(request("liked"));
    const body = (await response.json()) as { shareId: string };
    expect(response.status).toBe(200);
    expect(documents.get(`sharedPlaylists/${body.shareId}`)).toMatchObject({
      title: "Liked Songs",
      ownerName: "Yuki",
      sourceType: "liked",
      trackIds: ["new", "old"],
    });
  });

  it("does not let a user snapshot somebody else's private playlist", async () => {
    documents.set("collections/private", {
      collectionId: "private",
      ownerId: "uid-2",
      visibility: "private",
    });
    const response = await POST(request("private"));
    expect(response.status).toBe(403);
    expect([...documents.keys()]).not.toContain(
      "sharedPlaylists/opaque-share-1"
    );
  });

  it("requires authentication", async () => {
    vi.mocked(uidFromRequest).mockResolvedValueOnce(null);
    const response = await POST(request("liked"));
    expect(response.status).toBe(401);
  });
});
