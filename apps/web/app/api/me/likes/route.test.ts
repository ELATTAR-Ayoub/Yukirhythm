import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Unit test for the GET handler's missing-index fallback, mocked rather than
 * run against the Firestore emulator — same approach as
 * app/api/me/playback/queue/[index]/route.test.ts. A minimal fake Firestore
 * stands in for users/{uid}/trackState and tracks/, just enough to drive the
 * ordered query, the bare-where fallback query, and the per-track lookup.
 */

vi.mock("@/lib/firebase/verify", () => ({
  uidFromRequest: vi.fn(async () => "uid-1"),
  unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
}));

interface FakeTrackState {
  id: string;
  isLiked: boolean;
  likedAt: number | { toMillis: () => number };
}

let trackStateDocs: FakeTrackState[] = [];
let tracksById: Record<
  string,
  { trackId: string; title: string; durationSec: number }
> = {};
/** Set to make the ORDERED query throw like a missing composite index. */
let orderedError: Error | null = null;

function millisOf(v: FakeTrackState["likedAt"]): number {
  return typeof v === "number" ? v : v.toMillis();
}

function snapshotFrom(docs: FakeTrackState[]) {
  return {
    docs: docs.map((d) => ({
      id: d.id,
      get: (field: string) => (d as unknown as Record<string, unknown>)[field],
      data: () => d,
    })),
  };
}

/** users/{uid}/trackState query root: supports the same `.where(...).get()`
 *  and `.where(...).orderBy(...).get()` shapes the real Firestore Query does. */
function trackStateCollection() {
  return {
    where: (_field: string, _op: string, _value: unknown) => {
      const liked = trackStateDocs.filter((d) => d.isLiked);
      return {
        // The bare single-field query — always succeeds, needs no composite index.
        get: async () => snapshotFrom(liked),
        orderBy: (_field: string, _dir: string) => ({
          get: async () => {
            if (orderedError) throw orderedError;
            const sorted = [...liked].sort(
              (a, b) => millisOf(b.likedAt) - millisOf(a.likedAt)
            );
            return snapshotFrom(sorted);
          },
        }),
      };
    },
  };
}

const fakeDb = {
  getAll: async (...refs: { id: string }[]) =>
    refs.map((ref) => {
      const t = tracksById[ref.id];
      return { exists: Boolean(t), data: () => t };
    }),
  collection: (name: string) => {
    if (name === "users") {
      return {
        doc: (_uid: string) => ({
          collection: (sub: string) => {
            if (sub !== "trackState")
              throw new Error(`unexpected subcollection ${sub}`);
            return trackStateCollection();
          },
        }),
      };
    }
    if (name === "tracks") {
      return {
        doc: (id: string) => ({
          id,
          get: async () => {
            const t = tracksById[id];
            return { exists: Boolean(t), data: () => t };
          },
        }),
      };
    }
    throw new Error(`unexpected collection ${name}`);
  },
};

vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fakeDb }));

import { uidFromRequest } from "@/lib/firebase/verify";
import { GET } from "./route";

const req = () => new Request("http://localhost/api/me/likes");

describe("GET /api/me/likes", () => {
  beforeEach(() => {
    trackStateDocs = [];
    tracksById = {};
    orderedError = null;
    vi.mocked(uidFromRequest).mockResolvedValue("uid-1");
  });

  it("returns liked tracks newest-first on the happy path", async () => {
    trackStateDocs = [
      { id: "t1", isLiked: true, likedAt: 1000 },
      { id: "t2", isLiked: true, likedAt: 3000 },
      { id: "t3", isLiked: false, likedAt: 5000 },
      { id: "t4", isLiked: true, likedAt: 2000 },
    ];
    tracksById = {
      t1: { trackId: "t1", title: "One", durationSec: 100 },
      t2: { trackId: "t2", title: "Two", durationSec: 100 },
      t4: { trackId: "t4", title: "Four", durationSec: 100 },
    };

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { trackIds: string[] };
    expect(body.trackIds).toEqual(["t2", "t4", "t1"]);
  });

  it("falls back to an in-memory sort and still returns 200 when the ordered query throws the missing-index error (code 9)", async () => {
    trackStateDocs = [
      { id: "t1", isLiked: true, likedAt: 1000 },
      { id: "t2", isLiked: true, likedAt: 3000 },
      { id: "t4", isLiked: true, likedAt: 2000 },
    ];
    tracksById = {
      t1: { trackId: "t1", title: "One", durationSec: 100 },
      t2: { trackId: "t2", title: "Two", durationSec: 100 },
      t4: { trackId: "t4", title: "Four", durationSec: 100 },
    };
    const err = new Error(
      "9 FAILED_PRECONDITION: The query requires an index."
    );
    (err as unknown as { code: number }).code = 9;
    orderedError = err;

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { trackIds: string[] };
    expect(body.trackIds).toEqual(["t2", "t4", "t1"]);
  });

  it("also falls back when only the message identifies a missing index (no code field)", async () => {
    trackStateDocs = [
      { id: "t1", isLiked: true, likedAt: { toMillis: () => 1000 } },
      { id: "t2", isLiked: true, likedAt: { toMillis: () => 3000 } },
    ];
    tracksById = {
      t1: { trackId: "t1", title: "One", durationSec: 100 },
      t2: { trackId: "t2", title: "Two", durationSec: 100 },
    };
    orderedError = new Error("This query requires an index that isn't ready.");

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { trackIds: string[] };
    expect(body.trackIds).toEqual(["t2", "t1"]);
  });

  it("does not swallow a non-index error", async () => {
    trackStateDocs = [{ id: "t1", isLiked: true, likedAt: 1000 }];
    const err = new Error(
      "PERMISSION_DENIED: missing or insufficient permissions"
    );
    (err as unknown as { code: number }).code = 7;
    orderedError = err;

    await expect(GET(req())).rejects.toThrow(/PERMISSION_DENIED/);
  });

  it("returns 401 for an anonymous caller", async () => {
    vi.mocked(uidFromRequest).mockResolvedValueOnce(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });
});
