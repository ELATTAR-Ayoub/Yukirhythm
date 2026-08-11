"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { registerStudioTracks, type MockTrack } from "./mock-data";
import { toStudioTrack } from "@/lib/studio/adapt";
import { useBackend } from "@/lib/studio/useBackend";

export type StudioShelfFeed = "new-releases" | "you-might-like";

type CachedFeed = {
  tracks: MockTrack[];
};

const CACHE_PREFIX = "yukirhythm:feed:v2";

function cacheKey(userId: string, feed: StudioShelfFeed): string {
  return `${CACHE_PREFIX}:${encodeURIComponent(userId)}:${feed}`;
}

function readCachedFeed(key: string): MockTrack[] | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedFeed>;
    return Array.isArray(parsed.tracks) ? parsed.tracks : null;
  } catch {
    return null;
  }
}

function writeCachedFeed(key: string, tracks: MockTrack[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify({ tracks }));
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
  const [tracks, setTracks] = useState(providerTracks);
  const [ready, setReady] = useState(
    providerTracks.length > 0 || !providerLoading
  );
  const [refreshing, setRefreshing] = useState(false);

  // Resolve persisted data before adopting later provider updates. A cached
  // empty result is meaningful too: it is a settled shelf, not a cache miss.
  useEffect(() => {
    source.current = "unresolved";
    const cached = readCachedFeed(key);
    if (cached !== null) {
      registerStudioTracks(cached);
      setTracks(cached);
      setReady(true);
      source.current = "cache";
      return;
    }

    source.current = "provider";
    setTracks(providerTracks);
    const settled = providerTracks.length > 0 || !providerLoading;
    setReady(settled);
    if (settled) writeCachedFeed(key, providerTracks);
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
    if (refreshing) return;
    setRefreshing(true);
    try {
      const response =
        feed === "new-releases"
          ? await backend.feed.newReleases()
          : await backend.feed.youMightLike();
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
      console.warn(`Feed refresh failed: ${feed}`, error);
    } finally {
      setRefreshing(false);
    }
  }, [backend, feed, key, refreshing]);

  return {
    tracks,
    loading: !ready,
    refreshing,
    refresh,
  };
}
