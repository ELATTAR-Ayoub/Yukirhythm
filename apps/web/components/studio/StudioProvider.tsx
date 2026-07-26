"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

import {
  MockStudioContext,
  type CreateStudioCollectionInput,
  type MockStudioValue,
} from "@/components/studio/screens/MockStudioProvider";
import type {
  MockCollection,
  MockTrack,
  MockUser,
} from "@/components/studio/screens/mock-data";
import type { LibraryFilter } from "@/components/studio/screens/library-utils";
import {
  insertIntoQueue,
  isSameContext,
  joinAdHocQueue,
  removeQueueIndex,
  restoreOrder,
  shuffleOrder,
  type EnqueueMode,
} from "@/components/studio/screens/queue-utils";
import { registerStudioTracks } from "@/components/studio/screens/mock-data";
import {
  useAuthState,
  signIn as fbSignIn,
  signOutUser,
} from "@/lib/studio/useAuth";
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
import type { SeekablePlayer } from "@/components/studio/screens/HiddenYouTubePlayer";

// react-player pulls in browser-only globals; load it client-side only. The
// wrapper takes the seek ref as a plain prop — see HiddenYouTubePlayer.
const HiddenYouTubePlayer = dynamic(
  () => import("@/components/studio/screens/HiddenYouTubePlayer"),
  { ssr: false }
);

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
  const [libraryFilter, setLibraryFilter] =
    useState<LibraryFilter>("playlists");
  const [libraryLoading, setLibraryLoading] = useState(true);

  // playback
  const [queue, setQueue] = useState<MockTrack[]>([]);
  const [playingCollection, setPlayingCollection] =
    useState<MockCollection | null>(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progressSec, setProgressSec] = useState(0);
  const [navDirection, setNavDirection] = useState<"next" | "prev" | null>(
    null
  );
  const [shuffled, setShuffled] = useState(false);
  /** The order the queue was in right before shuffle was turned on — restored
   *  verbatim (minus anything dequeued meanwhile) when it's turned back off.
   *  Meaningful only while `shuffled` is true. */
  const preShuffleOrderRef = useRef<MockTrack[] | null>(null);
  const [playerExpanded, setPlayerExpanded] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const preMute = useRef(1);
  const startedAtRef = useRef<number>(0);
  const listenedRef = useRef<number>(0);
  /** Set once by the sign-in restore below; consumed by the hidden player's
   *  onReady so a resumed session continues from the saved position instead
   *  of 0:00. Target-aware (tagged with the track it belongs to) because
   *  react-player re-fires onReady on every track change, not just once for
   *  the restored track — an untagged ref would re-apply a stale seek onto
   *  whatever track happens to be current when onReady next fires. */
  const pendingSeekRef = useRef<{ trackId: string; sec: number } | null>(null);
  /** Guards the volume-persistence effect further down: true across its very
   *  first run (nothing to save yet) AND right after sign-in restore sets
   *  volume from a saved session (that value is already on the server — no
   *  need to echo it straight back). */
  const skipNextVolumeSaveRef = useRef(true);
  /** Flips true the moment the user starts playback themselves (startTrack).
   *  The sign-in restore reads this right before it writes anything, so a
   *  restore that lands late — after the user already picked their own song
   *  — yields instead of clobbering an active session. */
  const userStartedRef = useRef(false);

  // search
  const [searchResults, setSearchResults] = useState<MockTrack[]>([]);
  const [collectionResults, setCollectionResults] = useState<MockCollection[]>(
    []
  );
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // feeds + profile data
  const [jumpBackIn, setJumpBackIn] = useState<MockCollection[]>([]);
  const [newReleases, setNewReleases] = useState<MockTrack[]>([]);
  const [youMightLike, setYouMightLike] = useState<MockTrack[]>([]);
  const [stats, setStats] = useState<MockStats | null>(null);
  const [recents, setRecents] = useState<MockHistoryEntry[]>([]);
  const [feedsLoading, setFeedsLoading] = useState(true);

  const nowPlaying = currentIndex >= 0 ? (queue[currentIndex] ?? null) : null;

  /** Register tracks so the screens' getTrack/getCollectionTracks resolve them. */
  const absorb = useCallback((tracks: Track[]) => {
    const mocks = tracks.map(toStudioTrack);
    registerStudioTracks(mocks);
    return mocks;
  }, []);

  /** Resolve track ids to real catalogue tracks and absorb them, silently
   *  dropping any that fail to fetch. Shared by play() (a queue built from a
   *  collection's trackIds) and the sign-in restore below (a queue built from
   *  persisted playback) — same resolution, two different sources of ids. */
  const resolveTrackIds = useCallback(
    async (ids: string[]): Promise<MockTrack[]> => {
      const resolved = await Promise.all(
        ids.map((id) => backend.catalog.track(id).catch(() => null))
      );
      return absorb(resolved.filter((t): t is Track => t !== null));
    },
    [backend, absorb]
  );

  // ---- load the user + library on sign-in --------------------------------
  const refreshLibrary = useCallback(async () => {
    // allSettled, not all: these are independent reads, and the Liked Songs
    // endpoint needs a composite index that is not deployed yet. One rejection
    // used to throw out of here, out of the sign-in effect above it, and leave
    // the user with NO library and libraryLoading stuck true.
    const [ownedRes, likedRes] = await Promise.allSettled([
      backend.collections.list(),
      backend.me.likes(),
    ]);

    const likedTracks =
      likedRes.status === "fulfilled" ? likedRes.value.tracks : [];
    absorb(likedTracks);
    const likedSet = new Set(likedTracks.map((t) => t.trackId));
    setLikedIds(likedSet);

    // Every user always has Liked Songs, even when the likes call itself
    // failed — it just starts empty rather than not existing at all.
    const likedCollection: MockCollection = {
      id: LIKED_ID,
      title: "Liked Songs",
      desc: "Everything you liked.",
      texture: "tx-k2-vinyl",
      trackIds: likedTracks.map((t) => t.trackId),
      likes: 0,
      tags: ["liked"],
      kind: "music",
      system: true,
      pinned: true,
    };
    const owns =
      ownedRes.status === "fulfilled"
        ? ownedRes.value.map((c) =>
            toStudioCollection(c, { pinned: pinnedIds.has(c.collectionId) })
          )
        : [];
    setCollections([likedCollection, ...owns]);
  }, [backend, absorb, pinnedIds]);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!fbUser) {
        setUser(null);
        setCollections([]);
        setLibraryLoading(false);
        setFeedsLoading(false);
        return;
      }
      setFeedsLoading(true);
      try {
        // ensure the user doc exists, then load it
        const provider = fbUser.providerData[0]?.providerId?.includes(
          "facebook"
        )
          ? "facebook"
          : "google";
        await backend.me.ensure({
          displayName: fbUser.displayName ?? "",
          email: fbUser.email ?? "",
          avatarUrl: fbUser.photoURL ?? null,
          authProvider: provider,
        });
        const me = await backend.me.get();
        if (!live || !me) {
          // Bail-out without the feeds section below — the skeleton must not
          // pulse forever on a user doc that failed to load.
          if (live) setFeedsLoading(false);
          return;
        }
        setUser(toStudioUser(me));
        await refreshLibrary();
      } catch (err) {
        // ensure()/get() failing is rarer than the likes/collections reads
        // (already hardened above via allSettled) but must not leave the
        // sign-in effect throwing out from under the finally below either.
        console.error("Failed to load user/library", err);
      } finally {
        // Must run on every path — success, thrown error, or early return
        // above — so the user is never left staring at a stuck loading state.
        if (live) setLibraryLoading(false);
      }

      // Feeds and profile data. Each is independent — one failing rail must
      // not blank the others, so they settle separately. Failures are logged:
      // a silently-empty shelf is indistinguishable from a broken feed.
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const warn = (name: string) => (err: unknown) =>
        console.warn(`Feed load failed: ${name}`, err);

      // Restore the session that was playing before the reload. Deliberately
      // independent of the feed fetches below — a failed read here must not
      // affect user/collections/feeds, so it gets its own catch and nothing
      // else.
      void backend.me.playback
        .get()
        .then(async (state) => {
          if (!live || !state) return;
          // Nothing was ever playing (fresh account, or an already-empty
          // saved state) — leave the player cold rather than "restoring" a
          // no-op.
          const ids = state.queue?.length
            ? state.queue
            : state.trackId
              ? [state.trackId]
              : [];
          if (ids.length === 0) return;

          const resolved = await resolveTrackIds(ids);
          if (!live) return;
          // Every id failed to resolve (e.g. deleted/unembeddable videos) —
          // restore nothing rather than seat the player on an empty queue.
          if (resolved.length === 0) return;
          // The user may have started playing something themselves while
          // this read was in flight. `currentIndex` in THIS closure is
          // always the effect's original -1 (the sign-in effect only re-runs
          // on [fbUser], so this async continuation never sees a fresher
          // render) — a live ref is the only way to see a start that
          // happened after this effect was created. A late restore must
          // yield, not clobber an active session.
          if (userStartedRef.current) return;

          // Prefer landing on the exact saved track: queue ids can fail to
          // resolve (deleted/unembeddable videos), which shifts every index
          // after the gap — a raw range-clamp of the saved queueIndex could
          // then land on a completely different track. Only fall back to
          // the (clamped) saved index when the saved track itself didn't
          // survive resolution.
          const byTrackId = state.trackId
            ? resolved.findIndex((t) => t.id === state.trackId)
            : -1;
          const savedIndex = state.queueIndex ?? -1;
          const finalIndex =
            byTrackId >= 0
              ? byTrackId
              : savedIndex >= 0 && savedIndex < resolved.length
                ? savedIndex
                : 0;

          setQueue(resolved);
          setCurrentIndex(finalIndex);
          setProgressSec(state.positionSec ?? 0);
          // Target-aware: onReady fires again on every track change
          // (react-player re-cues), not just once for the restored track.
          // Tagging the seek with the track it belongs to means a later,
          // unrelated track change (next(), prev(), a fresh play()) can
          // never inherit this stale position.
          const restoredTrackId = resolved[finalIndex]?.id;
          if (restoredTrackId) {
            pendingSeekRef.current = {
              trackId: restoredTrackId,
              sec: state.positionSec ?? 0,
            };
          }
          const restoredVolume = Math.min(1, Math.max(0, state.volume ?? 1));
          setVolumeState((v) => {
            // Only arm the skip if this actually changes anything.
            // setVolumeState bails out (no re-render, no effect run) when
            // the value is unchanged — arming unconditionally would leave
            // the flag stuck "on" until the user's NEXT real change, which
            // would then be the one silently dropped instead of this no-op.
            if (v !== restoredVolume) skipNextVolumeSaveRef.current = true;
            return restoredVolume;
          });
          // A restored 0 should still unmute to something audible later, so
          // preMute is only updated on an audible restore — leave it at its
          // default otherwise.
          if (restoredVolume > 0) preMute.current = restoredVolume;
          // Restored PAUSED, never playing: browsers block un-gestured audio
          // autoplay, and a player that claims "playing" while the audio is
          // actually blocked is worse than an honest paused one. The user
          // presses play to actually start sound, from pendingSeekRef's
          // position rather than 0:00.
        })
        .catch((err) => console.warn("Playback restore failed", err));

      void backend.feed
        .jumpBackIn()
        .then(
          (r) =>
            live &&
            setJumpBackIn(r.collections.map((c) => toStudioCollection(c))),
          warn("jump-back-in")
        );
      const shelfFeeds = [
        backend.feed.newReleases().then((r) => {
          if (live) setNewReleases(absorb(r.items.map((i) => i.track)));
        }),
        backend.feed.youMightLike().then((r) => {
          if (live) setYouMightLike(absorb(r.items.map((i) => i.track)));
        }),
      ] as const;
      void Promise.allSettled(shelfFeeds).then((results) => {
        results.forEach((r, i) => {
          if (r.status === "rejected")
            warn(i === 0 ? "new-releases" : "you-might-like")(r.reason);
        });
        // Cleared on success AND failure — a dead feed shows its empty state,
        // never a skeleton that pulses forever.
        if (live) setFeedsLoading(false);
      });
      void backend.me
        .stats(tz)
        .then((s) => live && setStats(toStudioStats(s)), warn("stats"));
      void backend.me.recents().then((r) => {
        if (!live) return;
        absorb(
          r.items.map((i) => i.track).filter((t): t is Track => t !== null)
        );
        setRecents(toStudioHistory(r.items, Date.now()));
      }, warn("recents"));
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
    // Marks that the user (not the sign-in restore) owns playback from here
    // on — a restore landing later must yield rather than clobber this.
    userStartedRef.current = true;
    // A pending restore-seek belongs to whichever track was current when
    // sign-in restored the session. Starting a different track (before the
    // hidden player for the restored one ever fired onReady) must not carry
    // that stale seek target over onto the new one. (onReady's own trackId
    // check below covers next()/prev(), which don't call startTrack.)
    pendingSeekRef.current = null;
  }, []);

  const playAt = useCallback(
    (index: number) => {
      if (index < 0 || index >= queue.length) return;
      flushEvent();
      setNavDirection(null);
      startTrack(index);
    },
    [queue.length, flushEvent, startTrack]
  );

  const play = useCallback(
    async (track: MockTrack, from?: MockCollection) => {
      // Clicking a row in the queue you are already inside must not rebuild
      // that queue — everything enqueued from the rail lives only there. See
      // isSameContext for why `from` omitted (Search, Home) never counts.
      const at = queue.findIndex((t) => t.id === track.id);
      if (isSameContext(from, playingCollection) && at >= 0) {
        flushEvent();
        setNavDirection(null);
        startTrack(at);
        return;
      }

      // A loose play (no `from`) while the user's own ad-hoc queue is running
      // (no collection context) JOINS that queue instead of wiping it —
      // already-queued track gets a jump, not a duplicate; otherwise it lands
      // on the end. A collection playing, or a genuinely cold queue, falls
      // through to the replace-with-a-fresh-queue branch below unchanged.
      if (!from && playingCollection === null && queue.length > 0) {
        const joined = joinAdHocQueue(queue, track);
        const appended = joined.index === queue.length;
        flushEvent();
        if (appended) registerStudioTracks([track]);
        setQueue(joined.queue);
        setNavDirection(null);
        startTrack(joined.index);
        if (appended) {
          // Best-effort, same as enqueue: a failed write must not undo the
          // queue the user is looking at, and the next save() flush re-sends
          // the whole list.
          void backend.me.playback.enqueue(track.id, "end").catch(() => {});
        }
        return;
      }

      flushEvent();
      const q = from ? await resolveTrackIds(from.trackIds) : [track];
      const idx = q.findIndex((t) => t.id === track.id);
      setPlayingCollection(from ?? null);
      setQueue(q.length ? q : [track]);
      setNavDirection(null);
      startTrack(idx >= 0 ? idx : 0);
      // A genuinely fresh queue invalidates whatever shuffle was doing to the
      // PREVIOUS one — leaving it on here would show "shuffled" active over
      // an order that was never actually shuffled.
      if (shuffled) {
        setShuffled(false);
        preShuffleOrderRef.current = null;
      }
    },
    [
      resolveTrackIds,
      flushEvent,
      startTrack,
      playingCollection,
      queue,
      backend,
      shuffled,
    ]
  );

  const dequeue = useCallback(
    (index: number) => {
      // Flush first, same as playAt/play/next/prev: if the removed slot is
      // the one playing, its accumulated listened-seconds must land under the
      // track that earned them, not vanish or get attributed to whatever
      // nowPlaying resolves to afterward.
      flushEvent();
      const removedId = queue[index]?.id;
      const result = removeQueueIndex(queue, currentIndex, index);
      setQueue(result.queue);
      setCurrentIndex(result.currentIndex);
      // Dropping the same slot from the remembered pre-shuffle order too —
      // otherwise turning shuffle back off would resurrect a track the user
      // just removed.
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
      // Best-effort, same as enqueue: a failed write must not resurrect a row
      // the user just removed, and the next save() flush re-sends the list.
      void backend.me.playback.removeFromQueue(index).catch(() => {});
    },
    [backend, flushEvent, queue, currentIndex, shuffled]
  );

  /**
   * Add to the running queue. Local state moves first so the rail updates on
   * the click, and the same splice is persisted server-side so the queue
   * survives a reload. Nothing starts playing: the user asked for this track
   * later, not now.
   */
  const enqueue = useCallback(
    (track: MockTrack, mode: EnqueueMode = "end") => {
      registerStudioTracks([track]);
      setQueue((q) => insertIntoQueue(q, track, mode, currentIndex));
      // Best-effort persistence — a failed write must not undo the queue the
      // user is looking at, and the next save() flush re-sends the whole list.
      void backend.me.playback.enqueue(track.id, mode).catch(() => {});
    },
    [backend, currentIndex]
  );

  const toggle = useCallback(
    () => setIsPlaying((p) => (nowPlaying ? !p : p)),
    [nowPlaying]
  );
  const next = useCallback(() => {
    flushEvent();
    // The wrap IS the point: onEnded() calls next() with nothing else
    // special-cased, so a finished queue — shuffled or not — restarts from
    // the top instead of stopping dead at the last track.
    setCurrentIndex((i) =>
      i < 0 || !queue.length ? i : (i + 1) % queue.length
    );
    setNavDirection("next");
    setProgressSec(0);
    setIsPlaying(true);
    startedAtRef.current = Date.now();
    listenedRef.current = 0;
  }, [queue.length, flushEvent]);

  const playerRef = useRef<SeekablePlayer | null>(null);
  const seek = useCallback(
    (sec: number) => {
      const max = nowPlaying?.durationSec ?? 0;
      const clamped = Math.min(max, Math.max(0, Math.floor(sec)));
      setProgressSec(clamped);
      playerRef.current?.seekTo(clamped);
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
    flushEvent();
    setCurrentIndex((i) => (i <= 0 ? i : i - 1));
    setNavDirection("prev");
    setProgressSec(0);
    setIsPlaying(true);
    startedAtRef.current = Date.now();
    listenedRef.current = 0;
  }, [flushEvent, progressSec, seek]);

  /**
   * Enable: remember today's order, Fisher–Yates the rest with whatever is
   * currently playing pinned to the front — playback itself never
   * interrupts (no startTrack, index/queue only). Disable: restore the
   * remembered order, dropping anything dequeued in the meantime, and
   * re-derive the playhead by the id that's actually playing (not the
   * carried-over index — the same track can sit at a different slot in
   * either order).
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
      flushEvent();
      registerStudioTracks(tracks);
      const result = shuffleOrder(tracks, -1, Math.random);
      preShuffleOrderRef.current = tracks;
      setPlayingCollection(from ?? null);
      setQueue(result.queue);
      setNavDirection(null);
      setShuffled(true);
      startTrack(0);
    },
    [flushEvent, startTrack]
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

  // Latest playback snapshot for the persistence interval below. The interval
  // must NOT list fast-changing state (progressSec ticks ~1s) in its own deps
  // — that tore the timer down and recreated it on every tick, so the "10s"
  // save only actually fired when ticks stalled (throttled tab, buffering).
  // The interval reads this ref instead; the no-deps effect keeps it current
  // on every render.
  const persistSnapshotRef = useRef({
    nowPlaying,
    queue,
    currentIndex,
    progressSec,
    isPlaying,
    volume,
  });
  useEffect(() => {
    persistSnapshotRef.current = {
      nowPlaying,
      queue,
      currentIndex,
      progressSec,
      isPlaying,
      volume,
    };
  });

  // Persist playback state, throttled to ~10s. Keyed on "is a track loaded"
  // alone so the timer survives progress ticks and track changes. Note: a
  // restored session sets nowPlaying (queue/currentIndex) with isPlaying
  // false, so this interval starts right back up and saves that same restored
  // state again — harmless and idempotent, not a fight with the restore.
  const hasTrack = nowPlaying !== null;
  useEffect(() => {
    if (!hasTrack) return;
    const id = setInterval(() => {
      const s = persistSnapshotRef.current;
      if (!s.nowPlaying) return;
      void backend.me.playback.save({
        trackId: s.nowPlaying.id,
        queue: s.queue.map((t) => t.id),
        queueIndex: s.currentIndex,
        positionSec: s.progressSec,
        isPlaying: s.isPlaying,
        volume: s.volume,
      });
    }, 10000);
    return () => clearInterval(id);
  }, [backend, hasTrack]);

  // Persist a volume change on its own, debounced ~1s. The interval above
  // only runs `if (nowPlaying)`, so a volume tweak made with nothing loaded
  // (or right after a track ends) would otherwise never reach the server.
  // `trackId: null` here is valid — the PUT route (app/api/me/playback/
  // route.ts) explicitly accepts a null trackId — so this saves the full
  // current snapshot, not volume in isolation.
  useEffect(() => {
    if (skipNextVolumeSaveRef.current) {
      // Covers both the initial mount (nothing to save yet) and the moment
      // sign-in restore just set this same value from the server — either
      // way, nothing here needs writing back.
      skipNextVolumeSaveRef.current = false;
      return;
    }
    const id = setTimeout(() => {
      void backend.me.playback
        .save({
          trackId: nowPlaying?.id ?? null,
          queue: queue.map((t) => t.id),
          queueIndex: currentIndex,
          positionSec: progressSec,
          isPlaying,
          volume,
        })
        .catch((err) => console.warn("Volume persist failed", err));
    }, 1000);
    return () => clearTimeout(id);
    // Deliberately only `volume` — this effect debounces volume changes
    // specifically. nowPlaying/queue/etc. are read as a snapshot of
    // "whatever else is true right now", the same as the 10s interval above;
    // listing them here would re-debounce on every seek/track-change too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume]);

  // ---- search ------------------------------------------------------------
  // Monotonic ticket: a stale response (or one landing after a clear) must
  // not overwrite newer state. This replaces the old 550ms keystroke
  // debounce — search now only fires on an explicit submit, so delaying it
  // would be pure latency.
  const searchSeq = useRef(0);
  const search = useCallback(
    (query: string) => {
      setHasSearched(true);
      setSearching(true);
      const seq = ++searchSeq.current;
      void (async () => {
        // Catalogue (YouTube) and the caller's own library are separate
        // surfaces on the Search screen, so both are fetched.
        const [cat, lib] = await Promise.allSettled([
          backend.catalog.search(query, "song"),
          backend.me.library(query),
        ]);
        if (seq !== searchSeq.current) return;
        setSearchResults(
          cat.status === "fulfilled" ? absorb(cat.value.tracks) : []
        );
        setCollectionResults(
          lib.status === "fulfilled"
            ? lib.value.collections.map((c) => toStudioCollection(c))
            : []
        );
        setSearching(false);
      })();
    },
    [backend, absorb]
  );
  /** Catalogue lookup that returns rather than publishes — see the context
   *  docs. Failures come back as no matches; a rail-side field is not the
   *  place to surface a network error banner. */
  const searchTracks = useCallback(
    async (query: string): Promise<MockTrack[]> => {
      const q = query.trim();
      if (!q) return [];
      try {
        const res = await backend.catalog.search(q, "song");
        return absorb(res.tracks);
      } catch {
        return [];
      }
    },
    [backend, absorb]
  );

  const clearSearch = useCallback(() => {
    searchSeq.current++;
    setSearchResults([]);
    setCollectionResults([]);
    setSearching(false);
    setHasSearched(false);
  }, []);

  // ---- library mutations -------------------------------------------------
  const isLiked = useCallback(
    (trackId: string) => likedIds.has(trackId),
    [likedIds]
  );
  const toggleLike = useCallback(
    (trackId: string) => {
      const wasLiked = likedIds.has(trackId);
      setLikedIds((s) => {
        const n = new Set(s);
        if (wasLiked) n.delete(trackId);
        else n.add(trackId);
        return n;
      });
      // Update the Liked Songs collection itself, not just the likedIds set,
      // so the playlist reflects the like on the click rather than after the
      // round-trip to the server and back through refreshLibrary. The
      // endpoint returns newest-first, so a newly liked track goes to the
      // front here too.
      setCollections((cs) =>
        cs.map((c) =>
          c.id === LIKED_ID
            ? {
                ...c,
                trackIds: wasLiked
                  ? c.trackIds.filter((id) => id !== trackId)
                  : [trackId, ...c.trackIds.filter((id) => id !== trackId)],
              }
            : c
        )
      );
      void backend.me
        .setTrackState(trackId, { isLiked: !wasLiked })
        .then(refreshLibrary);
    },
    [backend, likedIds, refreshLibrary]
  );

  const togglePin = useCallback(
    (id: string) => {
      // Liked Songs is permanent: nothing can unpin it, no matter what calls in.
      if (id === LIKED_ID) return;
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
      void backend.collections
        .addTrack(collectionId, trackId)
        .then(refreshLibrary);
    },
    [backend, refreshLibrary]
  );

  const createCollection = useCallback(
    (input: CreateStudioCollectionInput): MockCollection => {
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
          trackIds: input.trackIds,
        } as any)
        .then((persisted) => {
          // Replace this exact optimistic row with the POST response. A full
          // list refresh here raced Firestore visibility for some users and
          // could temporarily remove the pending row while its detail route
          // was already open, producing "Collection not found".
          const created = toStudioCollection(persisted);
          setCollections((current) =>
            current.map((collection) =>
              collection.id === optimistic.id ? created : collection
            )
          );
        });
      return optimistic;
    },
    [backend]
  );
  const createCollectionAsync = useCallback(
    async (input: CreateStudioCollectionInput): Promise<MockCollection> => {
      const persisted = await backend.collections.create({
        title: input.title,
        description: input.desc,
        tags: input.tags,
        contentType: input.kind,
        texture: input.texture,
        cover: input.cover,
        trackIds: input.trackIds,
      } as any);
      const created = toStudioCollection(persisted);
      setCollections((current) => [
        ...current.filter((collection) => collection.id !== created.id),
        created,
      ]);
      return created;
    },
    [backend]
  );

  // Defaults to google so any caller that omits the argument (there are
  // none left post-fix, but the type stays optional-arg compatible with the
  // mock provider) still gets a sane popup rather than a runtime crash.
  const signIn = useCallback(
    (provider: "google" | "facebook" = "google") => void fbSignIn(provider),
    []
  );
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
      libraryLoading,
      libraryFilter,
      setLibraryFilter,
      togglePin,
      isLiked,
      toggleLike,
      toggleTrackInCollection,
      addTrackToCollection,
      createCollection,
      createCollectionAsync,
      jumpBackIn,
      newReleases,
      youMightLike,
      feedsLoading,
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
      libraryLoading,
      libraryFilter,
      togglePin,
      isLiked,
      toggleLike,
      toggleTrackInCollection,
      addTrackToCollection,
      createCollection,
      createCollectionAsync,
      playerExpanded,
      volume,
      setVolume,
      toggleMute,
      jumpBackIn,
      newReleases,
      youMightLike,
      feedsLoading,
      collectionResults,
      stats,
      recents,
    ]
  );

  return (
    <MockStudioContext.Provider value={value}>
      {children}
      {/* Hidden real audio: the vinyl UI is decorative; sound comes from here. */}
      {nowPlaying && (
        <div
          style={{ position: "fixed", width: 0, height: 0, overflow: "hidden" }}
        >
          <HiddenYouTubePlayer
            playerRef={playerRef}
            url={`https://www.youtube.com/watch?v=${nowPlaying.id}`}
            playing={isPlaying}
            volume={volume}
            onReady={() => {
              setIsLoading(false);
              // react-player re-fires onReady on every track change
              // (cueVideoById -> CUED -> onReady), not just once for the
              // track the seek was meant for — so this only applies it when
              // it still targets whatever is actually current now. A
              // mismatch means the target track isn't playing anymore; the
              // seek is dead either way, so it's cleared regardless.
              const pending = pendingSeekRef.current;
              if (pending) {
                if (pending.trackId === nowPlaying?.id) {
                  playerRef.current?.seekTo(pending.sec);
                }
                pendingSeekRef.current = null;
              }
            }}
            onStart={() => setIsLoading(false)}
            onProgress={(s) => {
              setProgressSec(Math.floor(s.playedSeconds));
              listenedRef.current = s.playedSeconds;
            }}
            onEnded={() => next()}
          />
        </div>
      )}
    </MockStudioContext.Provider>
  );
}
