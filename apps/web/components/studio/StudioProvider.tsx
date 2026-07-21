"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";

import {
  MockStudioContext,
  type MockStudioValue,
} from "@/components/studio/screens/MockStudioProvider";
import type {
  CollectionKind,
  MockCollection,
  MockTrack,
  MockUser,
} from "@/components/studio/screens/mock-data";
import type { LibraryFilter } from "@/components/studio/screens/library-utils";
import type { TextureName } from "@/components/studio/Texture";
import { registerStudioTracks } from "@/components/studio/screens/mock-data";
import { useAuthState, signIn as fbSignIn, signOutUser } from "@/lib/studio/useAuth";
import { useBackend } from "@/lib/studio/useBackend";
import {
  toStudioCollection,
  toStudioHistory,
  toStudioStats,
  toStudioTrack,
  toStudioUser,
} from "@/lib/studio/adapt";
import type { Track } from "@/lib/catalog/model";
import type {
  MockHistoryEntry,
  MockStats,
} from "@/components/studio/screens/mock-data";

// react-player pulls in browser-only globals; load it client-side only.
const ReactPlayer = dynamic(() => import("react-player"), { ssr: false });

const LIKED_ID = "liked";

/**
 * The real studio provider: same context the screens consume, backed by the
 * phase 1–7 backend and a real YouTube player. Playback position and play
 * events come from the media element, not a wall-clock ticker.
 */
export default function StudioProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const backend = useBackend();
  const { user: fbUser } = useAuthState();

  const [user, setUser] = useState<MockUser | null>(null);
  const [collections, setCollections] = useState<MockCollection[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("playlists");

  // playback
  const [queue, setQueue] = useState<MockTrack[]>([]);
  const [playingCollection, setPlayingCollection] =
    useState<MockCollection | null>(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progressSec, setProgressSec] = useState(0);
  const [navDirection, setNavDirection] = useState<"next" | "prev" | null>(null);
  const [playerExpanded, setPlayerExpanded] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const preMute = useRef(1);
  const startedAtRef = useRef<number>(0);
  const listenedRef = useRef<number>(0);

  // search
  const [searchResults, setSearchResults] = useState<MockTrack[]>([]);
  const [collectionResults, setCollectionResults] = useState<MockCollection[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // feeds + profile data
  const [jumpBackIn, setJumpBackIn] = useState<MockCollection[]>([]);
  const [newReleases, setNewReleases] = useState<MockTrack[]>([]);
  const [youMightLike, setYouMightLike] = useState<MockTrack[]>([]);
  const [stats, setStats] = useState<MockStats | null>(null);
  const [recents, setRecents] = useState<MockHistoryEntry[]>([]);

  const nowPlaying = currentIndex >= 0 ? (queue[currentIndex] ?? null) : null;

  /** Register tracks so the screens' getTrack/getCollectionTracks resolve them. */
  const absorb = useCallback((tracks: Track[]) => {
    const mocks = tracks.map(toStudioTrack);
    registerStudioTracks(mocks);
    return mocks;
  }, []);

  // ---- load the user + library on sign-in --------------------------------
  const refreshLibrary = useCallback(async () => {
    const [owned, liked] = await Promise.all([
      backend.collections.list(),
      backend.me.likes(),
    ]);
    absorb(liked.tracks);
    const likedSet = new Set(liked.tracks.map((t) => t.trackId));
    setLikedIds(likedSet);

    const likedCollection: MockCollection = {
      id: LIKED_ID,
      title: "Liked Songs",
      desc: "Everything you liked.",
      texture: "tx-k2-vinyl",
      trackIds: liked.tracks.map((t) => t.trackId),
      likes: 0,
      tags: ["liked"],
      kind: "music",
      pinned: true,
    };
    const owns = owned.map((c) =>
      toStudioCollection(c, { pinned: pinnedIds.has(c.collectionId) })
    );
    setCollections([likedCollection, ...owns]);
  }, [backend, absorb, pinnedIds]);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!fbUser) {
        setUser(null);
        setCollections([]);
        return;
      }
      // ensure the user doc exists, then load it
      const provider =
        fbUser.providerData[0]?.providerId?.includes("facebook")
          ? "facebook"
          : "google";
      await backend.me.ensure({
        displayName: fbUser.displayName ?? "",
        email: fbUser.email ?? "",
        avatarUrl: fbUser.photoURL ?? null,
        authProvider: provider,
      });
      const me = await backend.me.get();
      if (!live || !me) return;
      setUser(toStudioUser(me));
      await refreshLibrary();

      // Feeds and profile data. Each is independent — one failing rail must not
      // blank the others, so they settle separately.
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      void backend.feed.jumpBackIn().then(
        (r) => live && setJumpBackIn(r.collections.map((c) => toStudioCollection(c))),
        () => {}
      );
      void backend.feed.newReleases().then(
        (r) => live && setNewReleases(absorb(r.items.map((i) => i.track))),
        () => {}
      );
      void backend.feed.youMightLike().then(
        (r) => live && setYouMightLike(absorb(r.items.map((i) => i.track))),
        () => {}
      );
      void backend.me.stats(tz).then(
        (s) => live && setStats(toStudioStats(s)),
        () => {}
      );
      void backend.me.recents().then(
        (r) => {
          if (!live) return;
          absorb(r.items.map((i) => i.track).filter((t): t is Track => t !== null));
          setRecents(toStudioHistory(r.items, Date.now()));
        },
        () => {}
      );
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbUser]);

  // ---- playback ----------------------------------------------------------
  const flushEvent = useCallback(() => {
    const t = nowPlaying;
    if (!t || listenedRef.current < 1) return;
    void backend.events.ingest([
      {
        trackId: t.id,
        collectionId: playingCollection?.id ?? null,
        listenedSec: Math.floor(listenedRef.current),
        startedAt: startedAtRef.current,
        source: playingCollection ? "collection" : "library",
        clientHourOfDay: new Date().getHours(),
      },
    ]);
    listenedRef.current = 0;
  }, [backend, nowPlaying, playingCollection]);

  const startTrack = useCallback((index: number) => {
    setCurrentIndex(index);
    setProgressSec(0);
    setIsLoading(true);
    setIsPlaying(true);
    startedAtRef.current = Date.now();
    listenedRef.current = 0;
  }, []);

  const play = useCallback(
    async (track: MockTrack, from?: MockCollection) => {
      flushEvent();
      let q: MockTrack[];
      if (from) {
        // resolve the collection's tracks to real objects
        const resolved = await Promise.all(
          from.trackIds.map((id) => backend.catalog.track(id).catch(() => null))
        );
        q = absorb(resolved.filter((t): t is Track => t !== null));
      } else {
        q = [track];
      }
      const idx = q.findIndex((t) => t.id === track.id);
      setPlayingCollection(from ?? null);
      setQueue(q.length ? q : [track]);
      setNavDirection(null);
      startTrack(idx >= 0 ? idx : 0);
    },
    [backend, absorb, flushEvent, startTrack]
  );

  const toggle = useCallback(() => setIsPlaying((p) => (nowPlaying ? !p : p)), [nowPlaying]);
  const next = useCallback(() => {
    flushEvent();
    setCurrentIndex((i) => (i < 0 || !queue.length ? i : (i + 1) % queue.length));
    setNavDirection("next");
    setProgressSec(0);
    setIsPlaying(true);
    startedAtRef.current = Date.now();
    listenedRef.current = 0;
  }, [queue.length, flushEvent]);
  const prev = useCallback(() => {
    flushEvent();
    setCurrentIndex((i) =>
      i < 0 || !queue.length ? i : (i - 1 + queue.length) % queue.length
    );
    setNavDirection("prev");
    setProgressSec(0);
    setIsPlaying(true);
    startedAtRef.current = Date.now();
    listenedRef.current = 0;
  }, [queue.length, flushEvent]);

  const playerRef = useRef<{ seekTo: (s: number) => void } | null>(null);
  const seek = useCallback(
    (sec: number) => {
      const max = nowPlaying?.durationSec ?? 0;
      const clamped = Math.min(max, Math.max(0, Math.floor(sec)));
      setProgressSec(clamped);
      playerRef.current?.seekTo(clamped);
    },
    [nowPlaying]
  );

  const setVolume = useCallback((v: number) => {
    const c = Math.min(1, Math.max(0, v));
    if (c > 0) preMute.current = c;
    setVolumeState(c);
  }, []);
  const toggleMute = useCallback(
    () => setVolumeState((v) => (v > 0 ? 0 : preMute.current)),
    []
  );

  // persist playback state, throttled to ~10s
  useEffect(() => {
    if (!nowPlaying) return;
    const id = setInterval(() => {
      void backend.me.playback.save({
        trackId: nowPlaying.id,
        queue: queue.map((t) => t.id),
        queueIndex: currentIndex,
        positionSec: progressSec,
        isPlaying,
        volume,
      });
    }, 10000);
    return () => clearInterval(id);
  }, [backend, nowPlaying, queue, currentIndex, progressSec, isPlaying, volume]);

  // ---- search ------------------------------------------------------------
  const search = useCallback(
    (query: string) => {
      setHasSearched(true);
      setSearching(true);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(async () => {
        // Catalogue (YouTube) and the caller's own library are separate
        // surfaces on the Search screen, so both are fetched.
        const [cat, lib] = await Promise.allSettled([
          backend.catalog.search(query, "song"),
          backend.me.library(query),
        ]);
        setSearchResults(
          cat.status === "fulfilled" ? absorb(cat.value.tracks) : []
        );
        setCollectionResults(
          lib.status === "fulfilled"
            ? lib.value.collections.map((c) => toStudioCollection(c))
            : []
        );
        setSearching(false);
      }, 550);
    },
    [backend, absorb]
  );
  const clearSearch = useCallback(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearchResults([]);
    setCollectionResults([]);
    setSearching(false);
    setHasSearched(false);
  }, []);

  // ---- library mutations -------------------------------------------------
  const isLiked = useCallback((trackId: string) => likedIds.has(trackId), [likedIds]);
  const toggleLike = useCallback(
    (trackId: string) => {
      const wasLiked = likedIds.has(trackId);
      setLikedIds((s) => {
        const n = new Set(s);
        if (wasLiked) n.delete(trackId);
        else n.add(trackId);
        return n;
      });
      void backend.me.setTrackState(trackId, { isLiked: !wasLiked }).then(refreshLibrary);
    },
    [backend, likedIds, refreshLibrary]
  );

  const togglePin = useCallback(
    (id: string) => {
      const wasPinned = pinnedIds.has(id);
      setPinnedIds((s) => {
        const n = new Set(s);
        if (wasPinned) n.delete(id);
        else n.add(id);
        return n;
      });
      setCollections((cs) =>
        cs.map((c) => (c.id === id ? { ...c, pinned: !wasPinned } : c))
      );
      void backend.me.setPin(id, { isPinned: !wasPinned });
    },
    [backend, pinnedIds]
  );

  const toggleTrackInCollection = useCallback(
    (collectionId: string, trackId: string) => {
      const c = collections.find((x) => x.id === collectionId);
      const has = c?.trackIds.includes(trackId);
      const op = has
        ? backend.collections.removeTrack(collectionId, trackId)
        : backend.collections.addTrack(collectionId, trackId);
      void op.then(refreshLibrary);
    },
    [backend, collections, refreshLibrary]
  );
  const addTrackToCollection = useCallback(
    (collectionId: string, trackId: string) => {
      void backend.collections.addTrack(collectionId, trackId).then(refreshLibrary);
    },
    [backend, refreshLibrary]
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
      // optimistic local object; the server issues the real id asynchronously
      const optimistic: MockCollection = {
        id: `pending-${crypto.randomUUID()}`,
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
      setCollections((cs) => [...cs, optimistic]);
      void backend.collections
        .create({
          title: input.title,
          description: input.desc,
          tags: input.tags,
          contentType: input.kind,
          texture: input.texture,
          cover: input.cover,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          trackIds: input.trackIds,
        } as any)
        .then(refreshLibrary);
      return optimistic;
    },
    [backend, refreshLibrary]
  );

  const signIn = useCallback(() => void fbSignIn("google"), []);
  const signOut = useCallback(() => void signOutUser(), []);

  const value: MockStudioValue = useMemo(
    () => ({
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
      jumpBackIn,
      newReleases,
      youMightLike,
      collectionResults,
      stats,
      recents,
      playerExpanded,
      volume,
      setVolume,
      muted: volume === 0,
      toggleMute,
      setPlayerExpanded,
    }),
    [
      queue, playingCollection, navDirection, nowPlaying, isPlaying, isLoading,
      progressSec, play, toggle, next, prev, seek, user, signIn, signOut,
      searchResults, searching, hasSearched, search, clearSearch, collections,
      libraryFilter, togglePin, isLiked, toggleLike, toggleTrackInCollection,
      addTrackToCollection, createCollection, playerExpanded, volume, setVolume,
      toggleMute, jumpBackIn, newReleases, youMightLike, collectionResults,
      stats, recents,
    ]
  );

  return (
    <MockStudioContext.Provider value={value}>
      {children}
      {/* Hidden real audio: the vinyl UI is decorative; sound comes from here. */}
      {nowPlaying && (
        <div style={{ position: "fixed", width: 0, height: 0, overflow: "hidden" }}>
          <ReactPlayer
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ref={playerRef as any}
            url={`https://www.youtube.com/watch?v=${nowPlaying.id}`}
            playing={isPlaying}
            volume={volume}
            onReady={() => setIsLoading(false)}
            onStart={() => setIsLoading(false)}
            onProgress={(s: { playedSeconds: number }) => {
              setProgressSec(Math.floor(s.playedSeconds));
              listenedRef.current = s.playedSeconds;
            }}
            onEnded={() => next()}
            width="1px"
            height="1px"
          />
        </div>
      )}
    </MockStudioContext.Provider>
  );
}
