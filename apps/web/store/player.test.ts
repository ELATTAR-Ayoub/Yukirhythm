import { beforeEach, describe, expect, it } from "vitest";
import { importLegacyQueue, usePlayerStore } from "@/store/player";
import type { Audio } from "@/constants/interfaces";

const makeAudio = (id: string): Audio => ({
  ID: id,
  URL: `https://youtu.be/${id}`,
  title: `t-${id}`,
  thumbnails: [],
  owner: { name: "o", ID: "o", canonicalURL: "" },
});

const reset = () =>
  usePlayerStore.setState({
    audioState: [],
    currentAudio: 0,
    audioLoading: false,
    audioPlaying: false,
    audioVolume: 0.4,
  });

describe("player store — queue", () => {
  beforeEach(reset);

  it("adds a new audio", () => {
    usePlayerStore.getState().addItem(makeAudio("a"));
    expect(usePlayerStore.getState().audioState.map((x) => x.ID)).toEqual([
      "a",
    ]);
  });

  it("does not add a duplicate ID", () => {
    usePlayerStore.getState().addItem(makeAudio("a"));
    usePlayerStore.getState().addItem(makeAudio("a"));
    expect(usePlayerStore.getState().audioState.map((x) => x.ID)).toEqual([
      "a",
    ]);
  });

  it("ignores an empty payload", () => {
    usePlayerStore.getState().addItem(undefined as unknown as Audio);
    expect(usePlayerStore.getState().audioState).toEqual([]);
  });

  it("dedupes an array passed to setQueue", () => {
    usePlayerStore
      .getState()
      .setQueue([makeAudio("a"), makeAudio("b"), makeAudio("a")]);
    expect(usePlayerStore.getState().audioState.map((x) => x.ID)).toEqual([
      "a",
      "b",
    ]);
  });

  it("wraps a single object passed to setQueue", () => {
    usePlayerStore.getState().setQueue(makeAudio("a"));
    expect(usePlayerStore.getState().audioState.map((x) => x.ID)).toEqual([
      "a",
    ]);
  });

  it("deletes by ID and clears the queue", () => {
    usePlayerStore.getState().setQueue([makeAudio("a"), makeAudio("b")]);
    usePlayerStore.getState().deleteItem("a");
    expect(usePlayerStore.getState().audioState.map((x) => x.ID)).toEqual([
      "b",
    ]);
    usePlayerStore.getState().clearQueue();
    expect(usePlayerStore.getState().audioState).toEqual([]);
  });
});

describe("player store — transport", () => {
  beforeEach(reset);

  it("skips forward and back additively", () => {
    usePlayerStore.getState().skipNext(1);
    expect(usePlayerStore.getState().currentAudio).toBe(1);
    usePlayerStore.getState().skipPrev(1);
    expect(usePlayerStore.getState().currentAudio).toBe(0);
    usePlayerStore.getState().skipNext(0); // intentional no-op, see ListDrawer
    expect(usePlayerStore.getState().currentAudio).toBe(0);
  });

  it("sets transport flags", () => {
    usePlayerStore.getState().setPlaying(true);
    usePlayerStore.getState().setLoading(true);
    usePlayerStore.getState().setVolume(0.9);
    usePlayerStore.getState().setCurrent(3);
    const s = usePlayerStore.getState();
    expect([
      s.audioPlaying,
      s.audioLoading,
      s.audioVolume,
      s.currentAudio,
    ]).toEqual([true, true, 0.9, 3]);
  });
});

describe("importLegacyQueue", () => {
  const fakeStorage = (data: Record<string, string>): Storage =>
    ({
      getItem: (k: string) => data[k] ?? null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    }) as unknown as Storage;

  it("imports a legacy raw array when no new key exists", () => {
    const legacy = JSON.stringify([makeAudio("a"), makeAudio("b")]);
    const out = importLegacyQueue(fakeStorage({ audioState: legacy }));
    expect(out?.map((x) => x.ID)).toEqual(["a", "b"]);
  });

  it("dedupes legacy data by ID", () => {
    const legacy = JSON.stringify([makeAudio("a"), makeAudio("a")]);
    const out = importLegacyQueue(fakeStorage({ audioState: legacy }));
    expect(out?.map((x) => x.ID)).toEqual(["a"]);
  });

  it("ignores legacy data once the new key exists", () => {
    const legacy = JSON.stringify([makeAudio("a")]);
    const out = importLegacyQueue(
      fakeStorage({ audioState: legacy, "yuki-player": "{}" })
    );
    expect(out).toBeNull();
  });

  it("returns null when there is no legacy data", () => {
    expect(importLegacyQueue(fakeStorage({}))).toBeNull();
  });

  it("survives malformed legacy JSON without throwing", () => {
    expect(
      importLegacyQueue(fakeStorage({ audioState: "{not json" }))
    ).toBeNull();
  });

  it("ignores legacy data that is not an array", () => {
    expect(
      importLegacyQueue(fakeStorage({ audioState: '{"nope":true}' }))
    ).toBeNull();
  });
});
