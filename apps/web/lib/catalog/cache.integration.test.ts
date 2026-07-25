import { describe, it, expect, beforeEach } from "vitest";

import { adminDb } from "@/lib/firebase/admin";
import { cacheKey, readCache, writeCache } from "./cache";
import { clearFirestore } from "./__integration__/emulator";

describe("cacheKey", () => {
  it("normalises case and whitespace so equivalent queries share an entry", () => {
    expect(cacheKey("  Daft   PUNK ", "song")).toBe(
      cacheKey("daft punk", "song")
    );
  });

  it("separates entries by search type", () => {
    expect(cacheKey("daft punk", "song")).not.toBe(
      cacheKey("daft punk", "artist")
    );
  });

  it("produces a firestore-safe document id", () => {
    expect(cacheKey("a/b/c", "song")).not.toContain("/");
  });
});

describe("readCache / writeCache against real Firestore", () => {
  beforeEach(() => clearFirestore());

  it("returns null on a miss", async () => {
    expect(await readCache("missing")).toBeNull();
  });

  it("round-trips a payload through Firestore", async () => {
    await writeCache("k1", { tracks: [{ trackId: "t1" }] });
    expect(await readCache("k1")).toEqual({ tracks: [{ trackId: "t1" }] });
  });

  it("treats an entry older than the ttl as a miss", async () => {
    // Write a stale record directly so the ttl branch is exercised for real.
    await adminDb()
      .collection("searchCache")
      .doc("old")
      .set({
        payload: { tracks: [] },
        cachedAtMs: Date.now() - 25 * 60 * 60 * 1000,
      });
    expect(await readCache("old")).toBeNull();
  });
});
