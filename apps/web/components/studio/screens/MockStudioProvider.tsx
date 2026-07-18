"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  MOCK_TRACKS,
  MOCK_USER,
  searchMockTracks,
  type MockTrack,
  type MockUser,
} from "./mock-data";

/**
 * Scoped fake studio state for the /design-system/screens previews:
 * an in-memory player, auth and search. Persists across screens while you
 * navigate the section; resets on reload. Zero coupling to production stores,
 * Firebase or the network — it only exists to make the reskinned pages feel real.
 */
interface MockStudioValue {
  // player
  queue: MockTrack[];
  nowPlaying: MockTrack | null;
  isPlaying: boolean;
  isLoading: boolean;
  progressSec: number;
  play: (track: MockTrack) => void;
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
}

const MockStudioContext = createContext<MockStudioValue | null>(null);

export function useMockStudio(): MockStudioValue {
  const ctx = useContext(MockStudioContext);
  if (!ctx) {
    throw new Error("useMockStudio must be used within MockStudioProvider");
  }
  return ctx;
}

const QUEUE = MOCK_TRACKS;

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

  const nowPlaying = currentIndex >= 0 ? QUEUE[currentIndex] : null;

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
    (track: MockTrack) => {
      const idx = QUEUE.findIndex((t) => t.id === track.id);
      startLoad(idx >= 0 ? idx : 0);
    },
    [startLoad]
  );

  const toggle = useCallback(() => {
    setIsPlaying((p) => (nowPlaying ? !p : p));
  }, [nowPlaying]);

  const next = useCallback(() => {
    setCurrentIndex((i) => (i < 0 ? i : (i + 1) % QUEUE.length));
    setProgressSec(0);
    setIsPlaying(true);
  }, []);

  const prev = useCallback(() => {
    setCurrentIndex((i) => (i < 0 ? i : (i - 1 + QUEUE.length) % QUEUE.length));
    setProgressSec(0);
    setIsPlaying(true);
  }, []);

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
    setSearchResults([]);
    setSearching(false);
    setHasSearched(false);
  }, []);

  const value: MockStudioValue = {
    queue: QUEUE,
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
  };

  return (
    <MockStudioContext.Provider value={value}>
      {children}
    </MockStudioContext.Provider>
  );
}
