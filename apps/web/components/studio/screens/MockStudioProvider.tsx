"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  LIKED_SONGS,
  LIKED_SONGS_ID,
  MOCK_COLLECTIONS,
  MOCK_HISTORY,
  MOCK_STATS,
  MOCK_TRACKS,
  MOCK_USER,
  NEW_RELEASE_IDS,
  YOU_MIGHT_LIKE_IDS,
  getCollectionTracks,
  getTrack,
  recentCollections,
  searchMockCollections,
  searchMockTracks,
  type CollectionKind,
  type MockCollection,
  type MockHistoryEntry,
  type MockStats,
  type MockTrack,
  type MockUser,
} from "./mock-data";
import type { LibraryFilter } from "./library-utils";
import {
  insertIntoQueue,
  isSameContext,
  joinAdHocQueue,
  removeQueueIndex,
  restoreOrder,
  shuffleOrder,
  type EnqueueMode,
} from "./queue-utils";
import type { TextureName } from "@/components/studio/Texture";

/**
 * Scoped fake studio state for the /design-system/screens previews:
 * an in-memory player, auth and search. Persists across screens while you
 * navigate the section; resets on reload. Zero coupling to production stores,
 * Firebase or the network — it only exists to make the reskinned pages feel real.
 */
interface MockStudioValue {
  // player
  queue: MockTrack[];
  /** The collection playback was launched from — null means the full library. */
  playingCollection: MockCollection | null;
  /** Which way the last track change went, so the disc knows how to arc. */
  navDirection: "next" | "prev" | null;
  nowPlaying: MockTrack | null;
  isPlaying: boolean;
  isLoading: boolean;
  progressSec: number;
  play: (track: MockTrack, from?: MockCollection) => void;
  /** The playhead's position in `queue`. Surfaces that show the queue must
   *  read this rather than searching for `nowPlaying` by id — a track may
   *  legitimately sit in the queue more than once, and findIndex would answer
   *  with the wrong copy. */
  currentIndex: number;
  /** Start the track at this exact queue position. The queue is untouched.
   *  This — not `play` — is what a click on a queue row means. */
  playAt: (index: number) => void;
  /** Drop exactly one position from the running queue. Not "remove this
   *  track": a duplicate must lose only the copy the user pointed at. */
  dequeue: (index: number) => void;
  /** Put a track into the running queue — what the rail shows under "Up next".
   *  This is playback state, not library state: nothing is written to any
   *  playlist, and no playlist needs to be open for it to work. */
  enqueue: (track: MockTrack, mode?: EnqueueMode) => void;
  toggle: () => void;
  /** There is always a next track when a multi-track queue is active because
   *  advancing from the tail wraps to the first track. */
  canNext: boolean;
  /** Previous either restarts the current track after five seconds or moves
   *  to an earlier queue position. */
  canPrev: boolean;
  next: () => void;
  /** `progressSec >= 5` restarts the current track (seek 0); earlier than
   *  that goes to the previous track, wrapping to the last one from index 0. */
  prev: () => void;
  seek: (sec: number) => void;
  /** True while the queue is in its shuffled order. */
  shuffled: boolean;
  /** Flip shuffle. Enabling reorders the queue (current track first,
   *  everything else permuted) without touching playback; disabling restores
   *  the order shuffle started from. */
  toggleShuffle: () => void;
  /** Start a collection (or an ad-hoc queue) in a remembered shuffled order. */
  playShuffled: (tracks: MockTrack[], from?: MockCollection) => void;
  // auth
  user: MockUser | null;
  /** Which IDP the popup opens for; defaults to google. */
  signIn: (provider?: "google" | "facebook") => void;
  signOut: () => void;
  // search
  searchResults: MockTrack[];
  searching: boolean;
  hasSearched: boolean;
  search: (query: string) => void;
  clearSearch: () => void;
  /** One-shot track lookup for surfaces that search alongside the Search
   *  screen (the rail's add-to-queue field). It returns its results instead of
   *  publishing them, so a rail-side query can't wipe what the user is reading
   *  on /search. */
  searchTracks: (query: string) => Promise<MockTrack[]>;
  // library
  collections: MockCollection[];
  /** True until the library has loaded. Routes that look a collection up by id
   *  must wait on this — with a real backend `collections` is empty on the
   *  first render, and treating that as "not found" flashes a false error. */
  libraryLoading: boolean;
  libraryFilter: LibraryFilter;
  setLibraryFilter: (filter: LibraryFilter) => void;
  togglePin: (id: string) => void;
  /** Liking is membership of the Liked Songs collection, not a parallel list —
   *  one source of truth, and the playlist stays honest. */
  isLiked: (trackId: string) => boolean;
  toggleLike: (trackId: string) => void;
  /** Add or remove a track from any collection. The add-to-playlist checklist
   *  needs both directions; addTrackToCollection only ever adds. */
  toggleTrackInCollection: (collectionId: string, trackId: string) => void;
  /** Append a track to a collection; no-op if it's already in there. */
  addTrackToCollection: (collectionId: string, trackId: string) => void;
  /** Returns the created collection so a caller (the create-playlist route)
   *  can navigate straight to it. `texture` and `trackIds` are optional so
   *  every existing caller keeps working unchanged — a real backend will
   *  eventually expose one create endpoint that takes the same shape, so the
   *  wizard builds the whole collection in a single atomic call rather than
   *  create-then-patch (which would leave a half-built playlist visible if a
   *  later call failed). */
  createCollection: (input: {
    title: string;
    desc: string;
    tags: string[];
    kind: CollectionKind;
    texture?: TextureName;
    cover?: "texture" | "mosaic";
    trackIds?: string[];
  }) => MockCollection;
  // feeds & profile data (phase 8). Both providers supply these — the mock one
  // from fixtures, the real one from /api/feed, /api/me/stats and /api/me/recents
  // — so the screens read one shape and never import fixtures directly.
  /** Home "Jump back in": collections played recently. */
  jumpBackIn: MockCollection[];
  /** Home "New releases". */
  newReleases: MockTrack[];
  /** Search "You might like". */
  youMightLike: MockTrack[];
  /** True while the home/search shelves' feeds are in flight. */
  feedsLoading: boolean;
  /** Collections matching the current search query (the caller's own library). */
  collectionResults: MockCollection[];
  /** Listening stats; null while loading or signed out. */
  stats: MockStats | null;
  /** Play history, newest first, grouped for the Recents screen. */
  recents: MockHistoryEntry[];
  // player surface
  playerExpanded: boolean;
  setPlayerExpanded: (open: boolean) => void;
  /** 0–1. Output level, independent of whether anything is loaded. */
  volume: number;
  setVolume: (volume: number) => void;
  /** Muting is volume 0 that remembers where it came from, so unmuting
   *  restores the level the user actually chose rather than jumping to full. */
  muted: boolean;
  toggleMute: () => void;
}

// Exported so the real StudioProvider (phase 8) can feed the same context —
// the screens call useMockStudio() and neither knows nor cares which provider
// is above them.
export const MockStudioContext = createContext<MockStudioValue | null>(null);
export type { MockStudioValue };

export function useMockStudio(): MockStudioValue {
  const ctx = useContext(MockStudioContext);
  if (!ctx) {
    throw new Error("useMockStudio must be used within MockStudioProvider");
  }
  return ctx;
}

/** Fallback queue when a track is played outside any collection. */
const LIBRARY_QUEUE = MOCK_TRACKS;

export default function MockStudioProvider({
  children,
  feeds,
}: {
  children: React.ReactNode;
  /** Test/docs override for the feed shelves' data and loading state. */
  feeds?: {
    loading?: boolean;
    youMightLike?: MockTrack[];
    newReleases?: MockTrack[];
  };
}) {
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progressSec, setProgressSec] = useState(0);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set by seek so the completion effect can tell a scrub from a real finish. */
  const justSeeked = useRef(false);

  const [user, setUser] = useState<MockUser | null>(MOCK_USER);

  const [searchResults, setSearchResults] = useState<MockTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [collections, setCollections] = useState<MockCollection[]>([
    LIKED_SONGS,
    ...MOCK_COLLECTIONS,
  ]);
  const [libraryFilter, setLibraryFilter] =
    useState<LibraryFilter>("playlists");
  const [playerExpanded, setPlayerExpanded] = useState(false);
  const [volume, setVolumeState] = useState(1);
  /** The level to come back to when unmuting. Never 0, so an unmute always
   *  restores something audible even if the user muted from silence. */
  const preMuteVolume = useRef(1);
  const [playingCollection, setPlayingCollection] =
    useState<MockCollection | null>(null);
  const [navDirection, setNavDirection] = useState<"next" | "prev" | null>(
    null
  );
  const [shuffled, setShuffled] = useState(false);
  /** The order the queue was in right before shuffle was turned on —
   *  meaningful only while `shuffled` is true. */
  const preShuffleOrderRef = useRef<MockTrack[] | null>(null);

  /** Held as state, not derived from `playingCollection`: the queue can be
   *  added to on its own (the rail's add-to-queue field), so it has to be able
   *  to differ from the collection playback started with. */
  const [queue, setQueue] = useState<MockTrack[]>(LIBRARY_QUEUE);

  const togglePin = useCallback((id: string) => {
    // Liked Songs is permanent: nothing can unpin it, no matter what calls in.
    if (id === LIKED_SONGS_ID) return;
    setCollections((cs) =>
      cs.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
    );
  }, []);

  /** Membership of Liked Songs, read straight off the collections state so a
   *  like shows up in the playlist and vice versa — there is no second list to
   *  fall out of step. */
  const likedTrackIds = useMemo(
    () => collections.find((c) => c.id === LIKED_SONGS_ID)?.trackIds ?? [],
    [collections]
  );

  const isLiked = useCallback(
    (trackId: string) => likedTrackIds.includes(trackId),
    [likedTrackIds]
  );

  const toggleTrackInCollection = useCallback(
    (collectionId: string, trackId: string) => {
      setCollections((cs) =>
        cs.map((c) =>
          c.id === collectionId
            ? {
                ...c,
                trackIds: c.trackIds.includes(trackId)
                  ? c.trackIds.filter((id) => id !== trackId)
                  : [...c.trackIds, trackId],
              }
            : c
        )
      );
    },
    []
  );

  /** Liking is exactly this toggle aimed at Liked Songs — the like button and
   *  the add-to-playlist checklist are the same operation on different rows. */
  const toggleLike = useCallback(
    (trackId: string) => toggleTrackInCollection(LIKED_SONGS_ID, trackId),
    [toggleTrackInCollection]
  );

  const addTrackToCollection = useCallback(
    (collectionId: string, trackId: string) => {
      setCollections((cs) =>
        cs.map((c) =>
          c.id === collectionId && !c.trackIds.includes(trackId)
            ? { ...c, trackIds: [...c.trackIds, trackId] }
            : c
        )
      );
    },
    []
  );

  const createCollection = useCallback(
    (input: {
      title: string;
      desc: string;
      tags: string[];
      kind: CollectionKind;
      texture?: TextureName;
      cover?: "texture" | "mosaic";
      trackIds?: string[];
    }): MockCollection => {
      // Built from the `collections` closure (not a setState functional
      // updater) so the id and full object are available to return
      // immediately — a functional updater only runs when React processes
      // the queued render, which is not synchronous with this call, so
      // capturing the id from inside one would hand the caller `undefined`.
      const created: MockCollection = {
        // Counting collections reuses ids after any removal, which phase 2
        // introduces — two collections would then share an id and routes would
        // resolve to the wrong one. Server-issued ids replace this then.
        id: `local-${crypto.randomUUID()}`,
        title: input.title,
        desc: input.desc,
        texture: input.texture ?? "tx-k-silk",
        cover: input.cover ?? "texture",
        trackIds: input.trackIds ?? [],
        likes: 0,
        tags: input.tags,
        kind: input.kind,
        pinned: false,
      };
      setCollections((cs) => [...cs, created]);
      return created;
    },
    []
  );

  const nowPlaying = currentIndex >= 0 ? (queue[currentIndex] ?? null) : null;

  const startLoad = useCallback((index: number) => {
    setCurrentIndex(index);
    setProgressSec(0);
    setIsPlaying(false);
    setIsLoading(true);
    if (loadTimer.current) clearTimeout(loadTimer.current);
    // brief buffering so the 3-face play button exercises its "wait" state
    loadTimer.current = setTimeout(() => {
      setIsLoading(false);
      setIsPlaying(true);
    }, 650);
  }, []);

  const playAt = useCallback(
    (index: number) => {
      if (index < 0 || index >= queue.length) return;
      setNavDirection(null);
      startLoad(index);
    },
    [queue.length, startLoad]
  );

  const play = useCallback(
    (track: MockTrack, from?: MockCollection) => {
      // Clicking a row in the queue you are already inside is not a request to
      // rebuild that queue. Only naming the collection currently playing is —
      // see isSameContext for why `from` omitted never counts.
      const at = queue.findIndex((t) => t.id === track.id);
      if (isSameContext(from, playingCollection) && at >= 0) {
        setNavDirection(null);
        startLoad(at);
        return;
      }

      // A loose play (no `from`) while the user's own ad-hoc queue is
      // running (no collection context) joins that queue instead of
      // replacing it — mirrors the real provider (see B5's joinAdHocQueue).
      if (!from && playingCollection === null && queue.length > 0) {
        const joined = joinAdHocQueue(queue, track);
        setQueue(joined.queue);
        setNavDirection(null);
        startLoad(joined.index);
        return;
      }

      const source = from ?? null;
      const nextQueue = source ? getCollectionTracks(source) : [track];
      const idx = nextQueue.findIndex((t) => t.id === track.id);
      setPlayingCollection(source);
      setQueue(nextQueue);
      setNavDirection(null);
      startLoad(idx >= 0 ? idx : 0);
      // A genuinely fresh queue invalidates whatever shuffle was doing to the
      // previous one.
      if (shuffled) {
        setShuffled(false);
        preShuffleOrderRef.current = null;
      }
    },
    [startLoad, playingCollection, queue, shuffled]
  );

  const dequeue = useCallback(
    (index: number) => {
      const removedId = queue[index]?.id;
      const result = removeQueueIndex(queue, currentIndex, index);
      setQueue(result.queue);
      setCurrentIndex(result.currentIndex);
      // Dropping the same slot from the remembered pre-shuffle order too —
      // otherwise turning shuffle back off would resurrect a removed track.
      if (shuffled && removedId && preShuffleOrderRef.current) {
        const saved = [...preShuffleOrderRef.current];
        const savedIndex = saved.findIndex((t) => t.id === removedId);
        if (savedIndex >= 0) saved.splice(savedIndex, 1);
        preShuffleOrderRef.current = saved;
      }
      // Clamped past the end means the track that was playing just vanished
      // and nothing replaced it — stop, so a later, unrelated enqueue() can't
      // silently resurrect playback into the vacated slot.
      if (result.currentIndex === -1 && currentIndex !== -1) {
        setIsPlaying(false);
      }
    },
    [queue, currentIndex, shuffled]
  );

  /** Splices into the running queue. Deliberately does not start playback:
   *  queueing something is a statement about what comes later, not now. */
  const enqueue = useCallback(
    (track: MockTrack, mode: EnqueueMode = "end") => {
      setQueue((q) => insertIntoQueue(q, track, mode, currentIndex));
    },
    [currentIndex]
  );

  const toggle = useCallback(() => {
    setIsPlaying((p) => (nowPlaying ? !p : p));
  }, [nowPlaying]);

  const next = useCallback(() => {
    // The wrap IS the point: the auto-advance effect below calls next() with
    // nothing else special-cased, so a finished queue — shuffled or not —
    // restarts from the top instead of stopping dead at the last track.
    setCurrentIndex((i) =>
      i < 0 || !queue.length ? i : (i + 1) % queue.length
    );
    setNavDirection("next");
    setProgressSec(0);
    setIsPlaying(true);
  }, [queue.length]);

  /**
   * Clamped at both ends. Without the upper bound, seeking past the end set a
   * progress value beyond durationSec, which the auto-advance effect reads as
   * "finished" and skips the track — so the final seconds were unreachable.
   */
  const seek = useCallback(
    (sec: number) => {
      const max = nowPlaying?.durationSec ?? 0;
      justSeeked.current = true;
      setProgressSec(Math.min(max, Math.max(0, Math.floor(sec))));
    },
    [nowPlaying]
  );

  /**
   * Smart previous: a "restart this track" gesture past a threshold, a real
   * "go back" gesture before it. At the first queue position there is no
   * previous track, so the transport disables this action until five seconds
   * have elapsed (at which point it can restart the current track).
   */
  const prev = useCallback(() => {
    if (progressSec >= 5) {
      seek(0);
      return;
    }
    setCurrentIndex((i) => (i <= 0 ? i : i - 1));
    setNavDirection("prev");
    setProgressSec(0);
    setIsPlaying(true);
  }, [progressSec, seek]);

  /**
   * Enable: remember today's order, Fisher–Yates the rest with whatever is
   * currently playing pinned to the front — playback itself never
   * interrupts. Disable: restore the remembered order (minus anything
   * dequeued meanwhile) and re-derive the playhead by the id that's actually
   * playing.
   */
  const toggleShuffle = useCallback(() => {
    if (!shuffled) {
      preShuffleOrderRef.current = queue;
      const result = shuffleOrder(queue, currentIndex, Math.random);
      setQueue(result.queue);
      setCurrentIndex(result.currentIndex);
      setShuffled(true);
      return;
    }
    const saved = preShuffleOrderRef.current ?? queue;
    const result = restoreOrder(saved, queue, nowPlaying?.id ?? null);
    setQueue(result.queue);
    setCurrentIndex(result.currentIndex);
    preShuffleOrderRef.current = null;
    setShuffled(false);
  }, [shuffled, queue, currentIndex, nowPlaying]);

  const playShuffled = useCallback(
    (tracks: MockTrack[], from?: MockCollection) => {
      if (!tracks.length) return;
      const result = shuffleOrder(tracks, -1, Math.random);
      preShuffleOrderRef.current = tracks;
      setPlayingCollection(from ?? null);
      setQueue(result.queue);
      setNavDirection(null);
      setShuffled(true);
      startLoad(0);
    },
    [startLoad]
  );

  const setVolume = useCallback((next: number) => {
    const clamped = Math.min(1, Math.max(0, next));
    // Dragging the slider to a real level is also how you leave mute, so the
    // restore point follows the last audible choice.
    if (clamped > 0) preMuteVolume.current = clamped;
    setVolumeState(clamped);
  }, []);

  const toggleMute = useCallback(() => {
    setVolumeState((v) => (v > 0 ? 0 : preMuteVolume.current));
  }, []);

  // 1s progress ticker while playing
  useEffect(() => {
    if (!isPlaying || !nowPlaying) return;
    const id = setInterval(() => setProgressSec((p) => p + 1), 1000);
    return () => clearInterval(id);
  }, [isPlaying, nowPlaying]);

  // Auto-advance when a track finishes — but only when playback got there by
  // ticking. Scrubbing to the very end is a request to hear the last moment,
  // not to skip the track, so a seek is allowed to land on durationSec without
  // triggering this. The following tick pushes past it and advances normally.
  useEffect(() => {
    if (justSeeked.current) {
      justSeeked.current = false;
      return;
    }
    if (nowPlaying && isPlaying && progressSec >= nowPlaying.durationSec) {
      next();
    }
  }, [progressSec, isPlaying, nowPlaying, next]);

  useEffect(() => {
    return () => {
      if (loadTimer.current) clearTimeout(loadTimer.current);
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  // Argument accepted (matches the real provider's signature) and ignored —
  // the mock has no IDP to pick between, it always just signs in the fixture user.
  const signIn = useCallback(() => setUser(MOCK_USER), []);
  const signOut = useCallback(() => setUser(null), []);

  /** The live query, so collection results can live on the context like the
   *  real provider's do rather than being recomputed inside the screen. */
  const [query, setQuery] = useState("");

  const search = useCallback((query: string) => {
    setQuery(query);
    setHasSearched(true);
    setSearching(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearchResults(searchMockTracks(query));
      setSearching(false);
    }, 550);
  }, []);

  /** Async to match the real provider's network search; the fixtures answer
   *  immediately, so callers written against one work against the other. */
  const searchTracks = useCallback(
    async (query: string) => searchMockTracks(query),
    []
  );

  const clearSearch = useCallback(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setQuery("");
    setSearchResults([]);
    setSearching(false);
    setHasSearched(false);
  }, []);

  // Feed data from the fixtures, in the same shape the real provider supplies.
  const resolve = (ids: string[]): MockTrack[] =>
    ids.map(getTrack).filter((t): t is MockTrack => t !== undefined);
  const jumpBackIn = useMemo(
    () => recentCollections(MOCK_HISTORY, collections),
    [collections]
  );
  const newReleases = useMemo(
    () => feeds?.newReleases ?? resolve(NEW_RELEASE_IDS),
    [feeds]
  );
  const youMightLike = useMemo(
    () => feeds?.youMightLike ?? resolve(YOU_MIGHT_LIKE_IDS),
    [feeds]
  );
  const collectionResults = useMemo(
    () => (query.trim() ? searchMockCollections(query, collections) : []),
    [query, collections]
  );
  const stats: MockStats = MOCK_STATS;
  const recents: MockHistoryEntry[] = MOCK_HISTORY;

  const value: MockStudioValue = {
    queue,
    playingCollection,
    navDirection,
    nowPlaying,
    isPlaying,
    isLoading,
    progressSec,
    play,
    currentIndex,
    playAt,
    dequeue,
    enqueue,
    toggle,
    canNext: currentIndex >= 0 && queue.length > 1,
    canPrev: currentIndex > 0 || (currentIndex >= 0 && progressSec >= 5),
    next,
    prev,
    seek,
    shuffled,
    toggleShuffle,
    playShuffled,
    user,
    signIn,
    signOut,
    searchResults,
    searching,
    hasSearched,
    search,
    clearSearch,
    searchTracks,
    collections,
    libraryLoading: false,
    libraryFilter,
    setLibraryFilter,
    togglePin,
    isLiked,
    toggleLike,
    toggleTrackInCollection,
    addTrackToCollection,
    createCollection,
    jumpBackIn,
    newReleases,
    youMightLike,
    feedsLoading: feeds?.loading ?? false,
    collectionResults,
    stats,
    recents,
    playerExpanded,
    volume,
    setVolume,
    muted: volume === 0,
    toggleMute,
    setPlayerExpanded,
  };

  return (
    <MockStudioContext.Provider value={value}>
      {children}
    </MockStudioContext.Provider>
  );
}
