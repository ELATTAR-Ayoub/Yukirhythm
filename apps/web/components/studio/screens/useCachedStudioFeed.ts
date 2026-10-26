"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { registerStudioTracks, type MockTrack } from "./mock-data";
import { toStudioTrack } from "@/lib/studio/adapt";
import { useBackend } from "@/lib/studio/useBackend";
import { toast } from "sonner";

export type StudioShelfFeed = "new-releases" | "you-might-like";

type CachedFeed = {
  tracks: MockTrack[];
  savedAtMs?: number;
};

const CACHE_PREFIX = "yukirhythm:feed:v2";

function cacheKey(userId: string, feed: StudioShelfFeed): string {
  return `${CACHE_PREFIX}:${encodeURIComponent(userId)}:${feed}`;
}

export function clearCachedStudioFeeds(userId: string): void {
  try {
    for (const feed of ["new-releases", "you-might-like"] as const) {
      const key = cacheKey(userId, feed);
      localStorage.removeItem(key);
      localStorage.setItem(`${key}:invalidated`, "true");
    }
  } catch {
    /* Storage may be blocked. */
  }
}

function readCachedFeed(key: string): MockTrack[] | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedFeed>;
    if (!Array.isArray(parsed.tracks)) return null;
    if (
      !parsed.tracks.length &&
      (!parsed.savedAtMs || Date.now() - parsed.savedAtMs > 60000)
    )
      return null;
    return parsed.tracks;
  } catch {
    return null;
  }
}

export function readCachedStudioFeed(
  userId: string,
  feed: StudioShelfFeed
): MockTrack[] | null {
  try {
    if (localStorage.getItem(`${cacheKey(userId, feed)}:invalidated`))
      return null;
  } catch {}
  return readCachedFeed(cacheKey(userId, feed));
}
export function saveCachedStudioFeed(
  userId: string,
  feed: StudioShelfFeed,
  tracks: MockTrack[]
): void {
  writeCachedFeed(cacheKey(userId, feed), tracks);
}

function writeCachedFeed(key: string, tracks: MockTrack[]): void {
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({ tracks, savedAtMs: Date.now() })
    );
    window.localStorage.removeItem(`${key}:invalidated`);
  } catch {
    // Storage can be unavailable (private mode or quota exhaustion). The
    // in-memory shelf still works, so persistence is deliberately best-effort.
  }
}

/**
 * Keeps the first settled result for one feed until the user explicitly
 * refreshes it. The provider remains the initial data owner; this hook merely
 * lets Home and Search share a stable browser-cached snapshot and refresh one
 * shelf without coupling it to the other.
 */
export function useCachedStudioFeed({
  feed,
  userId,
  providerTracks,
  providerLoading,
}: {
  feed: StudioShelfFeed;
  userId: string;
  providerTracks: MockTrack[];
  providerLoading: boolean;
}) {
  const backend = useBackend();
  const key = cacheKey(userId, feed);
  const source = useRef<"unresolved" | "provider" | "cache">("unresolved");
  const generation = useRef(0);
  const refreshingRef = useRef(false);
  const attemptedInvalidation = useRef<string | null>(null);
  const [tracks, setTracks] = useState(providerTracks);
  const [ready, setReady] = useState(
    providerTracks.length > 0 || !providerLoading
  );
  const [refreshing, setRefreshing] = useState(false);

  // Resolve persisted data before adopting later provider updates. A cached
  // empty result is meaningful too: it is a settled shelf, not a cache miss.
  useEffect(() => {
    generation.current += 1;
    refreshingRef.current = false;
    setRefreshing(false);
    source.current = "unresolved";
    let invalidated = false;
    try {
      invalidated = Boolean(localStorage.getItem(`${key}:invalidated`));
    } catch {}
    if (invalidated) {
      source.current = "cache";
      setTracks([]);
      setReady(false);
      return () => {
        generation.current += 1;
      };
    }
    const cached = readCachedFeed(key);
    if (cached !== null) {
      registerStudioTracks(cached);
      setTracks(cached);
      setReady(true);
      source.current = "cache";
      return () => {
        generation.current += 1;
      };
    }

    source.current = "provider";
    setTracks(providerTracks);
    const settled = providerTracks.length > 0 || !providerLoading;
    setReady(settled);
    if (settled) writeCachedFeed(key, providerTracks);
    return () => {
      generation.current += 1;
    };
    // The following effect adopts provider updates for this key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // The real provider currently exposes one aggregate loading flag. Treat a
  // non-empty result as settled immediately, so one shelf can render while the
  // other request is still in flight.
  useEffect(() => {
    if (source.current !== "provider") return;
    const settled = providerTracks.length > 0 || !providerLoading;
    if (!settled) return;
    setTracks(providerTracks);
    setReady(true);
    writeCachedFeed(key, providerTracks);
  }, [key, providerLoading, providerTracks]);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    const requestGeneration = generation.current;
    setRefreshing(true);
    try {
      const response =
        feed === "new-releases"
          ? await backend.feed.newReleases(true)
          : await backend.feed.youMightLike(true);
      if (requestGeneration !== generation.current) return;
      const next = response.items.map((item) =>
        toStudioTrack(item.track, {
          eventSource: "recommendation",
          recommendationId: item.recommendationId,
        })
      );
      registerStudioTracks(next);
      setTracks(next);
      setReady(true);
      source.current = "cache";
      writeCachedFeed(key, next);
    } catch (error) {
      if (requestGeneration === generation.current) {
        console.warn(`Feed refresh failed: ${feed}`, error);
        toast.error("Couldn't refresh recommendations. Please try again.");
        setReady(true);
      }
    } finally {
      if (requestGeneration === generation.current) {
        refreshingRef.current = false;
        setRefreshing(false);
      }
    }
  }, [backend, feed, key]);

  useEffect(() => {
    let invalidated: string | null = null;
    try {
      invalidated = localStorage.getItem(`${key}:invalidated`);
    } catch {}
    const attempt = `${key}:${invalidated}`;
    if (invalidated && attemptedInvalidation.current !== attempt) {
      attemptedInvalidation.current = attempt;
      void refresh();
    }
  }, [key, refresh]);

  return {
    tracks,
    loading: !ready,
    refreshing,
    refresh,
  };
}
