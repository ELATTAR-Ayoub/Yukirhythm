import { describe, it, expect, beforeEach, beforeAll } from "vitest";

import {
  clearFirestore,
  mintIdToken,
} from "@/lib/catalog/__integration__/emulator";
import type { PlaybackState } from "@/lib/catalog/model";

import { GET, PUT } from "./playback/route";
import { POST as enqueue } from "./playback/queue/route";
import { DELETE as removeAt } from "./playback/queue/[index]/route";

const auth = (token: string, method = "GET", body?: unknown) =>
  new Request("http://localhost/x", {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });

let token: string;

beforeAll(async () => {
  token = await mintIdToken(`play-${Date.now()}@x.com`);
});

describe("playback state against real Firestore", () => {
  beforeEach(() => clearFirestore());

  it("401 without a token", async () => {
    expect((await GET(auth(""))).status).toBe(401);
    expect((await PUT(auth("", "PUT", {}))).status).toBe(401);
  });

  it("returns an empty default before anything is stored", async () => {
    const s = (await (await GET(auth(token))).json()) as PlaybackState;
    expect(s.queue).toEqual([]);
    expect(s.queueIndex).toBe(-1);
    expect(s.repeatMode).toBe("off");
    expect(s.volume).toBe(1);
  });

  it("persists queue, cursor, and modes, then reads them back", async () => {
    await PUT(
      auth(token, "PUT", {
        trackId: "t2",
        queue: ["t1", "t2", "t3"],
        queueIndex: 1,
        shuffleMode: true,
        repeatMode: "all",
        deviceId: "phone",
      })
    );
    const s = (await (await GET(auth(token))).json()) as PlaybackState;
    expect(s.queue).toEqual(["t1", "t2", "t3"]);
    expect(s.queueIndex).toBe(1);
    expect(s.shuffleMode).toBe(true);
    expect(s.repeatMode).toBe("all");
    expect(s.trackId).toBe("t2");
  });

  it("clamps volume into [0,1] and floors a negative position to 0", async () => {
    const over = (await (await PUT(auth(token, "PUT", { volume: 1.5 }))).json()) as PlaybackState;
    expect(over.volume).toBe(1);
    const under = (await (await PUT(auth(token, "PUT", { volume: -1, positionSec: -5 }))).json()) as PlaybackState;
    expect(under.volume).toBe(0);
    expect(under.positionSec).toBe(0);
  });

  it("rejects a bogus repeat mode, keeping the previous value", async () => {
    await PUT(auth(token, "PUT", { repeatMode: "one" }));
    const s = (await (await PUT(auth(token, "PUT", { repeatMode: "sideways" }))).json()) as PlaybackState;
    expect(s.repeatMode).toBe("one");
  });

  it("merges a partial PUT without wiping unset fields", async () => {
    await PUT(auth(token, "PUT", { queue: ["a", "b"], volume: 0.4 }));
    const s = (await (await PUT(auth(token, "PUT", { positionSec: 30 }))).json()) as PlaybackState;
    expect(s.queue).toEqual(["a", "b"]);
    expect(s.volume).toBe(0.4);
    expect(s.positionSec).toBe(30);
  });
});

describe("queue mutations against real Firestore", () => {
  beforeEach(async () => {
    await clearFirestore();
    await PUT(
      auth(token, "PUT", { queue: ["t1", "t2", "t3"], queueIndex: 1 })
    );
  });

  it("play-next pushes onto the manual queue", async () => {
    const s = (await (await enqueue(auth(token, "POST", { trackId: "x", mode: "next" }))).json()) as PlaybackState;
    expect(s.manualQueue).toEqual(["x"]);
    expect(s.queue).toEqual(["t1", "t2", "t3"]);
  });

  it("enqueue-end appends to the main queue", async () => {
    const s = (await (await enqueue(auth(token, "POST", { trackId: "x", mode: "end" }))).json()) as PlaybackState;
    expect(s.queue).toEqual(["t1", "t2", "t3", "x"]);
  });

  it("400 when enqueue is missing a trackId", async () => {
    expect((await enqueue(auth(token, "POST", { mode: "end" }))).status).toBe(400);
  });

  it("removing an item before the cursor keeps the current track", async () => {
    // cursor at 1 (t2); remove index 0 (t1) -> cursor should drop to 0, still t2
    const s = (await (await removeAt(auth(token, "DELETE"), { params: Promise.resolve({ index: "0" }) })).json()) as PlaybackState;
    expect(s.queue).toEqual(["t2", "t3"]);
    expect(s.queueIndex).toBe(0);
    expect(s.queue[s.queueIndex]).toBe("t2");
  });

  it("removing an item after the cursor leaves the cursor put", async () => {
    const s = (await (await removeAt(auth(token, "DELETE"), { params: Promise.resolve({ index: "2" }) })).json()) as PlaybackState;
    expect(s.queue).toEqual(["t1", "t2"]);
    expect(s.queueIndex).toBe(1);
  });

  it("400 on an out-of-range index", async () => {
    expect((await removeAt(auth(token, "DELETE"), { params: Promise.resolve({ index: "9" }) })).status).toBe(400);
  });
});
