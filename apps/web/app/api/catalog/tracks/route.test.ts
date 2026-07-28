import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/verify", () => ({
  uidFromRequest: vi.fn(async () => "uid-1"),
  unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
}));

let tracksById: Record<string, { trackId: string; title: string }> = {};
let requestedBatches: string[][] = [];

const fakeDb = {
  collection: (name: string) => {
    if (name !== "tracks") throw new Error(`unexpected collection ${name}`);
    return {
      doc: (id: string) => ({ id }),
    };
  },
  getAll: async (...refs: { id: string }[]) => {
    requestedBatches.push(refs.map((ref) => ref.id));
    return refs.map((ref) => {
      const track = tracksById[ref.id];
      return {
        exists: Boolean(track),
        data: () => track,
      };
    });
  },
};

vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fakeDb }));

import { uidFromRequest } from "@/lib/firebase/verify";
import { GET } from "./route";

describe("GET /api/catalog/tracks?ids", () => {
  beforeEach(() => {
    tracksById = {};
    requestedBatches = [];
    vi.mocked(uidFromRequest).mockResolvedValue("uid-1");
  });

  it("returns canonical track documents in membership order", async () => {
    tracksById = {
      t1: { trackId: "t1", title: "One" },
      t2: { trackId: "t2", title: "Two" },
    };

    const response = await GET(
      new Request("http://localhost/api/catalog/tracks?ids=t2%2Ct1")
    );
    const body = (await response.json()) as {
      tracks: { trackId: string }[];
      missingTrackIds: string[];
    };

    expect(response.status).toBe(200);
    expect(body.tracks.map((track) => track.trackId)).toEqual(["t2", "t1"]);
    expect(body.missingTrackIds).toEqual([]);
    expect(requestedBatches).toEqual([["t2", "t1"]]);
  });

  it("deduplicates ids and reports orphaned memberships", async () => {
    tracksById = {
      present: { trackId: "present", title: "Present" },
    };

    const response = await GET(
      new Request(
        "http://localhost/api/catalog/tracks?ids=present%2Cmissing%2Cpresent"
      )
    );
    const body = (await response.json()) as {
      tracks: { trackId: string }[];
      missingTrackIds: string[];
    };

    expect(body.tracks.map((track) => track.trackId)).toEqual(["present"]);
    expect(body.missingTrackIds).toEqual(["missing"]);
    expect(requestedBatches).toEqual([["present", "missing"]]);
  });

  it("rejects oversized batches", async () => {
    const ids = Array.from({ length: 101 }, (_, index) => `t${index}`).join(
      ","
    );
    const response = await GET(
      new Request(
        `http://localhost/api/catalog/tracks?ids=${encodeURIComponent(ids)}`
      )
    );

    expect(response.status).toBe(400);
    expect(requestedBatches).toEqual([]);
  });

  it("requires authentication", async () => {
    vi.mocked(uidFromRequest).mockResolvedValueOnce(null);
    const response = await GET(
      new Request("http://localhost/api/catalog/tracks?ids=t1")
    );

    expect(response.status).toBe(401);
  });
});
