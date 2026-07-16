import { describe, it, expect } from "vitest";
import reducer, { ADD_ITEM, setAudioConfig } from "@/store/AudioConfig";
import type { Audio } from "@/constants/interfaces";

const makeAudio = (id: string): Audio => ({
  ID: id,
  URL: `https://youtu.be/${id}`,
  title: `t-${id}`,
  thumbnails: [],
  owner: { name: "o", ID: "o", canonicalURL: "" },
});

const baseState = {
  audioState: [] as Audio[],
  currentAudio: 0,
  audioLoading: false,
  audioPlaying: false,
  audioVolume: 0.4,
};

describe("AudioConfig ADD_ITEM dedupe", () => {
  it("adds a new audio", () => {
    const s = reducer(baseState, ADD_ITEM(makeAudio("a")));
    expect(s.audioState.map((x) => x.ID)).toEqual(["a"]);
  });

  it("does not add a duplicate ID", () => {
    const s1 = reducer(baseState, ADD_ITEM(makeAudio("a")));
    const s2 = reducer(s1, ADD_ITEM(makeAudio("a")));
    expect(s2.audioState.map((x) => x.ID)).toEqual(["a"]);
  });

  it("ignores a null/undefined payload", () => {
    const s = reducer(baseState, ADD_ITEM(undefined));
    expect(s.audioState).toEqual([]);
  });
});

describe("AudioConfig setAudioConfig dedupe", () => {
  it("dedupes an array payload by ID", () => {
    const s = reducer(
      baseState,
      setAudioConfig([makeAudio("a"), makeAudio("b"), makeAudio("a")])
    );
    expect(s.audioState.map((x) => x.ID)).toEqual(["a", "b"]);
  });
});
