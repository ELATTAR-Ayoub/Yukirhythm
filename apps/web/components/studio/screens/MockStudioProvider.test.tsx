import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import MockStudioProvider, { useMockStudio } from "./MockStudioProvider";
import {
  LIKED_SONGS,
  MOCK_COLLECTIONS,
  MOCK_TRACKS,
  MOCK_USER,
  getCollectionTracks,
  type MockCollection,
} from "./mock-data";

function wrapper({ children }: { children: React.ReactNode }) {
  return <MockStudioProvider>{children}</MockStudioProvider>;
}

describe("MockStudioProvider", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("plays a track after buffering, then toggles and ticks progress", () => {
    const { result } = renderHook(() => useMockStudio(), { wrapper });

    expect(result.current.nowPlaying).toBeNull();
    expect(result.current.isPlaying).toBe(false);

    act(() => result.current.play(MOCK_TRACKS[0]));
    // buffering: track selected but not yet playing
    expect(result.current.nowPlaying?.id).toBe(MOCK_TRACKS[0].id);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isPlaying).toBe(false);

    // finish the 650ms fake buffer
    act(() => vi.advanceTimersByTime(650));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isPlaying).toBe(true);

    // 1s ticker advances progress
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.progressSec).toBe(2);

    // pause stops the ticker
    act(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(false);
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.progressSec).toBe(2);
  });

  it("flips auth state on signIn/signOut", () => {
    const { result } = renderHook(() => useMockStudio(), { wrapper });

    expect(result.current.user?.id).toBe(MOCK_USER.id);
    act(() => result.current.signOut());
    expect(result.current.user).toBeNull();
    act(() => result.current.signIn());
    expect(result.current.user?.id).toBe(MOCK_USER.id);
  });

  it("returns search results after the fake delay", () => {
    const { result } = renderHook(() => useMockStudio(), { wrapper });

    act(() => result.current.search(MOCK_TRACKS[0].title));
    expect(result.current.searching).toBe(true);
    expect(result.current.hasSearched).toBe(true);

    act(() => vi.advanceTimersByTime(550));
    expect(result.current.searching).toBe(false);
    expect(result.current.searchResults.length).toBeGreaterThan(0);

    act(() => result.current.clearSearch());
    expect(result.current.searchResults).toHaveLength(0);
    expect(result.current.hasSearched).toBe(false);
  });

  it("manages the library: pin, filter, create", () => {
    const { result } = renderHook(() => useMockStudio(), { wrapper });

    expect(result.current.collections[0].id).toBe(LIKED_SONGS.id);
    expect(result.current.libraryFilter).toBe("playlists");

    act(() => result.current.togglePin("c1"));
    expect(result.current.collections.find((c) => c.id === "c1")?.pinned).toBe(true);

    act(() => result.current.setLibraryFilter("podcasts"));
    expect(result.current.libraryFilter).toBe("podcasts");

    const before = result.current.collections.length;
    let created: ReturnType<typeof result.current.createCollection>;
    act(() => {
      created = result.current.createCollection({
        title: "Rainy Tapes",
        desc: "Tape loops for rain.",
        tags: ["rain"],
        kind: "music",
      });
    });
    expect(result.current.collections).toHaveLength(before + 1);
    expect(result.current.collections.at(-1)?.title).toBe("Rainy Tapes");
    expect(result.current.collections.at(-1)?.pinned).toBe(false);
    // The create-playlist route navigates straight to the new collection by
    // id, so createCollection must hand that id back rather than leaving the
    // caller to guess it from the (still-stale, pre-render) collections array.
    expect(created!).toEqual(result.current.collections.at(-1));
    // texture/trackIds omitted — falls back to the previous hard-coded
    // defaults so every existing caller keeps behaving the same.
    expect(result.current.collections.at(-1)?.texture).toBe("tx-k-silk");
    expect(result.current.collections.at(-1)?.trackIds).toEqual([]);
  });

  it("creates a collection with a chosen cover and starting tracks in one call", () => {
    // The create-playlist wizard builds cover + tracks into the same call
    // that creates the collection, rather than creating then patching —
    // a create-then-patch sequence would leave a half-built playlist
    // visible if a later call failed.
    const { result } = renderHook(() => useMockStudio(), { wrapper });

    let created: ReturnType<typeof result.current.createCollection>;
    act(() => {
      created = result.current.createCollection({
        title: "Rainy Tapes",
        desc: "Tape loops for rain.",
        tags: ["rain"],
        kind: "music",
        texture: "tx-k2-vinyl",
        trackIds: [MOCK_TRACKS[0].id, MOCK_TRACKS[1].id],
      });
    });

    expect(created!.texture).toBe("tx-k2-vinyl");
    expect(created!.trackIds).toEqual([MOCK_TRACKS[0].id, MOCK_TRACKS[1].id]);
    expect(result.current.collections.at(-1)).toEqual(created!);
  });

  it("expands and collapses the player", () => {
    const { result } = renderHook(() => useMockStudio(), { wrapper });

    expect(result.current.playerExpanded).toBe(false);
    act(() => result.current.setPlayerExpanded(true));
    expect(result.current.playerExpanded).toBe(true);
    act(() => result.current.setPlayerExpanded(false));
    expect(result.current.playerExpanded).toBe(false);
  });

  it("issues unique collection ids", () => {
    const { result } = renderHook(() => useMockStudio(), { wrapper });

    act(() => {
      result.current.createCollection({ title: "A", desc: "", tags: [], kind: "music" });
    });
    act(() => {
      result.current.createCollection({ title: "B", desc: "", tags: [], kind: "music" });
    });

    const ids = result.current.collections.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("clamps seek to the track length instead of auto-advancing", () => {
    const { result } = renderHook(() => useMockStudio(), { wrapper });

    act(() => result.current.play(MOCK_TRACKS[0]));
    act(() => vi.advanceTimersByTime(650));

    act(() => result.current.seek(999_999));

    expect(result.current.progressSec).toBe(MOCK_TRACKS[0].durationSec);
    expect(result.current.nowPlaying?.id).toBe(MOCK_TRACKS[0].id);
  });

  it("still advances when a track finishes on its own", () => {
    const { result } = renderHook(() => useMockStudio(), { wrapper });

    act(() => result.current.play(MOCK_TRACKS[0]));
    act(() => vi.advanceTimersByTime(650));

    // let the ticker run the whole track out
    act(() => vi.advanceTimersByTime((MOCK_TRACKS[0].durationSec + 1) * 1000));

    expect(result.current.nowPlaying?.id).toBe(MOCK_TRACKS[1].id);
  });

  it("advances a tick after a seek to the very end, not instantly", () => {
    const { result } = renderHook(() => useMockStudio(), { wrapper });

    act(() => result.current.play(MOCK_TRACKS[0]));
    act(() => vi.advanceTimersByTime(650));

    act(() => result.current.seek(MOCK_TRACKS[0].durationSec));
    expect(result.current.nowPlaying?.id).toBe(MOCK_TRACKS[0].id);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.nowPlaying?.id).toBe(MOCK_TRACKS[1].id);
  });

  it("clamps a negative seek to zero", () => {
    const { result } = renderHook(() => useMockStudio(), { wrapper });

    act(() => result.current.play(MOCK_TRACKS[0]));
    act(() => vi.advanceTimersByTime(650));

    act(() => result.current.seek(-50));

    expect(result.current.progressSec).toBe(0);
  });
});

describe("the queue is not the playlist", () => {
  it("keeps enqueued tracks when a row inside the running queue is clicked", () => {
    // The reported bug: play() resolved the collection and replaced the whole
    // queue, so clicking any row threw away everything the user had queued.
    const source = MOCK_COLLECTIONS[0];
    const { result } = renderHook(() => useMockStudio(), {
      wrapper: MockStudioProvider,
    });

    act(() => {
      result.current.play(getCollectionTracks(source)[0], source);
    });
    const extra = MOCK_TRACKS.find((t) => !source.trackIds.includes(t.id))!;
    act(() => {
      result.current.enqueue(extra);
    });
    expect(result.current.queue.map((t) => t.id)).toContain(extra.id);

    // Click a different row of the same running queue.
    act(() => {
      result.current.play(
        getCollectionTracks(source)[1],
        result.current.playingCollection ?? undefined
      );
    });

    expect(result.current.queue.map((t) => t.id)).toContain(extra.id);
    expect(result.current.nowPlaying?.id).toBe(getCollectionTracks(source)[1].id);
  });

  it("rebuilds the queue when a genuinely different collection is played", () => {
    // Starting another playlist IS an instruction to replace what is queued.
    const a = MOCK_COLLECTIONS[0];
    const b = MOCK_COLLECTIONS[1];
    const { result } = renderHook(() => useMockStudio(), {
      wrapper: MockStudioProvider,
    });

    act(() => {
      result.current.play(getCollectionTracks(a)[0], a);
    });
    act(() => {
      result.current.play(getCollectionTracks(b)[0], b);
    });

    expect(result.current.playingCollection?.id).toBe(b.id);
    expect(result.current.queue.map((t) => t.id)).toEqual(b.trackIds);
  });

  it("playAt addresses a queue position, so a duplicate plays the copy clicked", () => {
    const { result } = renderHook(() => useMockStudio(), {
      wrapper: MockStudioProvider,
    });
    const dup = MOCK_TRACKS[0];

    act(() => {
      result.current.play(dup);
    });
    act(() => {
      result.current.enqueue(dup);
    });
    const at = result.current.queue.length - 1;

    act(() => {
      result.current.playAt(at);
    });

    expect(result.current.currentIndex).toBe(at);
  });

  it("dequeue removes exactly one position, not every copy of the track", () => {
    const { result } = renderHook(() => useMockStudio(), {
      wrapper: MockStudioProvider,
    });
    const dup = MOCK_TRACKS[0];

    act(() => {
      result.current.play(dup);
    });
    act(() => {
      result.current.enqueue(dup);
    });
    const before = result.current.queue.length;

    act(() => {
      result.current.dequeue(before - 1);
    });

    expect(result.current.queue).toHaveLength(before - 1);
    expect(result.current.queue.map((t) => t.id)).toContain(dup.id);
  });

  it("keeps playing the same track when an earlier queue entry is removed", () => {
    // Removing something above the playhead must not shift what is audible.
    const { result } = renderHook(() => useMockStudio(), {
      wrapper: MockStudioProvider,
    });
    const source = MOCK_COLLECTIONS[0];

    act(() => {
      result.current.play(getCollectionTracks(source)[2], source);
    });
    const playing = result.current.nowPlaying?.id;

    act(() => {
      result.current.dequeue(0);
    });

    expect(result.current.nowPlaying?.id).toBe(playing);
  });

  it("starts a fresh context when a track is played with no source, even if it is already queued", () => {
    // Search and Home call play(track) with no `from`. Treating that as "same
    // context" silently kept the listener inside a playlist they had left.
    const source = MOCK_COLLECTIONS[0];
    const { result } = renderHook(() => useMockStudio(), { wrapper: MockStudioProvider });

    act(() => { result.current.play(getCollectionTracks(source)[0], source); });
    expect(result.current.playingCollection?.id).toBe(source.id);

    const alreadyQueued = getCollectionTracks(source)[1];
    act(() => { result.current.play(alreadyQueued); });

    expect(result.current.playingCollection).toBeNull();
    expect(result.current.nowPlaying?.id).toBe(alreadyQueued.id);
  });

  it("clamps the playhead instead of leaving it to resurrect a removed track", () => {
    // Repro: a solo queue is playing; dequeue() removes the only (and
    // playing) track. A later, unrelated enqueue() must not silently
    // resurrect playback — enqueue's own contract is that queueing something
    // never starts playback, and a stale index would break that promise the
    // moment the vacated slot is refilled.
    const solo: MockCollection = {
      ...MOCK_COLLECTIONS[0],
      trackIds: [MOCK_TRACKS[0].id],
    };
    const { result } = renderHook(() => useMockStudio(), { wrapper: MockStudioProvider });

    act(() => { result.current.play(MOCK_TRACKS[0], solo); });
    expect(result.current.nowPlaying?.id).toBe(MOCK_TRACKS[0].id);

    act(() => { result.current.dequeue(0); });
    expect(result.current.queue).toHaveLength(0);
    expect(result.current.currentIndex).toBe(-1);
    expect(result.current.isPlaying).toBe(false);

    act(() => { result.current.enqueue(MOCK_TRACKS[1]); });

    expect(result.current.nowPlaying).toBeNull();
    expect(result.current.isPlaying).toBe(false);
  });
});
