import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";

import MockStudioProvider, { useMockStudio } from "./MockStudioProvider";
import useQueueCollection from "./useQueueCollection";
import { MOCK_COLLECTIONS, MOCK_TRACKS, getCollectionTracks } from "./mock-data";

/** Exposes the studio alongside the hook so tests can start playback. */
function useProbe() {
  return { collection: useQueueCollection(), studio: useMockStudio() };
}

function renderProbe() {
  return renderHook(() => useProbe(), { wrapper: MockStudioProvider });
}

describe("useQueueCollection", () => {
  it("takes its identity from the source collection when playback came from one", () => {
    const source = MOCK_COLLECTIONS[0];
    const { result } = renderProbe();

    act(() => {
      result.current.studio.play(getCollectionTracks(source)[0], source);
    });

    expect(result.current.collection.id).toBe(source.id);
    expect(result.current.collection.title).toBe(source.title);
    expect(result.current.collection.texture).toBe(source.texture);
  });

  it("tracks the running queue, not the source collection's own track list", () => {
    // The queue drifts from the playlist the moment something is queued from
    // the rail. Reading trackIds off the collection would hide it.
    const source = MOCK_COLLECTIONS[0];
    const { result } = renderProbe();

    act(() => {
      result.current.studio.play(getCollectionTracks(source)[0], source);
    });

    const extra = MOCK_TRACKS.find((t) => !source.trackIds.includes(t.id))!;
    act(() => {
      result.current.studio.enqueue(extra);
    });

    expect(result.current.collection.trackIds).toContain(extra.id);
    expect(result.current.collection.trackIds).toEqual(
      result.current.studio.queue.map((t) => t.id)
    );
    expect(source.trackIds).not.toContain(extra.id);
  });

  it("falls back to a synthetic Up next collection with no source", () => {
    const { result } = renderProbe();
    const { collection, studio } = result.current;

    expect(studio.playingCollection).toBeNull();
    expect(collection.id).toBe("queue");
    expect(collection.title).toBe("Up next");
    expect(collection.desc).toBe("Everything queued from your library.");
    expect(collection.tags).toEqual(["queue"]);
    expect(collection.kind).toBe("music");
  });

  it("mirrors the library queue in the synthetic collection's trackIds", () => {
    const { result } = renderProbe();

    expect(result.current.collection.trackIds).toEqual(
      result.current.studio.queue.map((t) => t.id)
    );
    expect(result.current.collection.trackIds.length).toBeGreaterThan(0);
  });
});
