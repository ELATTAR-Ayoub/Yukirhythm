import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";

import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { LIKED_SONGS_ID } from "@/components/studio/screens/mock-data";
import type { Track } from "@/lib/catalog/model";

const { backend, authState } = vi.hoisted(() => ({
  backend: {
    me: {
      ensure: vi.fn().mockResolvedValue({}),
      get: vi.fn().mockResolvedValue({ userId: "u1", displayName: "Yuki", email: "y@x.dev" }),
      likes: vi.fn(),
      stats: vi.fn().mockRejectedValue(new Error("no")),
      recents: vi.fn().mockRejectedValue(new Error("no")),
      library: vi.fn().mockResolvedValue({ collections: [], tracks: [] }),
      setTrackState: vi.fn().mockResolvedValue({}),
      setPin: vi.fn().mockResolvedValue({}),
      playback: {
        get: vi.fn().mockResolvedValue({ queue: [], trackId: null }),
        save: vi.fn().mockResolvedValue({}),
        enqueue: vi.fn().mockResolvedValue({}),
        removeFromQueue: vi.fn().mockResolvedValue({}),
      },
    },
    collections: { list: vi.fn() },
    feed: {
      jumpBackIn: vi.fn().mockRejectedValue(new Error("no")),
      newReleases: vi.fn().mockRejectedValue(new Error("no")),
      youMightLike: vi.fn().mockRejectedValue(new Error("no")),
    },
    catalog: { track: vi.fn(), search: vi.fn() },
    events: { ingest: vi.fn() },
  },
  authState: {
    user: {
      uid: "u1", displayName: "Yuki", email: "y@x.dev", photoURL: null,
      providerData: [{ providerId: "google.com" }],
    },
  },
}));

vi.mock("@/lib/studio/useBackend", () => ({ useBackend: () => backend }));
vi.mock("@/lib/studio/useAuth", () => ({
  useAuthState: () => authState,
  signIn: vi.fn(),
  signOutUser: vi.fn(),
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));

import StudioProvider from "./StudioProvider";

/** Minimal catalog Track fixture — mirrors the one in adapt.test.ts. Only the
 *  fields toStudioTrack actually reads need real values. */
function track(over: Partial<Track> = {}): Track {
  return {
    trackId: "t1",
    type: "track",
    title: "Instant Crush",
    artists: [{ artistId: "a1", name: "Daft Punk" }],
    album: null,
    durationSec: 180,
    artwork: [],
    texture: "tx-k-silk",
    source: { provider: "youtube", videoId: "t1", url: "", aliasVideoIds: [] },
    isEmbeddable: true,
    isLive: false,
    isFamilySafe: true,
    stats: { viewCount: 0, likeCount: 0, playCount: 0 },
    publishedAt: null,
    labels: [],
    labelIds: [],
    keywords: [],
    enrichedAt: null,
    schemaVersion: 1,
    ...over,
  } as Track;
}

/** Exposes the playback slice of the context plus a way to trigger a volume
 *  change, for the restore/persistence tests below. */
function PlaybackProbe() {
  const { queue, nowPlaying, progressSec, volume, isPlaying, collections, setVolume } =
    useMockStudio();
  return (
    <>
      <div data-testid="queue-length">{queue.length}</div>
      <div data-testid="now-playing">{nowPlaying?.id ?? "none"}</div>
      <div data-testid="progress">{progressSec}</div>
      <div data-testid="volume">{volume}</div>
      <div data-testid="is-playing">{String(isPlaying)}</div>
      <div data-testid="collections-count">{collections.length}</div>
      <button onClick={() => setVolume(0.7)}>set-volume</button>
    </>
  );
}

function Probe() {
  const { collections, libraryLoading } = useMockStudio();
  const liked = collections.find((c) => c.id === LIKED_SONGS_ID);
  return (
    <>
      <div data-testid="loading">{String(libraryLoading)}</div>
      <div data-testid="count">{collections.length}</div>
      <div data-testid="liked">{liked ? liked.title : "missing"}</div>
      <div data-testid="liked-system">{String(liked?.system ?? false)}</div>
    </>
  );
}

describe("StudioProvider library load", () => {
  beforeEach(() => {
    backend.collections.list.mockResolvedValue([]);
    backend.me.likes.mockResolvedValue({ trackIds: [], tracks: [] });
  });

  it("gives a brand-new account a Liked Songs playlist", async () => {
    render(<StudioProvider><Probe /></StudioProvider>);
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("liked").textContent).toBe("Liked Songs");
    expect(screen.getByTestId("liked-system").textContent).toBe("true");
  });

  it("still builds the library when the likes call fails", async () => {
    // The composite index this endpoint needs is blocked in production. One
    // rejected promise used to take the ENTIRE library down with it — the
    // user saw no playlists at all, and libraryLoading never cleared.
    backend.me.likes.mockRejectedValue(new Error("FAILED_PRECONDITION: index"));
    render(<StudioProvider><Probe /></StudioProvider>);
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("liked").textContent).toBe("Liked Songs");
  });

  it("still builds the library when the collections call fails", async () => {
    backend.collections.list.mockRejectedValue(new Error("boom"));
    render(<StudioProvider><Probe /></StudioProvider>);
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("liked").textContent).toBe("Liked Songs");
  });

  it("puts a newly liked track at the front of Liked Songs without waiting for a refetch", async () => {
    // toggleLike's optimistic update must land synchronously with the click —
    // not after backend.me.setTrackState round-trips and refreshLibrary re-runs.
    function LikeProbe() {
      const { collections, toggleLike } = useMockStudio();
      const liked = collections.find((c) => c.id === LIKED_SONGS_ID);
      return (
        <>
          <button onClick={() => toggleLike("brand-new-track")}>like</button>
          <div data-testid="liked-tracks">{liked?.trackIds.join(",") ?? ""}</div>
        </>
      );
    }

    render(<StudioProvider><LikeProbe /></StudioProvider>);
    await waitFor(() =>
      expect(screen.getByTestId("liked-tracks")).toBeInTheDocument()
    );

    // backend.me.setTrackState never resolves during this test, so if the
    // track shows up it can only be from the optimistic update.
    backend.me.setTrackState.mockReturnValueOnce(new Promise(() => {}));
    fireEvent.click(screen.getByText("like"));

    expect(screen.getByTestId("liked-tracks").textContent).toBe(
      "brand-new-track"
    );
  });
});

describe("StudioProvider search seq-ticket", () => {
  beforeEach(() => {
    backend.collections.list.mockResolvedValue([]);
    backend.me.likes.mockResolvedValue({ trackIds: [], tracks: [] });
  });

  /** Advances past every pending microtask (and any zero-delay macrotask)
   *  without asserting anything first — used after resolving a response that
   *  is EXPECTED to be dropped, where the "after" state is identical to the
   *  "before" state and there is no real transition for waitFor to key off. */
  const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  /** Exposes search/clearSearch as buttons and the search state as text, so
   *  a test can drive concurrent searches and read what actually landed. */
  function SearchProbe() {
    const { searchResults, searching, hasSearched, search, clearSearch } =
      useMockStudio();
    return (
      <>
        <button onClick={() => search("query-a")}>search-a</button>
        <button onClick={() => search("query-b")}>search-b</button>
        <button onClick={() => clearSearch()}>clear</button>
        <div data-testid="results">
          {searchResults.map((t) => t.title).join(",")}
        </div>
        <div data-testid="searching">{String(searching)}</div>
        <div data-testid="has-searched">{String(hasSearched)}</div>
      </>
    );
  }

  it("a stale search response cannot overwrite a newer one", async () => {
    // Two manually-controlled deferreds stand in for the network: resolving
    // them out of call order is exactly the race the seq ticket guards.
    let resolveA: (v: { tracks: Track[] }) => void = () => {};
    let resolveB: (v: { tracks: Track[] }) => void = () => {};
    backend.catalog.search
      .mockImplementationOnce(() => new Promise((res) => (resolveA = res)))
      .mockImplementationOnce(() => new Promise((res) => (resolveB = res)));

    render(
      <StudioProvider>
        <SearchProbe />
      </StudioProvider>
    );

    fireEvent.click(screen.getByText("search-a"));
    fireEvent.click(screen.getByText("search-b"));

    // The newer search (B) answers first.
    resolveB({ tracks: [track({ trackId: "b1", title: "Track B" })] });
    await waitFor(() =>
      expect(screen.getByTestId("results").textContent).toBe("Track B")
    );

    // A's response — the stale one — lands after. It must be dropped, not
    // overwrite B's already-rendered results. Nothing here changes state, so
    // there is no transition for waitFor to key off — flush and check.
    resolveA({ tracks: [track({ trackId: "a1", title: "Track A" })] });
    await flush();
    expect(screen.getByTestId("results").textContent).toBe("Track B");
    expect(screen.getByTestId("searching").textContent).toBe("false");
  });

  it("a response landing after clearSearch is discarded", async () => {
    let resolveA: (v: { tracks: Track[] }) => void = () => {};
    backend.catalog.search.mockImplementationOnce(
      () => new Promise((res) => (resolveA = res))
    );

    render(
      <StudioProvider>
        <SearchProbe />
      </StudioProvider>
    );

    fireEvent.click(screen.getByText("search-a"));
    await waitFor(() =>
      expect(screen.getByTestId("has-searched").textContent).toBe("true")
    );

    fireEvent.click(screen.getByText("clear"));
    expect(screen.getByTestId("has-searched").textContent).toBe("false");

    // The in-flight response for the abandoned search shows up late — it
    // must not resurrect results the user already cleared. Both fields are
    // already at their expected values, so flush rather than waitFor: there
    // is no transition to key off, only the absence of one.
    resolveA({ tracks: [track({ trackId: "a1", title: "Track A" })] });
    await flush();

    expect(screen.getByTestId("results").textContent).toBe("");
    expect(screen.getByTestId("has-searched").textContent).toBe("false");
  });
});

describe("StudioProvider playback session restore", () => {
  beforeEach(() => {
    backend.collections.list.mockResolvedValue([]);
    backend.me.likes.mockResolvedValue({ trackIds: [], tracks: [] });
  });

  it("restores queue, current track, position and volume, paused", async () => {
    backend.me.playback.get.mockResolvedValueOnce({
      trackId: "t2",
      queue: ["t1", "t2"],
      queueIndex: 1,
      positionSec: 42,
      isPlaying: true,
      volume: 0.4,
    });
    backend.catalog.track.mockImplementation((id: string) =>
      Promise.resolve(track({ trackId: id, title: id }))
    );

    render(
      <StudioProvider>
        <PlaybackProbe />
      </StudioProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("now-playing").textContent).toBe("t2")
    );
    expect(screen.getByTestId("queue-length").textContent).toBe("2");
    expect(screen.getByTestId("progress").textContent).toBe("42");
    expect(screen.getByTestId("volume").textContent).toBe("0.4");
    // Restored PAUSED — browsers block un-gestured autoplay, so a saved
    // isPlaying: true must not be honored on restore.
    expect(screen.getByTestId("is-playing").textContent).toBe("false");
  });

  it("a failed playback read leaves the player cold and the rest of sign-in intact", async () => {
    backend.me.playback.get.mockRejectedValueOnce(new Error("boom"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(
      <StudioProvider>
        <PlaybackProbe />
      </StudioProvider>
    );

    // The rest of sign-in (library/collections) is unaffected by the
    // rejected playback read.
    await waitFor(() =>
      expect(screen.getByTestId("collections-count").textContent).toBe("1")
    );
    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith("Playback restore failed", expect.any(Error))
    );
    expect(screen.getByTestId("now-playing").textContent).toBe("none");

    warn.mockRestore();
  });

  it("clamps an out-of-range queueIndex", async () => {
    backend.me.playback.get.mockResolvedValueOnce({
      trackId: "t1",
      queue: ["t1", "t2"],
      queueIndex: 9,
      positionSec: 10,
      isPlaying: false,
      volume: 0.6,
    });
    backend.catalog.track.mockImplementation((id: string) =>
      Promise.resolve(track({ trackId: id, title: id }))
    );

    render(
      <StudioProvider>
        <PlaybackProbe />
      </StudioProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("queue-length").textContent).toBe("2")
    );
    // Out of bounds for the 2 resolved tracks — falls back to index 0, not a
    // crash and not an empty nowPlaying.
    expect(screen.getByTestId("now-playing").textContent).toBe("t1");
  });

  it("persists a volume change after the debounce", async () => {
    render(
      <StudioProvider>
        <PlaybackProbe />
      </StudioProvider>
    );
    // Let sign-in (and the volume effect's skipped first run) settle under
    // real timers before switching to fake ones for the debounce itself.
    await waitFor(() =>
      expect(screen.getByTestId("collections-count").textContent).toBe("1")
    );

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByText("set-volume"));
      expect(screen.getByTestId("volume").textContent).toBe("0.7");

      act(() => {
        vi.advanceTimersByTime(1100);
      });

      expect(backend.me.playback.save).toHaveBeenCalledWith(
        expect.objectContaining({ volume: 0.7 })
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
