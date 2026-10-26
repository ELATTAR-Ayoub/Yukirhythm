"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { StudioIdentity as FirebaseUser } from "@/lib/studio/useAuth";
import { toast } from "sonner";

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
import { previewStartForTrack } from "@/components/studio/screens/mock-data";
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
  initialsOf,
  toStudioCollection,
  toStudioHistory,
  toStudioTrack,
  toStudioUser,
} from "@/lib/studio/adapt";
import {
  DEFAULT_PRIVACY,
  type UserPrivacy,
  type Track,
} from "@/lib/catalog/model";
import { toStudioStats } from "@/lib/studio/adapt";
import {
  acknowledgeListens,
  clearSavedListens,
  localListeningStats,
  pendingListens,
  savedListens,
  storeListen,
  type LocalListen,
} from "@/lib/studio/browser-history";
import {
  clearCachedStudioFeeds,
  readCachedStudioFeed,
  saveCachedStudioFeed,
} from "@/components/studio/screens/useCachedStudioFeed";
import type {
  MockHistoryEntry,
  MockStats,
} from "@/components/studio/screens/mock-data";
import type { SeekablePlayer } from "@/components/studio/screens/HiddenYouTubePlayer";
import {
  readBrowserPlayback,
  writeBrowserPlayback,
} from "@/lib/studio/browser-playback";

// react-player pulls in browser-only globals; load it client-side only. The
// wrapper takes the seek ref as a plain prop — see HiddenYouTubePlayer.
const HiddenYouTubePlayer = dynamic(
  () => import("@/components/studio/screens/HiddenYouTubePlayer"),
  { ssr: false }
);

const LIKED_ID = "liked";

type ListeningSession = {
  eventId: string;
  startedAt: number;
  listenedSec: number;
  lastPositionSec: number | null;
};

type ListeningEvent = LocalListen;

const MIN_DURABLE_LISTEN_SEC = 5;

function freshListeningSession(
  positionSec: number | null = null
): ListeningSession {
  return {
    eventId: crypto.randomUUID(),
    startedAt: Date.now(),
    listenedSec: 0,
    lastPositionSec: positionSec,
  };
}

function firebaseUserSnapshot(user: FirebaseUser): MockUser {
  const name = user.displayName || user.email || "You";
  return {
    id: user.uid,
    userName: name,
    email: user.email ?? "",
    initials: initialsOf(name),
    followers: 0,
    following: 0,
  };
}

/**
 * The real studio provider: same context the screens consume, backed by the
 * phase 1–7 backend and a real YouTube player. Playback position and play
 * events come from the media element, not a wall-clock ticker.
 */
export default function StudioProvider({
  children,
  authenticatedUser,
  authOnly = false,
}: {
  children: React.ReactNode;
  /**
   * AuthGate can hand its already-settled user directly to the provider. When
   * omitted (the auth page and isolated tests), observe auth here as before.
   */
  authenticatedUser?: FirebaseUser | null;
  authOnly?: boolean;
}) {
  const { user: observedFbUser } = useAuthState();
  const fbUser =
    authenticatedUser === undefined ? observedFbUser : authenticatedUser;
  const backend = useBackend(fbUser?.uid);

  const [user, setUser] = useState<MockUser | null>(() =>
    fbUser ? firebaseUserSnapshot(fbUser) : null
  );
  const [privacy, setPrivacy] = useState<UserPrivacy>({ ...DEFAULT_PRIVACY });
  const [privacyLoading, setPrivacyLoading] = useState(true);
  const [collections, setCollections] = useState<MockCollection[]>([]);
  const collectionsRef = useRef<MockCollection[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const likedIdsRef = useRef<Set<string>>(new Set());
  const pendingLikesRef = useRef(new Set<string>());
  const likeWritesRef = useRef(
    new Map<
      string,
      { confirmed: boolean; desired: boolean; task: Promise<void> }
    >()
  );
  const likesRevisionRef = useRef(0);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const pendingPinsRef = useRef(new Set<string>());
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
  const [playerEpoch, setPlayerEpoch] = useState(0);
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
  const listeningRef = useRef<ListeningSession | null>(null);
  /** Set once by the sign-in restore below; consumed by the hidden player's
   *  onReady so a resumed session continues from the saved position instead
   *  of 0:00. Target-aware (tagged with the track it belongs to) because
   *  react-player re-fires onReady on every track change, not just once for
   *  the restored track — an untagged ref would re-apply a stale seek onto
   *  whatever track happens to be current when onReady next fires. */
  const pendingSeekRef = useRef<{ trackId: string; sec: number } | null>(null);
  /** Flips true the moment the user starts playback themselves (startTrack).
   *  The sign-in restore reads this right before it writes anything, so a
   *  restore that lands late — after the user already picked their own song
   *  — yields instead of clobbering an active session. */
  const userStartedRef = useRef(false);
  /** Identifies the latest user play request. Collection hydration finishes in
   *  the background, so an older request must never replace a queue chosen
   *  while it was still in flight. */
  const playRequestRef = useRef(0);
  /** Loaded with the profile to avoid recording privacy-off sessions locally.
   * The server independently enforces the saved consent on every upload. */
  const saveHistoryRef = useRef(false);
  const feedRevisionRef = useRef(0);

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
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentsLoading, setRecentsLoading] = useState(true);
  const [playbackLoading, setPlaybackLoading] = useState(true);
  const [jumpBackInLoading, setJumpBackInLoading] = useState(true);
  const [newReleasesLoading, setNewReleasesLoading] = useState(true);
  const [youMightLikeLoading, setYouMightLikeLoading] = useState(true);
  const feedsLoading =
    jumpBackInLoading || newReleasesLoading || youMightLikeLoading;

  const nowPlaying = currentIndex >= 0 ? (queue[currentIndex] ?? null) : null;

  useEffect(() => {
    if (!fbUser) return;
    const pending = savedListens(fbUser.uid);
    let live = true;
    queueMicrotask(() => {
      if (!live) return;
      registerStudioTracks(
        pending.flatMap((event) => (event.track ? [event.track] : []))
      );
      setStats(toStudioStats(localListeningStats(pending)));
      setRecents(
        toStudioHistory(
          pending.map((event) => ({
            trackId: event.trackId,
            startedAtMs: event.startedAt,
            collection: event.collectionId
              ? { collectionId: event.collectionId }
              : null,
          })),
          Date.now()
        )
      );
    });
    return () => {
      live = false;
    };
  }, [fbUser]);

  const syncHistory = useCallback(
    function sync(uid: string, keepalive = false) {
      if (!saveHistoryRef.current) return;
      const events = pendingListens(uid).slice(0, 20);
      if (!events.length) return;
      const upload = events.map((event) => ({ ...event, track: undefined }));
      void backend.events
        .ingest(upload, { keepalive })
        .then((result) => {
          if (result.ok) {
            const before = pendingListens(uid).length;
            acknowledgeListens(
              uid,
              new Set(events.map((event) => event.eventId))
            );
            const remaining = pendingListens(uid).length;
            if (!keepalive && remaining > 0 && remaining < before) sync(uid);
          }
        })
        .catch((error) => console.warn("Listening history sync failed", error));
    },
    [backend]
  );

  const updatePrivacy = useCallback(
    async (patch: Partial<UserPrivacy>) => {
      const previous = saveHistoryRef.current;
      if (patch.saveHistory === false) saveHistoryRef.current = false;
      try {
        const updated = await backend.me.update({ privacy: patch });
        setPrivacy({ ...DEFAULT_PRIVACY, ...updated.privacy });
        saveHistoryRef.current = updated.privacy.saveHistory;
        if (patch.saveHistory !== undefined) {
          // Never include seconds heard while consent was off in a later,
          // newly-consented listen.
          listeningRef.current = freshListeningSession();
        }
        if (fbUser) {
          feedRevisionRef.current += 1;
          clearCachedStudioFeeds(fbUser.uid);
          if (!updated.privacy.saveHistory)
            acknowledgeListens(
              fbUser.uid,
              new Set(pendingListens(fbUser.uid).map((e) => e.eventId))
            );
        }
      } catch (error) {
        saveHistoryRef.current = previous;
        throw error;
      }
    },
    [backend, fbUser]
  );

  const clearListeningHistory = useCallback(async () => {
    await backend.me.clearHistory();
    if (fbUser) {
      feedRevisionRef.current += 1;
      clearSavedListens(fbUser.uid);
      clearCachedStudioFeeds(fbUser.uid);
    }
    listeningRef.current = freshListeningSession(progressSec);
    setRecents([]);
    setStats(toStudioStats(localListeningStats([])));
  }, [backend, fbUser, progressSec]);

  /** Register tracks so the screens' getTrack/getCollectionTracks resolve them. */
  const absorb = useCallback((tracks: Track[]) => {
    const mocks = tracks.map((track) => toStudioTrack(track));
    registerStudioTracks(mocks);
    return mocks;
  }, []);

  const absorbFeed = useCallback(
    (items: { track: Track; recommendationId: string }[]) => {
      const mocks = items.map((item) =>
        toStudioTrack(item.track, {
          eventSource: "recommendation",
          recommendationId: item.recommendationId,
        })
      );
      registerStudioTracks(mocks);
      return mocks;
    },
    []
  );

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
    // Independent reads: one unavailable endpoint must not hide the other.
    const likesRevision = likesRevisionRef.current;
    const [ownedRes, likedRes] = await Promise.allSettled([
      backend.collections.list(),
      backend.me.likes(),
    ]);

    const likedTracks =
      likedRes.status === "fulfilled" ? likedRes.value.tracks : [];
    absorb(likedTracks);
    const likedSet = new Set(
      likedRes.status === "fulfilled" &&
        likesRevision === likesRevisionRef.current
        ? likedRes.value.trackIds
        : likedIdsRef.current
    );
    for (const id of pendingLikesRef.current) {
      if (likedIdsRef.current.has(id)) likedSet.add(id);
      else likedSet.delete(id);
    }
    likedIdsRef.current = likedSet;
    setLikedIds(likedSet);

    // Every user always has Liked Songs, even when the likes call itself
    // failed — it just starts empty rather than not existing at all.
    const likedCollection: MockCollection = {
      id: LIKED_ID,
      title: "Liked Songs",
      desc: "Everything you liked.",
      texture: "tx-k2-vinyl",
      trackIds: [...likedSet],
      likes: 0,
      tags: ["liked"],
      kind: "music",
      system: true,
      pinned: true,
    };
    const owns =
      ownedRes.status === "fulfilled"
        ? ownedRes.value.map((c) =>
            toStudioCollection(c, {
              pinned: c.isPinned ?? pinnedIds.has(c.collectionId),
            })
          )
        : collectionsRef.current.filter(
            (collection) => collection.id !== LIKED_ID
          );
    const nextCollections = [likedCollection, ...owns];
    collectionsRef.current = nextCollections;
    setCollections(nextCollections);
  }, [backend, absorb, pinnedIds]);

  useEffect(() => {
    let live = true;
    (async () => {
      if (authOnly) return;
      if (!fbUser) {
        saveHistoryRef.current = false;
        likedIdsRef.current = new Set();
        setLikedIds(new Set());
        pendingLikesRef.current.clear();
        setUser(null);
        collectionsRef.current = [];
        setCollections([]);
        setLibraryLoading(false);
        setStatsLoading(false);
        setRecentsLoading(false);
        setPlaybackLoading(false);
        setJumpBackInLoading(false);
        setNewReleasesLoading(false);
        setYouMightLikeLoading(false);
        return;
      }

      // AuthGate already proved who this user is. Show that identity
      // immediately instead of briefly rendering a signed-out shell while the
      // backend profile document is still in flight.
      setUser(firebaseUserSnapshot(fbUser));
      saveHistoryRef.current = false;
      setPrivacyLoading(true);
      setLibraryLoading(true);
      setStats(toStudioStats(localListeningStats(savedListens(fbUser.uid))));
      setRecents([]);
      setStatsLoading(true);
      setRecentsLoading(true);
      setPlaybackLoading(true);
      setJumpBackIn([]);
      setJumpBackInLoading(true);
      setNewReleases([]);
      setYouMightLike([]);
      setNewReleasesLoading(true);
      setYouMightLikeLoading(true);

      const warn = (name: string) => (err: unknown) =>
        console.warn(`Feed load failed: ${name}`, err);

      try {
        // New accounts need a user doc first. After this one required write,
        // start the profile, library and all three shelves together.
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
        if (!live) return;

        const feedRevision = feedRevisionRef.current;
        const cachedNewReleases = readCachedStudioFeed(
          fbUser.uid,
          "new-releases"
        );
        const cachedSuggestions = readCachedStudioFeed(
          fbUser.uid,
          "you-might-like"
        );
        if (cachedNewReleases) {
          registerStudioTracks(cachedNewReleases);
          setNewReleases(cachedNewReleases);
          setNewReleasesLoading(false);
        } else
          void backend.feed
            .newReleases()
            .then((r) => {
              if (live && feedRevision === feedRevisionRef.current) {
                const tracks = absorbFeed(r.items);
                setNewReleases(tracks);
                saveCachedStudioFeed(fbUser.uid, "new-releases", tracks);
              }
            }, warn("new-releases"))
            .finally(() => {
              if (live) setNewReleasesLoading(false);
            });
        if (cachedSuggestions) {
          registerStudioTracks(cachedSuggestions);
          setYouMightLike(cachedSuggestions);
          setYouMightLikeLoading(false);
        } else
          void backend.feed
            .youMightLike()
            .then((r) => {
              if (live && feedRevision === feedRevisionRef.current) {
                const tracks = absorbFeed(r.items);
                setYouMightLike(tracks);
                saveCachedStudioFeed(fbUser.uid, "you-might-like", tracks);
              }
            }, warn("you-might-like"))
            .finally(() => {
              if (live) setYouMightLikeLoading(false);
            });
        // Derived from browser-local history and the in-memory library below.
        if (live) setJumpBackInLoading(false);

        const [meResult, libraryResult] = await Promise.allSettled([
          backend.me.get(),
          refreshLibrary(),
        ]);
        if (!live) return;
        if (meResult.status === "fulfilled" && meResult.value) {
          saveHistoryRef.current =
            meResult.value.privacy?.saveHistory !== false;
          setPrivacy({ ...DEFAULT_PRIVACY, ...meResult.value.privacy });
          setPrivacyLoading(false);
          syncHistory(fbUser.uid);
          setUser(toStudioUser(meResult.value));
        } else if (meResult.status === "rejected") {
          console.error("Failed to load user profile", meResult.reason);
        }
        if (libraryResult.status === "rejected") {
          console.error("Failed to load user library", libraryResult.reason);
        }
      } catch (err) {
        console.error("Failed to initialize user data", err);
        // If ensure() fails, no shelf request was started. Settle all states
        // so the skeleton cannot pulse forever.
        if (live) {
          setJumpBackInLoading(false);
          setNewReleasesLoading(false);
          setYouMightLikeLoading(false);
        }
      } finally {
        // Must run on every path — success, thrown error, or early return
        // above — so the user is never left staring at a stuck loading state.
        if (live) setLibraryLoading(false);
      }

      // Feeds and profile data. Each is independent — one failing rail must
      // not blank the others, so they settle separately. Failures are logged:
      // a silently-empty shelf is indistinguishable from a broken feed.
      // Restore the session that was playing before the reload. Deliberately
      // independent of the feed fetches below — a failed read here must not
      // affect user/collections/feeds, so it gets its own catch and nothing
      // else.
      void Promise.resolve(readBrowserPlayback(fbUser.uid))
        .then(async (state) => {
          if (!live || !state) return;
          const savedVolume = Math.min(1, Math.max(0, state.volume ?? 1));
          setVolumeState(savedVolume);
          if (savedVolume > 0) preMute.current = savedVolume;
          // Nothing was ever playing (fresh account, or an already-empty
          // saved state) — leave the player cold rather than "restoring" a
          // no-op.
          const ids = state.queue?.length
            ? state.queue
            : state.trackId
              ? [state.trackId]
              : [];
          if (ids.length === 0) return;

          const savedTracks = Array.isArray(state.queueTracks)
            ? state.queueTracks.filter((track) => ids.includes(track.id))
            : [];
          const resolved =
            savedTracks.length === ids.length
              ? savedTracks
              : await resolveTrackIds(ids);
          if (savedTracks.length === ids.length) registerStudioTracks(resolved);
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
          setShuffled(state.shuffleMode === true);
          setPlayingCollection(
            state.sourceType === "collection" && state.sourceId
              ? (collectionsRef.current.find(
                  (collection) => collection.id === state.sourceId
                ) ?? null)
              : null
          );
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
          setVolumeState(restoredVolume);
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
        .catch((err) => console.warn("Playback restore failed", err))
        .finally(() => {
          if (live) setPlaybackLoading(false);
        });

      // Playback history and live stats are browser-local while Firestore
      // protection mode is active. Do not scan playEvents on every app load.
      if (live) {
        setStatsLoading(false);
        setRecentsLoading(false);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbUser, authOnly]);

  useEffect(() => {
    const ids = [...new Set(recents.map((entry) => entry.collectionId))];
    setJumpBackIn(
      ids
        .map((id) => collections.find((collection) => collection.id === id))
        .filter((collection): collection is MockCollection =>
          Boolean(collection)
        )
        .slice(0, 12)
    );
  }, [collections, recents]);

  // ---- playback ----------------------------------------------------------
  const flushEvent = useCallback(
    (keepalive = false) => {
      const t = nowPlaying;
      const session = listeningRef.current;
      if (
        !t ||
        !session ||
        session.listenedSec < MIN_DURABLE_LISTEN_SEC ||
        !saveHistoryRef.current
      )
        return;

      const event: ListeningEvent = {
        eventId: session.eventId,
        trackId: t.id,
        collectionId: playingCollection?.id ?? null,
        listenedSec: Math.floor(session.listenedSec),
        startedAt: session.startedAt,
        source: playingCollection ? "collection" : (t.eventSource ?? "library"),
        recommendationId: t.recommendationId ?? null,
        clientHourOfDay: new Date().getHours(),
        durationSec: t.durationSec,
        artists: t.artists ?? [],
        labels: t.labels ?? [],
        track: t,
      };
      // Rotate before saving so pagehide plus a simultaneous track transition
      // cannot record the same browser-local session twice.
      listeningRef.current = freshListeningSession(session.lastPositionSec);
      if (fbUser) {
        try {
          storeListen(fbUser.uid, event);
        } catch {
          toast.error(
            "Couldn't save listening history. Browser storage may be full or blocked.",
            { id: "guest-history-storage" }
          );
          return;
        }
        const next = savedListens(fbUser.uid);
        setStats(toStudioStats(localListeningStats(next)));
        syncHistory(fbUser.uid, keepalive);
        setRecents(
          toStudioHistory(
            next.map((item) => ({
              trackId: item.trackId,
              startedAtMs: item.startedAt,
              collection: item.collectionId
                ? { collectionId: item.collectionId }
                : null,
            })),
            Date.now()
          )
        );
      }
    },
    [fbUser, nowPlaying, playingCollection, syncHistory]
  );

  const startTrack = useCallback((index: number) => {
    setCurrentIndex(index);
    setProgressSec(0);
    setIsLoading(true);
    setIsPlaying(true);
    listeningRef.current = freshListeningSession(0);
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
      // Playing the already-selected track is a transport toggle, not a new
      // load. Re-running startTrack here sets isLoading=true while the hidden
      // player URL remains unchanged, so onReady never fires again and the UI
      // can spin forever.
      if (nowPlaying?.id === track.id) {
        setIsLoading(false);
        setIsPlaying((playing) => {
          if (!playing && !listeningRef.current) {
            listeningRef.current = freshListeningSession(progressSec);
          }
          return !playing;
        });
        return;
      }
      const requestId = ++playRequestRef.current;
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
        return;
      }

      flushEvent();
      setPlayingCollection(from ?? null);
      // The selected row already carries everything the player needs. Seat it
      // immediately instead of blocking playback on one catalogue request per
      // collection item; the complete ordered queue is hydrated below.
      setQueue([track]);
      setNavDirection(null);
      startTrack(0);
      // A genuinely fresh queue invalidates whatever shuffle was doing to the
      // PREVIOUS one — leaving it on here would show "shuffled" active over
      // an order that was never actually shuffled.
      if (shuffled) {
        setShuffled(false);
        preShuffleOrderRef.current = null;
      }

      if (from) {
        if (from.tracks?.length === from.trackIds.length) {
          if (playRequestRef.current === requestId) {
            registerStudioTracks(from.tracks);
            const selectedIndex = from.tracks.findIndex(
              (item) => item.id === track.id
            );
            setQueue(from.tracks);
            setCurrentIndex(selectedIndex >= 0 ? selectedIndex : 0);
          }
          return;
        }
        void Promise.all(
          from.trackIds.map(async (id) => {
            if (id === track.id) return track;
            const resolved = await backend.catalog.track(id).catch(() => null);
            return resolved ? toStudioTrack(resolved) : null;
          })
        ).then((items) => {
          // A newer play owns the player now; discard this stale hydration.
          if (playRequestRef.current !== requestId) return;
          const hydrated = items.filter(
            (item): item is MockTrack => item !== null
          );
          if (hydrated.length === 0) return;
          registerStudioTracks(hydrated);
          const selectedIndex = hydrated.findIndex(
            (item) => item.id === track.id
          );
          setQueue(hydrated);
          // Keep the same selected track playing when it moves from slot 0 to
          // its real collection position. No restart or progress reset occurs.
          setCurrentIndex(selectedIndex >= 0 ? selectedIndex : 0);
        });
      }
    },
    [
      flushEvent,
      startTrack,
      playingCollection,
      queue,
      backend,
      shuffled,
      nowPlaying,
      progressSec,
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
    },
    [flushEvent, queue, currentIndex, shuffled]
  );

  const clearQueue = useCallback(async () => {
    flushEvent();
    setQueue([]);
    setPlayingCollection(null);
    setCurrentIndex(-1);
    setIsPlaying(false);
    setIsLoading(false);
    setProgressSec(0);
    setNavDirection(null);
    setShuffled(false);
    preShuffleOrderRef.current = null;
    pendingSeekRef.current = null;
  }, [flushEvent]);

  /**
   * Add to the running queue. Local state moves first so the rail updates on
   * the click. The browser playback snapshot below keeps it across reloads.
   * Nothing starts playing: the user asked for this track later, not now.
   */
  const enqueue = useCallback(
    (track: MockTrack, mode: EnqueueMode = "end") => {
      registerStudioTracks([track]);
      setQueue((q) => insertIntoQueue(q, track, mode, currentIndex));
    },
    [currentIndex]
  );

  /** Browser-local queue mutation for interactions that show success in UI. */
  const enqueuePersisted = useCallback(
    async (track: MockTrack, mode: EnqueueMode = "end") => {
      registerStudioTracks([track]);
      setQueue((q) => insertIntoQueue(q, track, mode, currentIndex));
    },
    [currentIndex]
  );

  const playNext = useCallback(
    (track: MockTrack) => {
      flushEvent();
      registerStudioTracks([track]);
      setQueue((current) =>
        insertIntoQueue(current, track, "next", currentIndex)
      );
      setCurrentIndex((index) => (index < 0 ? 0 : index + 1));
      setPlayingCollection(null);
      setProgressSec(0);
      setIsLoading(true);
      setIsPlaying(true);
      listeningRef.current = freshListeningSession(0);
    },
    [currentIndex, flushEvent]
  );

  const findSimilarTracks = useCallback(
    async (trackId: string) => {
      const response = await backend.feed.similar(trackId);
      const tracks = response.items.map((item) =>
        toStudioTrack(item.track, {
          eventSource: "recommendation",
          recommendationId: item.recommendationId,
        })
      );
      registerStudioTracks(tracks);
      return tracks;
    },
    [backend]
  );

  const [previewTrack, setPreviewTrack] = useState<MockTrack | null>(null);
  const [previewProgressSec, setPreviewProgressSec] = useState(0);
  const previewPlayerRef = useRef<SeekablePlayer | null>(null);
  const previewStartRef = useRef(0);
  const stopPreview = useCallback(() => {
    setPreviewTrack(null);
    setPreviewProgressSec(0);
  }, []);
  const startPreview = useCallback(
    (track: MockTrack) => {
      if (previewTrack?.id === track.id) {
        stopPreview();
        return;
      }
      // Shared catalogue metadata can replace this deterministic fallback
      // without changing card or player behavior.
      const start = previewStartForTrack(track);
      previewStartRef.current = start;
      setPreviewProgressSec(start);
      setPreviewTrack(track);
    },
    [previewTrack, stopPreview]
  );

  const toggle = useCallback(
    () =>
      setIsPlaying((playing) => {
        if (!nowPlaying) return playing;
        if (!playing && !listeningRef.current) {
          listeningRef.current = freshListeningSession(progressSec);
        }
        return !playing;
      }),
    [nowPlaying, progressSec]
  );
  const next = useCallback(() => {
    if (!queue.length || currentIndex < 0) return;
    flushEvent();
    const nextIndex = (currentIndex + 1) % queue.length;
    if (queue[nextIndex]?.id === nowPlaying?.id) {
      // A repeated video keeps the same URL; remount so an ended iframe really
      // restarts rather than leaving the transport claiming it is playing.
      setPlayerEpoch((epoch) => epoch + 1);
      setIsLoading(true);
    }
    // The wrap IS the point: onEnded() calls next() with nothing else
    // special-cased, so a finished queue — shuffled or not — restarts from
    // the top instead of stopping dead at the last track.
    setCurrentIndex((i) =>
      i < 0 || !queue.length ? i : (i + 1) % queue.length
    );
    setNavDirection("next");
    setProgressSec(0);
    setIsPlaying(true);
    listeningRef.current = freshListeningSession(0);
  }, [queue, currentIndex, nowPlaying?.id, flushEvent]);

  const playerRef = useRef<SeekablePlayer | null>(null);
  const seek = useCallback(
    (sec: number) => {
      const max = nowPlaying?.durationSec ?? 0;
      const clamped = Math.min(max, Math.max(0, Math.floor(sec)));
      setProgressSec(clamped);
      if (listeningRef.current) {
        listeningRef.current.lastPositionSec = clamped;
      }
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
    listeningRef.current = freshListeningSession(0);
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

  useEffect(() => {
    const onPageHide = () => flushEvent(true);
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [flushEvent]);

  const setVolume = useCallback((v: number) => {
    const c = Math.min(1, Math.max(0, v));
    if (c > 0) preMute.current = c;
    setVolumeState(c);
  }, []);
  const toggleMute = useCallback(
    () => setVolumeState((v) => (v > 0 ? 0 : preMute.current)),
    []
  );

  // Global transport shortcuts live with the shared playback state, so every
  // studio route and every player surface behaves identically. Never capture
  // keys while the user is typing or choosing a form value.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.matches("input, textarea, select, [role='textbox']"))
      ) {
        return;
      }
      if (!nowPlaying) return;

      switch (event.code) {
        case "Space":
          event.preventDefault();
          toggle();
          break;
        case "ArrowLeft":
          event.preventDefault();
          prev();
          break;
        case "ArrowRight":
          event.preventDefault();
          next();
          break;
        case "ArrowUp":
          event.preventDefault();
          setVolume(volume + 0.05);
          break;
        case "ArrowDown":
          event.preventDefault();
          setVolume(volume - 0.05);
          break;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [next, nowPlaying, prev, setVolume, toggle, volume]);

  // Playback is intentionally browser-only while database protection mode is
  // active. Queue, position, volume and shuffle never touch Firestore.
  useEffect(() => {
    // Do not overwrite an existing browser snapshot with the provider's empty
    // initial state before the restore effect has had a chance to read it.
    if (!fbUser || playbackLoading) return;
    writeBrowserPlayback(fbUser.uid, {
      trackId: nowPlaying?.id ?? null,
      queue: queue.map((track) => track.id),
      queueTracks: queue,
      queueIndex: currentIndex,
      positionSec: progressSec,
      isPlaying,
      volume,
      sourceType: playingCollection ? "collection" : "library",
      sourceId: playingCollection?.id ?? null,
      shuffleMode: shuffled,
    });
  }, [
    fbUser,
    playbackLoading,
    nowPlaying?.id,
    queue,
    currentIndex,
    progressSec,
    isPlaying,
    volume,
    playingCollection,
    shuffled,
  ]);

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
          cat.status === "fulfilled"
            ? absorb(cat.value.tracks).map((track) => ({
                ...track,
                eventSource: "search" as const,
              }))
            : []
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
        return absorb(res.tracks).map((track) => ({
          ...track,
          eventSource: "search" as const,
        }));
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
    async (trackId: string) => {
      likesRevisionRef.current += 1;
      const wasLiked = likedIdsRef.current.has(trackId);
      pendingLikesRef.current.add(trackId);
      const apply = (liked: boolean) => {
        const next = new Set(likedIdsRef.current);
        if (liked) next.add(trackId);
        else next.delete(trackId);
        likedIdsRef.current = next;
        setLikedIds(next);
        setCollections((cs) => {
          const updated = cs.map((c) =>
            c.id === LIKED_ID
              ? {
                  ...c,
                  trackIds: liked
                    ? [trackId, ...c.trackIds.filter((id) => id !== trackId)]
                    : c.trackIds.filter((id) => id !== trackId),
                }
              : c
          );
          collectionsRef.current = updated;
          return updated;
        });
      };
      // Update the Liked Songs collection itself, not just the likedIds set,
      // so the playlist reflects the like on the click rather than after the
      // round-trip to the server and back through refreshLibrary. The
      // endpoint returns newest-first, so a newly liked track goes to the
      // front here too.
      apply(!wasLiked);
      const running = likeWritesRef.current.get(trackId);
      if (running) {
        running.desired = !wasLiked;
        return running.task;
      }
      const operation = {
        confirmed: wasLiked,
        desired: !wasLiked,
        task: Promise.resolve(),
      };
      likeWritesRef.current.set(trackId, operation);
      operation.task = (async () => {
        try {
          while (operation.confirmed !== operation.desired) {
            const target = operation.desired;
            await backend.me.setTrackState(trackId, { isLiked: target });
            operation.confirmed = target;
          }
        } catch {
          apply(operation.confirmed);
          toast.error("Couldn't save your like. Please try again.");
        } finally {
          pendingLikesRef.current.delete(trackId);
          likeWritesRef.current.delete(trackId);
        }
      })();
      return operation.task;
    },
    [backend]
  );

  const togglePin = useCallback(
    (id: string) => {
      // Liked Songs is permanent: nothing can unpin it, no matter what calls in.
      if (id === LIKED_ID) return;
      if (pendingPinsRef.current.has(id)) return;
      pendingPinsRef.current.add(id);
      const wasPinned =
        collectionsRef.current.find((c) => c.id === id)?.pinned ??
        pinnedIds.has(id);
      setPinnedIds((s) => {
        const n = new Set(s);
        if (wasPinned) n.delete(id);
        else n.add(id);
        return n;
      });
      setCollections((cs) => {
        const next = cs.map((c) =>
          c.id === id ? { ...c, pinned: !wasPinned } : c
        );
        collectionsRef.current = next;
        return next;
      });
      void backend.me
        .setPin(id, { isPinned: !wasPinned })
        .catch(() => {
          setPinnedIds((current) => {
            const next = new Set(current);
            if (wasPinned) next.add(id);
            else next.delete(id);
            return next;
          });
          setCollections((cs) => {
            const next = cs.map((c) =>
              c.id === id ? { ...c, pinned: wasPinned } : c
            );
            collectionsRef.current = next;
            return next;
          });
          toast.error("Couldn't save the pin. Please try again.");
        })
        .finally(() => pendingPinsRef.current.delete(id));
    },
    [backend, pinnedIds]
  );

  const toggleTrackInCollection = useCallback(
    (collectionId: string, trackId: string) => {
      if (collectionId === LIKED_ID) return toggleLike(trackId);
      const c = collections.find((x) => x.id === collectionId);
      const has = c?.trackIds.includes(trackId);
      const op = has
        ? backend.collections.removeTrack(collectionId, trackId)
        : backend.collections.addTrack(collectionId, trackId);
      return op.then(refreshLibrary).catch(() => {
        toast.error("Couldn't update the playlist. Please try again.");
      });
    },
    [backend, collections, refreshLibrary, toggleLike]
  );
  const addTrackToCollection = useCallback(
    (collectionId: string, trackId: string) => {
      if (collectionId === LIKED_ID) {
        if (!likedIdsRef.current.has(trackId)) return toggleLike(trackId);
        return;
      }
      void backend.collections
        .addTrack(collectionId, trackId)
        .then(refreshLibrary)
        .catch(() => toast.error("Couldn't add the track. Please try again."));
    },
    [backend, refreshLibrary, toggleLike]
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
  const signIn = useCallback((provider: "google" | "facebook" = "google") => {
    void fbSignIn(provider).catch((error: { code?: string }) => {
      if (
        error.code !== "auth/popup-closed-by-user" &&
        error.code !== "auth/cancelled-popup-request"
      ) {
        toast.error("Couldn't sign in. Please try again.");
      }
    });
  }, []);
  const signOut = useCallback(() => {
    void signOutUser().catch(() =>
      toast.error("Couldn't sign out. Please try again.")
    );
  }, []);

  const makeCollectionShareable = useCallback(
    async (id: string) => {
      const saved = await backend.collections.update(id, {
        visibility: "unlisted",
      });
      setCollections((current) =>
        current.map((c) =>
          c.id === id ? { ...c, visibility: saved.visibility } : c
        )
      );
    },
    [backend]
  );

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
      clearQueue,
      enqueue,
      enqueuePersisted,
      playNext,
      previewTrack,
      previewPlaying: previewTrack !== null,
      previewProgressSec,
      startPreview,
      stopPreview,
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
      privacy,
      privacyLoading,
      updatePrivacy,
      clearListeningHistory,
      makeCollectionShareable,
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
      jumpBackInLoading,
      newReleasesLoading,
      youMightLikeLoading,
      findSimilarTracks,
      collectionResults,
      stats,
      statsLoading,
      recents,
      recentsLoading,
      playbackLoading,
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
      clearQueue,
      enqueue,
      enqueuePersisted,
      playNext,
      previewTrack,
      previewProgressSec,
      startPreview,
      stopPreview,
      toggle,
      next,
      prev,
      seek,
      shuffled,
      toggleShuffle,
      playShuffled,
      user,
      privacy,
      privacyLoading,
      updatePrivacy,
      clearListeningHistory,
      makeCollectionShareable,
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
      jumpBackInLoading,
      newReleasesLoading,
      youMightLikeLoading,
      findSimilarTracks,
      collectionResults,
      stats,
      statsLoading,
      recents,
      recentsLoading,
      playbackLoading,
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
            key={playerEpoch}
            playerRef={playerRef}
            url={`https://www.youtube.com/watch?v=${nowPlaying.id}`}
            playing={isPlaying && !previewTrack}
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
              const session = listeningRef.current;
              if (!session) return;
              const previous = session.lastPositionSec;
              session.lastPositionSec = s.playedSeconds;
              if (previous === null || !isPlaying) return;
              const delta = s.playedSeconds - previous;
              // Normal progress ticks are about one second. Larger jumps are
              // seeks or a resumed/restored playhead, not time actually heard.
              if (delta > 0 && delta <= 5) session.listenedSec += delta;
            }}
            onEnded={() => next()}
            onError={() => {
              setIsLoading(false);
              setIsPlaying(false);
              toast.error(
                "This track couldn't play. Try another song or press play to retry."
              );
            }}
          />
        </div>
      )}
      {previewTrack && (
        <div
          style={{ position: "fixed", width: 0, height: 0, overflow: "hidden" }}
        >
          <HiddenYouTubePlayer
            playerRef={previewPlayerRef}
            url={`https://www.youtube.com/watch?v=${previewTrack.id}`}
            playing
            volume={volume}
            onReady={() =>
              previewPlayerRef.current?.seekTo(previewStartRef.current)
            }
            onStart={() => {}}
            onProgress={(s) => {
              setPreviewProgressSec(s.playedSeconds);
              if (s.playedSeconds >= previewStartRef.current + 10)
                stopPreview();
            }}
            onEnded={stopPreview}
            onError={() => {
              stopPreview();
              toast.error("Preview unavailable for this track.");
            }}
          />
        </div>
      )}
    </MockStudioContext.Provider>
  );
}
