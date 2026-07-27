import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MockStudioProvider, { useMockStudio } from "./MockStudioProvider";
import {
  MOCK_COLLECTIONS,
  MOCK_TRACKS,
  getCollectionTracks,
} from "./mock-data";

function wrapper({ children }: { children: React.ReactNode }) {
  return <MockStudioProvider>{children}</MockStudioProvider>;
}

describe("queue playback regressions", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("joins a loose track to an active ad-hoc queue and plays it directly", () => {
    const { result } = renderHook(() => useMockStudio(), { wrapper });
    const before = result.current.queue.map((track) => track.id);
    const extra = {
      ...MOCK_TRACKS[0],
      id: "loose-ad-hoc-track",
      title: "Loose ad-hoc track",
    };

    act(() => result.current.play(extra));

    expect(result.current.queue.map((track) => track.id)).toEqual([
      ...before,
      extra.id,
    ]);
    expect(result.current.nowPlaying?.id).toBe(extra.id);
    expect(result.current.playingCollection).toBeNull();
  });

  it("loops Next from the final collection track to the first", () => {
    const { result } = renderHook(() => useMockStudio(), { wrapper });
    const source = MOCK_COLLECTIONS[0];
    const tracks = getCollectionTracks(source);

    act(() => result.current.play(tracks.at(-1)!, source));
    expect(result.current.currentIndex).toBe(tracks.length - 1);

    act(() => result.current.next());

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.nowPlaying?.id).toBe(tracks[0].id);
  });

  it("uses the five-second Previous rule and exposes honest availability", () => {
    const { result } = renderHook(() => useMockStudio(), { wrapper });
    const source = MOCK_COLLECTIONS[0];
    const tracks = getCollectionTracks(source);

    act(() => result.current.play(tracks[1], source));
    expect(result.current.canPrev).toBe(true);
    act(() => result.current.prev());
    expect(result.current.nowPlaying?.id).toBe(tracks[0].id);
    expect(result.current.canPrev).toBe(false);

    act(() => result.current.seek(7));
    expect(result.current.canPrev).toBe(true);
    act(() => result.current.prev());

    expect(result.current.nowPlaying?.id).toBe(tracks[0].id);
    expect(result.current.progressSec).toBe(0);
  });

  it("remembers a shuffled order, wraps inside it, and can restore the source", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { result } = renderHook(() => useMockStudio(), { wrapper });
    const source = MOCK_COLLECTIONS[0];
    const tracks = getCollectionTracks(source);
    const original = tracks.map((track) => track.id);

    act(() => result.current.play(tracks[0], source));
    act(() => result.current.toggleShuffle());

    const shuffled = result.current.queue.map((track) => track.id);
    expect(result.current.shuffled).toBe(true);
    expect(shuffled[0]).toBe(original[0]);
    expect(shuffled).not.toEqual(original);

    act(() => result.current.playAt(shuffled.length - 1));
    act(() => result.current.next());
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.nowPlaying?.id).toBe(shuffled[0]);

    act(() => result.current.toggleShuffle());
    expect(result.current.shuffled).toBe(false);
    expect(result.current.queue.map((track) => track.id)).toEqual(original);
  });
});
