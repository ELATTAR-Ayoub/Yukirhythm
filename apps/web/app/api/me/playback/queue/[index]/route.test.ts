import { describe, it, expect, beforeEach, vi } from "vitest";
import type { PlaybackState } from "@/lib/catalog/model";

/**
 * Unit test for the DELETE handler's playhead arithmetic, mocked rather than
 * run against the Firestore emulator (the repo's only other precedent for
 * this route — app/api/me/playback.integration.test.ts — needs a live
 * emulator; this covers the same handler without one). A minimal in-memory
 * fake stands in for the single playback/current document: enough to drive
 * the transaction's get/update, nothing more.
 */

vi.mock("@/lib/firebase/verify", () => ({
  uidFromRequest: vi.fn(async () => "uid-1"),
  unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
}));

let stored: PlaybackState | null = null;

const docRef = {
  collection: () => chain,
  async get() {
    return { exists: stored !== null, data: () => stored };
  },
};
const chain = { collection: () => chain, doc: () => docRef };
const fakeTx = {
  get: async (ref: typeof docRef) => ref.get(),
  update: (_ref: typeof docRef, data: Record<string, unknown>) => {
    stored = { ...(stored as object), ...data } as PlaybackState;
  },
};

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: () => ({
    collection: () => chain,
    runTransaction: async (cb: (tx: typeof fakeTx) => Promise<void>) =>
      cb(fakeTx),
  }),
}));

import { DELETE } from "./route";

const req = () =>
  new Request("http://localhost/api/me/playback/queue/0", { method: "DELETE" });
const paramsFor = (index: string) => ({ params: Promise.resolve({ index }) });

const seed = (queue: string[], queueIndex: number) => {
  stored = { queue, queueIndex } as unknown as PlaybackState;
};

describe("DELETE /api/me/playback/queue/[index]", () => {
  beforeEach(() => {
    process.env.ENABLE_LEGACY_PLAYBACK_SYNC = "true";
    stored = null;
  });

  it("removing an item before the cursor decrements it, keeping the same track playing", async () => {
    seed(["a", "b", "c"], 1); // "b" is playing
    const res = await DELETE(req(), paramsFor("0"));
    const s = (await res.json()) as PlaybackState;
    expect(s.queue).toEqual(["b", "c"]);
    expect(s.queueIndex).toBe(0);
    expect(s.queue[s.queueIndex]).toBe("b");
  });

  it("removing the cursor itself leaves the index addressing the track that followed, not the one before", async () => {
    // The bug: `<=` decremented the cursor even when i === queueIndex, which
    // rewound to the PREVIOUS track instead of advancing to the next one —
    // there is no "currently playing track" left at that position to protect.
    seed(["a", "b", "c"], 1); // "b" is playing
    const res = await DELETE(req(), paramsFor("1"));
    const s = (await res.json()) as PlaybackState;
    expect(s.queue).toEqual(["a", "c"]);
    expect(s.queueIndex).toBe(1);
    expect(s.queue[s.queueIndex]).toBe("c");
  });

  it("removing the last item while it is the cursor clamps the index to -1 instead of pointing past the end", async () => {
    seed(["a"], 0);
    const res = await DELETE(req(), paramsFor("0"));
    const s = (await res.json()) as PlaybackState;
    expect(s.queue).toEqual([]);
    expect(s.queueIndex).toBe(-1);
  });

  it("removing an item when queueIndex is -1 (nothing playing) leaves it at -1", async () => {
    seed(["a", "b"], -1);
    const res = await DELETE(req(), paramsFor("0"));
    const s = (await res.json()) as PlaybackState;
    expect(s.queue).toEqual(["b"]);
    expect(s.queueIndex).toBe(-1);
  });
});
