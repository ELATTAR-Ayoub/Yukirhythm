import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from "@testing-library/react";

import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { LIKED_SONGS_ID } from "@/components/studio/screens/mock-data";
import { toStudioTrack } from "@/lib/studio/adapt";
import type { Track } from "@/lib/catalog/model";

const { backend, authState, hiddenPlayer } = vi.hoisted(() => ({
  hiddenPlayer: {
    // Latest props StudioProvider passed to the (mocked-away) hidden
    // react-player, so a test can simulate onReady the same way the real
    // player would fire it — including firing it again on a track change.
    props: null as null | {
      onReady: () => void;
      onProgress?: (s: { playedSeconds: number }) => void;
      playerRef?: { current: unknown };
    },
    seekTo: vi.fn(),
  },
  backend: {
    me: {
      ensure: vi.fn().mockResolvedValue({}),
      get: vi.fn().mockResolvedValue({
        userId: "u1",
        displayName: "Yuki",
        email: "y@x.dev",
      }),
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
        clearQueue: vi.fn().mockResolvedValue({}),
        removeFromQueue: vi.fn().mockResolvedValue({}),
      },
    },
    collections: { list: vi.fn(), create: vi.fn() },
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
      uid: "u1",
      displayName: "Yuki",
      email: "y@x.dev",
      photoURL: null,
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
// Stands in for the real HiddenYouTubePlayer: captures whatever props
// StudioProvider passes it (so a test can call onReady directly, the same
// way react-player would) and fakes the ref-attach so playerRef.current
// resolves to a spyable seekTo — without this, StudioProvider's own
// onReady/seek logic (the thing under test for the restore fixes) would be
// unreachable from a test.
vi.mock("next/dynamic", () => ({
  default:
    () =>
    (props: { playerRef?: { current: unknown }; onReady: () => void }) => {
      hiddenPlayer.props = props;
      if (props.playerRef)
        props.playerRef.current = { seekTo: hiddenPlayer.seekTo };
      return null;
    },
}));

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

function seedPlayback(state: Record<string, unknown>): void {
  localStorage.setItem(
    "yukirhythm:playback:v1:u1",
    JSON.stringify({
      trackId: null,
      queue: [],
      queueIndex: -1,
      positionSec: 0,
      isPlaying: false,
      volume: 1,
      ...state,
    })
  );
}

/** Exposes the playback slice of the context plus a way to trigger a volume
 *  change, a user-initiated play, and next(), for the restore/persistence
 *  tests below. */
function PlaybackProbe() {
  const {
    queue,
    nowPlaying,
    progressSec,
    volume,
    isPlaying,
    isLoading,
    collections,
    setVolume,
    play,
    next,
    toggle,
    clearQueue,
  } = useMockStudio();
  return (
    <>
      <div data-testid="queue-length">{queue.length}</div>
      <div data-testid="queue-ids">
        {queue.map((item) => item.id).join(",")}
      </div>
      <div data-testid="now-playing">{nowPlaying?.id ?? "none"}</div>
      <div data-testid="progress">{progressSec}</div>
      <div data-testid="volume">{volume}</div>
      <div data-testid="is-playing">{String(isPlaying)}</div>
      <div data-testid="is-loading">{String(isLoading)}</div>
      <div data-testid="collections-count">{collections.length}</div>
      <button onClick={() => setVolume(0.7)}>set-volume</button>
      <button
        onClick={() =>
          play(toStudioTrack(track({ trackId: "u1", title: "User Pick" })))
        }
      >
        play-user-track
      </button>
      <button onClick={() => next()}>next</button>
      <button onClick={() => toggle()}>toggle</button>
      <button
        onClick={() =>
          play(
            toStudioTrack(
              track({ trackId: "rec-track", title: "Recommended" }),
              {
                eventSource: "recommendation",
                recommendationId: "yml:rec-track",
              }
            )
          )
        }
      >
        play-recommendation
      </button>
      <button onClick={() => void clearQueue()}>clear-queue</button>
      <button
        onClick={() =>
          play(toStudioTrack(track({ trackId: "t2", title: "Second" })), {
            id: "playlist-1",
            title: "Playlist",
            desc: "",
            texture: "tx-k-silk",
            trackIds: ["t1", "t2", "t3"],
            likes: 0,
            tags: [],
            kind: "music",
            pinned: false,
          })
        }
      >
        play-collection-track
      </button>
    </>
  );
}

function Probe() {
  const { user, collections, libraryLoading } = useMockStudio();
  const liked = collections.find((c) => c.id === LIKED_SONGS_ID);
  return (
    <>
      <div data-testid="startup-user">{user?.userName ?? "signed-out"}</div>
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
    render(
      <StudioProvider>
        <Probe />
      </StudioProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(screen.getByTestId("liked").textContent).toBe("Liked Songs");
    expect(screen.getByTestId("liked-system").textContent).toBe("true");
  });

  it("shows the authenticated identity and starts feeds before profile loading finishes", async () => {
    let finishProfile: (value: unknown) => void = () => {};
    backend.me.get.mockReturnValueOnce(
      new Promise((resolve) => {
        finishProfile = resolve;
      })
    );
    backend.feed.newReleases.mockClear();
    backend.feed.youMightLike.mockClear();
    backend.feed.jumpBackIn.mockClear();

    render(
      <StudioProvider>
        <Probe />
      </StudioProvider>
    );

    // Firebase already identified the listener. The shell must never regress
    // to a false signed-out prompt while the backend profile is unresolved.
    expect(screen.getByTestId("startup-user")).toHaveTextContent("Yuki");
    await waitFor(() => {
      expect(backend.feed.newReleases).toHaveBeenCalledTimes(1);
      expect(backend.feed.youMightLike).toHaveBeenCalledTimes(1);
      expect(backend.feed.jumpBackIn).not.toHaveBeenCalled();
    });
    expect(screen.getByTestId("loading")).toHaveTextContent("true");

    await act(async () => {
      finishProfile({
        userId: "u1",
        displayName: "Yuki",
        email: "y@x.dev",
      });
    });
    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("false")
    );
  });

  it("still builds the library when the likes call fails", async () => {
    // The composite index this endpoint needs is blocked in production. One
    // rejected promise used to take the ENTIRE library down with it — the
    // user saw no playlists at all, and libraryLoading never cleared.
    backend.me.likes.mockRejectedValue(new Error("FAILED_PRECONDITION: index"));
    render(
      <StudioProvider>
        <Probe />
      </StudioProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(screen.getByTestId("liked").textContent).toBe("Liked Songs");
  });

  it("still builds the library when the collections call fails", async () => {
    backend.collections.list.mockRejectedValue(new Error("boom"));
    render(
      <StudioProvider>
        <Probe />
      </StudioProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
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
          <div data-testid="liked-tracks">
            {liked?.trackIds.join(",") ?? ""}
          </div>
        </>
      );
    }

    render(
      <StudioProvider>
        <LikeProbe />
      </StudioProvider>
    );
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

  it("replaces a newly-created pending collection with the POST response without a list refresh", async () => {
    function CreateProbe() {
      const { collections, createCollection, libraryLoading } = useMockStudio();
      return (
        <>
          <div data-testid="create-loading">{String(libraryLoading)}</div>
          <button
            onClick={() =>
              createCollection({
                title: "Rainy Tapes",
                desc: "Tape loops",
                tags: ["rain"],
                kind: "music",
                trackIds: [],
              })
            }
          >
            create
          </button>
          <div data-testid="created-ids">
            {collections
              .filter((c) => c.title === "Rainy Tapes")
              .map((c) => c.id)
              .join(",")}
          </div>
        </>
      );
    }

    backend.collections.create.mockResolvedValueOnce({
      collectionId: "server-rainy-tapes",
      ownerId: "u1",
      role: "playlist",
      contentType: "music",
      title: "Rainy Tapes",
      description: "Tape loops",
      tags: ["rain"],
      cover: "texture",
      texture: "tx-k-silk",
      imageUrl: null,
      tracks: [],
      visibility: "private",
      stats: {
        trackCount: 0,
        totalDurationSec: 0,
        saveCount: 0,
        playCount: 0,
      },
      createdAt: null,
      updatedAt: null,
    });

    render(
      <StudioProvider>
        <CreateProbe />
      </StudioProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("create-loading").textContent).toBe("false")
    );
    const listCallsAfterLoad = backend.collections.list.mock.calls.length;

    fireEvent.click(screen.getByText("create"));
    expect(screen.getByTestId("created-ids").textContent).toMatch(/^pending-/);
    await waitFor(() =>
      expect(screen.getByTestId("created-ids").textContent).toBe(
        "server-rainy-tapes"
      )
    );
    expect(backend.collections.list).toHaveBeenCalledTimes(listCallsAfterLoad);
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
    localStorage.clear();
    backend.collections.list.mockResolvedValue([]);
    backend.me.likes.mockResolvedValue({ trackIds: [], tracks: [] });
    // save's call history is shared across every `it` in this file (the mock
    // is created once, hoisted) — several tests below assert
    // not.toHaveBeenCalled(), which would trivially fail from a PRIOR test's
    // calls without this.
    backend.me.playback.save.mockClear();
    backend.me.playback.clearQueue.mockClear();
    backend.me.playback.clearQueue.mockResolvedValue({});
    backend.events.ingest.mockClear();
    backend.events.ingest.mockResolvedValue({ ok: true, written: 1 });
    hiddenPlayer.seekTo.mockClear();
  });

  it("starts a selected playlist track before hydrating the rest of its queue", async () => {
    let resolveFirst!: (value: Track) => void;
    let resolveThird!: (value: Track) => void;
    const first = new Promise<Track>((resolve) => (resolveFirst = resolve));
    const third = new Promise<Track>((resolve) => (resolveThird = resolve));
    backend.catalog.track.mockImplementation((id: string) => {
      if (id === "t1") return first;
      if (id === "t3") return third;
      throw new Error(`Unexpected catalogue request for ${id}`);
    });

    render(
      <StudioProvider>
        <PlaybackProbe />
      </StudioProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("collections-count").textContent).toBe("1")
    );

    fireEvent.click(screen.getByText("play-collection-track"));

    // Neither surrounding catalogue request has completed, but playback is
    // already seated on the selected track and the selected track was not
    // redundantly fetched.
    expect(screen.getByTestId("now-playing").textContent).toBe("t2");
    expect(screen.getByTestId("queue-ids").textContent).toBe("t2");
    expect(backend.catalog.track).toHaveBeenCalledTimes(2);

    resolveFirst(track({ trackId: "t1", title: "First" }));
    resolveThird(track({ trackId: "t3", title: "Third" }));

    await waitFor(() =>
      expect(screen.getByTestId("queue-ids").textContent).toBe("t1,t2,t3")
    );
    expect(screen.getByTestId("now-playing").textContent).toBe("t2");
  });

  it("counts heard seconds instead of seek position and keeps recommendation attribution", async () => {
    render(
      <StudioProvider>
        <PlaybackProbe />
      </StudioProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("collections-count").textContent).toBe("1")
    );

    fireEvent.click(screen.getByText("play-recommendation"));
    act(() => {
      hiddenPlayer.props?.onProgress?.({ playedSeconds: 1 });
      hiddenPlayer.props?.onProgress?.({ playedSeconds: 2 });
      hiddenPlayer.props?.onProgress?.({ playedSeconds: 120 });
      hiddenPlayer.props?.onProgress?.({ playedSeconds: 121 });
    });
    fireEvent.click(screen.getByText("next"));

    const events = JSON.parse(
      localStorage.getItem("yukirhythm:history:v1:u1") ?? "[]"
    );
    expect(events[0]).toMatchObject({
      trackId: "rec-track",
      listenedSec: 3,
      source: "recommendation",
      recommendationId: "yml:rec-track",
    });
    expect(events[0].startedAt).toBeGreaterThan(0);
    expect(events[0].eventId).toMatch(/^[\w-]{8,}$/);
    expect(backend.events.ingest).not.toHaveBeenCalled();
  });

  it("restores queue, current track, position and volume, paused", async () => {
    seedPlayback({
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
    // The restore itself must never echo the value it just read straight
    // back to the server — pins the skip-ref, not just its visible effect.
    expect(backend.me.playback.save).not.toHaveBeenCalled();
  });

  it("a failed playback read leaves the player cold and the rest of sign-in intact", async () => {
    localStorage.setItem("yukirhythm:playback:v1:u1", "broken-json");

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
    expect(screen.getByTestId("now-playing").textContent).toBe("none");
  });

  it("clears playback locally without calling the database", async () => {
    render(
      <StudioProvider>
        <PlaybackProbe />
      </StudioProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("collections-count").textContent).toBe("1")
    );
    fireEvent.click(screen.getByText("play-user-track"));
    expect(screen.getByTestId("queue-length").textContent).toBe("1");

    fireEvent.click(screen.getByText("clear-queue"));
    await waitFor(() =>
      expect(screen.getByTestId("queue-length").textContent).toBe("0")
    );
    expect(screen.getByTestId("now-playing").textContent).toBe("none");
    expect(screen.getByTestId("is-playing").textContent).toBe("false");
    expect(backend.me.playback.clearQueue).not.toHaveBeenCalled();
  });

  it("clamps an out-of-range queueIndex when the saved track can't be re-anchored", async () => {
    seedPlayback({
      // No trackId to re-anchor to, so this exercises the pure range-clamp
      // fallback rather than the trackId-first lookup.
      trackId: null,
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

  it("re-anchors the restored index to the saved trackId when an earlier queue entry fails to resolve", async () => {
    // Saved queue was [a, b, c] with b playing at index 1. `a` no longer
    // resolves (deleted/unembeddable) — resolved becomes [b, c], so a raw
    // range-clamp of queueIndex=1 would land on c, the wrong track.
    seedPlayback({
      trackId: "b",
      queue: ["a", "b", "c"],
      queueIndex: 1,
      positionSec: 5,
      isPlaying: false,
      volume: 0.5,
    });
    backend.catalog.track.mockImplementation((id: string) =>
      id === "a"
        ? Promise.reject(new Error("gone"))
        : Promise.resolve(track({ trackId: id, title: id }))
    );

    render(
      <StudioProvider>
        <PlaybackProbe />
      </StudioProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("queue-length").textContent).toBe("2")
    );
    expect(screen.getByTestId("now-playing").textContent).toBe("b");
  });

  it("does not clobber a session the user already started before the restore lands", async () => {
    seedPlayback({
      trackId: "t2",
      queue: ["t1", "t2"],
      queueIndex: 1,
      positionSec: 42,
      isPlaying: true,
      volume: 0.4,
    });
    let finishRestore!: () => void;
    const gate = new Promise<void>((resolve) => (finishRestore = resolve));
    backend.catalog.track.mockImplementation(async (id: string) => {
      await gate;
      return track({ trackId: id, title: id });
    });

    render(
      <StudioProvider>
        <PlaybackProbe />
      </StudioProvider>
    );

    // Let sign-in progress far enough to actually issue the playback read —
    // only then is `resolveGet` wired to the real in-flight promise (before
    // that, resolving it early would be a no-op and this test would pass
    // for the wrong reason: the restore never having run yet at all).
    await waitFor(() => expect(backend.catalog.track).toHaveBeenCalled());

    // The user starts their own playback while that read is still pending.
    fireEvent.click(screen.getByText("play-user-track"));
    expect(screen.getByTestId("now-playing").textContent).toBe("u1");
    expect(screen.getByTestId("queue-length").textContent).toBe("1");

    // The restore now lands, describing a completely different saved
    // session. It must yield rather than clobber what the user just started.
    await act(async () => {
      finishRestore();
      // Let the restore's resolveTrackIds() awaits and .then chain drain.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByTestId("now-playing").textContent).toBe("u1");
    expect(screen.getByTestId("queue-length").textContent).toBe("1");
    // play() -> startTrack() sets isPlaying true; restore must not have
    // touched it (it doesn't get to write anything at all here).
    expect(screen.getByTestId("is-playing").textContent).toBe("true");
  });

  it("drops a stale restored seek target when the track changes before its onReady ever fires", async () => {
    seedPlayback({
      trackId: "t1",
      queue: ["t1", "t2"],
      queueIndex: 0,
      positionSec: 55,
      isPlaying: false,
      volume: 0.5,
    });
    backend.catalog.track.mockImplementation((id: string) =>
      Promise.resolve(track({ trackId: id, title: id, durationSec: 200 }))
    );

    render(
      <StudioProvider>
        <PlaybackProbe />
      </StudioProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("now-playing").textContent).toBe("t1")
    );

    // Move on before t1's own onReady ever fired — next()/prev() don't clear
    // pendingSeekRef the way startTrack() does.
    fireEvent.click(screen.getByText("next"));
    await waitFor(() =>
      expect(screen.getByTestId("now-playing").textContent).toBe("t2")
    );

    // react-player re-fires onReady on every track change (cueVideoById ->
    // CUED -> onReady) — this is t2's onReady, not t1's.
    act(() => {
      hiddenPlayer.props?.onReady();
    });

    expect(hiddenPlayer.seekTo).not.toHaveBeenCalled();
  });

  it("does not swallow the next real volume change when the restored volume matches the current default", async () => {
    seedPlayback({
      trackId: "t1",
      queue: ["t1"],
      queueIndex: 0,
      positionSec: 0,
      isPlaying: false,
      // Same as the untouched default (1) — setVolumeState is a no-op here,
      // so an unconditionally-armed skip-ref would never get consumed.
      volume: 1,
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
      expect(screen.getByTestId("now-playing").textContent).toBe("t1")
    );

    fireEvent.click(screen.getByText("set-volume"));
    expect(screen.getByTestId("volume").textContent).toBe("0.7");
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem("yukirhythm:playback:v1:u1") ?? "{}")
          .volume
      ).toBe(0.7)
    );
    expect(backend.me.playback.save).not.toHaveBeenCalled();
  });

  it("never writes active playback to the database while progress ticks", async () => {
    // The persistence interval used to list progressSec (and other
    // fast-changing state) in its effect deps, so every ~1s progress tick
    // tore the 10s timer down and recreated it — it only ever fired when
    // ticks stalled (throttled tab, buffering). A playing track that reports
    // progress every second must still hit the server on the 10s cadence.
    render(
      <StudioProvider>
        <PlaybackProbe />
      </StudioProvider>
    );
    // Let sign-in settle under real timers first: an interval created before
    // useFakeTimers() would be a real one, invisible to advanceTimersByTime.
    await waitFor(() =>
      expect(screen.getByTestId("collections-count").textContent).toBe("1")
    );

    vi.useFakeTimers();
    try {
      // Starting the track only now means the persistence interval is
      // scheduled on the fake clock.
      fireEvent.click(screen.getByText("play-user-track"));
      expect(screen.getByTestId("now-playing").textContent).toBe("u1");

      // Nine seconds of playback, a progress tick each second.
      for (let sec = 1; sec <= 29; sec++) {
        act(() => {
          vi.advanceTimersByTime(1000);
          hiddenPlayer.props?.onProgress?.({ playedSeconds: sec });
        });
      }
      // 10s cadence, not faster — nothing saved during the first nine.
      expect(backend.me.playback.save).not.toHaveBeenCalled();

      // The tenth second crosses the 10s mark: the save must fire despite
      // every one of those ticks having re-rendered the provider.
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(backend.me.playback.save).not.toHaveBeenCalled();
      expect(backend.events.ingest).not.toHaveBeenCalled();
      expect(
        JSON.parse(localStorage.getItem("yukirhythm:playback:v1:u1") ?? "{}")
          .positionSec
      ).toBe(29);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not periodically write a loaded but paused track", async () => {
    render(
      <StudioProvider>
        <PlaybackProbe />
      </StudioProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("collections-count").textContent).toBe("1")
    );

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByText("play-user-track"));
      fireEvent.click(screen.getByText("toggle"));
      expect(backend.me.playback.save).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(24 * 60 * 60 * 1000));
      expect(backend.me.playback.save).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops the current song when its card play action is clicked again", async () => {
    render(
      <StudioProvider>
        <PlaybackProbe />
      </StudioProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("collections-count").textContent).toBe("1")
    );

    fireEvent.click(screen.getByText("play-user-track"));
    expect(screen.getByTestId("now-playing")).toHaveTextContent("u1");
    expect(screen.getByTestId("is-playing")).toHaveTextContent("true");
    expect(screen.getByTestId("is-loading")).toHaveTextContent("true");

    fireEvent.click(screen.getByText("play-user-track"));
    expect(screen.getByTestId("now-playing")).toHaveTextContent("u1");
    expect(screen.getByTestId("is-playing")).toHaveTextContent("false");
    expect(screen.getByTestId("is-loading")).toHaveTextContent("false");
  });

  it("persists a volume change in browser storage only", async () => {
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

    fireEvent.click(screen.getByText("set-volume"));
    expect(screen.getByTestId("volume").textContent).toBe("0.7");
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem("yukirhythm:playback:v1:u1") ?? "{}")
          .volume
      ).toBe(0.7)
    );
    expect(backend.me.playback.save).not.toHaveBeenCalled();
  });
});
