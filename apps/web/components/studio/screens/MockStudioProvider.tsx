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
  MOCK_TRACKS,
  MOCK_USER,
  getCollectionTracks,
  searchMockTracks,
  type CollectionKind,
  type MockCollection,
  type MockTrack,
  type MockUser,
} from "./mock-data";
import type { LibraryFilter } from "./library-utils";
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
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  // auth
  user: MockUser | null;
  signIn: () => void;
  signOut: () => void;
  // search
  searchResults: MockTrack[];
  searching: boolean;
  hasSearched: boolean;
  search: (query: string) => void;
  clearSearch: () => void;
  // library
  collections: MockCollection[];
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
}: {
  children: React.ReactNode;
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
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("playlists");
  const [playerExpanded, setPlayerExpanded] = useState(false);
  const [volume, setVolumeState] = useState(1);
  /** The level to come back to when unmuting. Never 0, so an unmute always
   *  restores something audible even if the user muted from silence. */
  const preMuteVolume = useRef(1);
  const [playingCollection, setPlayingCollection] =
    useState<MockCollection | null>(null);
  const [navDirection, setNavDirection] = useState<"next" | "prev" | null>(null);

  const queue = useMemo(
    () =>
      playingCollection
        ? getCollectionTracks(playingCollection)
        : LIBRARY_QUEUE,
    [playingCollection]
  );

  const togglePin = useCallback((id: string) => {
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
    [collections.length]
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

  const play = useCallback(
    (track: MockTrack, from?: MockCollection) => {
      // The queue follows the collection the track was launched from, so the
      // queue drawer and next/prev both reflect what the user actually opened.
      const source = from ?? null;
      const nextQueue = source ? getCollectionTracks(source) : LIBRARY_QUEUE;
      const idx = nextQueue.findIndex((t) => t.id === track.id);
      setPlayingCollection(source);
      setNavDirection(null);
      startLoad(idx >= 0 ? idx : 0);
    },
    [startLoad]
  );

  const toggle = useCallback(() => {
    setIsPlaying((p) => (nowPlaying ? !p : p));
  }, [nowPlaying]);

  const next = useCallback(() => {
    setCurrentIndex((i) => (i < 0 ? i : (i + 1) % queue.length));
    setNavDirection("next");
    setProgressSec(0);
    setIsPlaying(true);
  }, [queue.length]);

  const prev = useCallback(() => {
    setCurrentIndex((i) =>
      i < 0 ? i : (i - 1 + queue.length) % queue.length
    );
    setNavDirection("prev");
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

  const signIn = useCallback(() => setUser(MOCK_USER), []);
  const signOut = useCallback(() => setUser(null), []);

  const search = useCallback((query: string) => {
    setHasSearched(true);
    setSearching(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearchResults(searchMockTracks(query));
      setSearching(false);
    }, 550);
  }, []);

  const clearSearch = useCallback(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearchResults([]);
    setSearching(false);
    setHasSearched(false);
  }, []);

  const value: MockStudioValue = {
    queue,
    playingCollection,
    navDirection,
    nowPlaying,
    isPlaying,
    isLoading,
    progressSec,
    play,
    toggle,
    next,
    prev,
    seek,
    user,
    signIn,
    signOut,
    searchResults,
    searching,
    hasSearched,
    search,
    clearSearch,
    collections,
    libraryFilter,
    setLibraryFilter,
    togglePin,
    isLiked,
    toggleLike,
    toggleTrackInCollection,
    addTrackToCollection,
    createCollection,
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
