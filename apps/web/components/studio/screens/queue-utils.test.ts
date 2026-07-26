import { describe, it, expect } from "vitest";

import {
  insertIntoQueue,
  isSameContext,
  removeQueueIndex,
  restoreOrder,
  shuffleOrder,
} from "./queue-utils";
import {
  MOCK_COLLECTIONS,
  MOCK_TRACKS,
  type MockCollection,
} from "./mock-data";

describe("insertIntoQueue", () => {
  it("appends to the end regardless of currentIndex", () => {
    const q = insertIntoQueue([MOCK_TRACKS[0]], MOCK_TRACKS[1], "end", 0);
    expect(q.map((t) => t.id)).toEqual([MOCK_TRACKS[0].id, MOCK_TRACKS[1].id]);
  });

  it("splices immediately after currentIndex for mode next", () => {
    const q = insertIntoQueue(
      [MOCK_TRACKS[0], MOCK_TRACKS[1], MOCK_TRACKS[2]],
      MOCK_TRACKS[3],
      "next",
      0
    );
    expect(q.map((t) => t.id)).toEqual([
      MOCK_TRACKS[0].id,
      MOCK_TRACKS[3].id,
      MOCK_TRACKS[1].id,
      MOCK_TRACKS[2].id,
    ]);
  });

  it("mode next with currentIndex -1 behaves like end", () => {
    const q = insertIntoQueue([MOCK_TRACKS[0]], MOCK_TRACKS[1], "next", -1);
    expect(q.map((t) => t.id)).toEqual([MOCK_TRACKS[0].id, MOCK_TRACKS[1].id]);
  });
});

describe("isSameContext", () => {
  const playing: MockCollection = MOCK_COLLECTIONS[0];

  it("is false when no `from` is given, even if something is playing", () => {
    // play(track) with no source — Search/Home — is always a fresh start,
    // never a claim to be inside whatever happens to be playing.
    expect(isSameContext(undefined, playing)).toBe(false);
  });

  it("is false when no `from` is given and nothing is playing", () => {
    expect(isSameContext(undefined, null)).toBe(false);
  });

  it("is true when `from` matches the playing collection", () => {
    expect(isSameContext(playing, playing)).toBe(true);
  });

  it("is false when `from` names a different collection", () => {
    expect(isSameContext(MOCK_COLLECTIONS[1], playing)).toBe(false);
  });

  it("is false when `from` is given but nothing is playing yet", () => {
    expect(isSameContext(playing, null)).toBe(false);
  });
});

describe("removeQueueIndex", () => {
  const queue = [MOCK_TRACKS[0], MOCK_TRACKS[1], MOCK_TRACKS[2]];

  it("is a no-op for an out-of-range index", () => {
    expect(removeQueueIndex(queue, 1, -1)).toEqual({ queue, currentIndex: 1 });
    expect(removeQueueIndex(queue, 1, 3)).toEqual({ queue, currentIndex: 1 });
  });

  it("shifts the cursor down when removing something before it", () => {
    const r = removeQueueIndex(queue, 1, 0);
    expect(r.queue.map((t) => t.id)).toEqual([
      MOCK_TRACKS[1].id,
      MOCK_TRACKS[2].id,
    ]);
    expect(r.currentIndex).toBe(0);
  });

  it("leaves the cursor put when removing something after it", () => {
    const r = removeQueueIndex(queue, 0, 2);
    expect(r.queue.map((t) => t.id)).toEqual([
      MOCK_TRACKS[0].id,
      MOCK_TRACKS[1].id,
    ]);
    expect(r.currentIndex).toBe(0);
  });

  it("leaves the cursor's position put when removing the playing track itself, addressing what follows", () => {
    const r = removeQueueIndex(queue, 1, 1);
    expect(r.queue.map((t) => t.id)).toEqual([
      MOCK_TRACKS[0].id,
      MOCK_TRACKS[2].id,
    ]);
    expect(r.currentIndex).toBe(1);
    expect(r.queue[r.currentIndex].id).toBe(MOCK_TRACKS[2].id);
  });

  it("clamps to -1 when removing the last remaining track while it is the cursor", () => {
    // The stranding bug: removing the only (and playing) track must not leave
    // the cursor pointing one past the end of the now-shorter queue — a later
    // unrelated enqueue() would refill that slot and resurrect playback.
    const r = removeQueueIndex([MOCK_TRACKS[0]], 0, 0);
    expect(r.queue).toHaveLength(0);
    expect(r.currentIndex).toBe(-1);
  });

  it("leaves currentIndex at -1 when nothing was playing", () => {
    const r = removeQueueIndex(queue, -1, 2);
    expect(r.currentIndex).toBe(-1);
  });
});

describe("shuffle queue order", () => {
  it("pins the current track and deterministically shuffles everything else", () => {
    const queue = [MOCK_TRACKS[0], MOCK_TRACKS[1], MOCK_TRACKS[2]];
    const result = shuffleOrder(queue, 1, () => 0);

    expect(result.currentIndex).toBe(0);
    expect(result.queue.map((track) => track.id)).toEqual([
      MOCK_TRACKS[1].id,
      MOCK_TRACKS[2].id,
      MOCK_TRACKS[0].id,
    ]);
  });

  it("restores duplicate positions by count rather than resurrecting copies", () => {
    const duplicate = MOCK_TRACKS[0];
    const saved = [duplicate, MOCK_TRACKS[1], duplicate];
    const live = [MOCK_TRACKS[1], duplicate];
    const result = restoreOrder(saved, live, duplicate.id);

    expect(result.queue.map((track) => track.id)).toEqual([
      duplicate.id,
      MOCK_TRACKS[1].id,
    ]);
    expect(result.currentIndex).toBe(0);
  });

  it("appends newly queued duplicate positions when restoring", () => {
    const duplicate = MOCK_TRACKS[0];
    const saved = [duplicate, MOCK_TRACKS[1]];
    const live = [MOCK_TRACKS[1], duplicate, duplicate];
    const result = restoreOrder(saved, live, MOCK_TRACKS[1].id);

    expect(result.queue.map((track) => track.id)).toEqual([
      duplicate.id,
      MOCK_TRACKS[1].id,
      duplicate.id,
    ]);
    expect(result.currentIndex).toBe(1);
  });
});
