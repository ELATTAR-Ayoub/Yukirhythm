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
    trackIds?: string[];
  }) => MockCollection;
  // player surface
  playerExpanded: boolean;
  setPlayerExpanded: (open: boolean) => void;
}

const MockStudioContext = createContext<MockStudioValue | null>(null);

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
      trackIds?: string[];
    }): MockCollection => {
      // Built from the `collections` closure (not a setState functional
      // updater) so the id and full object are available to return
      // immediately — a functional updater only runs when React processes
      // the queued render, which is not synchronous with this call, so
      // capturing the id from inside one would hand the caller `undefined`.
      const created: MockCollection = {
        id: `local-${collections.length + 1}`,
        title: input.title,
        desc: input.desc,
        texture: input.texture ?? "tx-k-silk",
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

  const seek = useCallback((sec: number) => {
    setProgressSec(Math.max(0, Math.floor(sec)));
  }, []);

  // 1s progress ticker while playing
  useEffect(() => {
    if (!isPlaying || !nowPlaying) return;
    const id = setInterval(() => setProgressSec((p) => p + 1), 1000);
    return () => clearInterval(id);
  }, [isPlaying, nowPlaying]);

  // auto-advance when a track finishes
  useEffect(() => {
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
    addTrackToCollection,
    createCollection,
    playerExpanded,
    setPlayerExpanded,
  };

  return (
    <MockStudioContext.Provider value={value}>
      {children}
    </MockStudioContext.Provider>
  );
}
