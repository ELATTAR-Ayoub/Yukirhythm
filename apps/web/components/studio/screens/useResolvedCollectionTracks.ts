"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useBackend } from "@/lib/studio/useBackend";
import { toStudioTrack } from "@/lib/studio/adapt";
import type { Track } from "@/lib/catalog/model";
import {
  getTrack,
  registerStudioTracks,
  type MockCollection,
  type MockTrack,
} from "./mock-data";

interface ResolvedCollectionTracks {
  tracks: MockTrack[] | null;
  missingTrackIds: string[];
  error: unknown;
  retry: () => void;
}

function completeRegistryTracks(trackIds?: string[]): MockTrack[] | null {
  if (!trackIds) return null;
  const tracks = trackIds.map(getTrack);
  return tracks.every((track): track is MockTrack => track !== undefined)
    ? tracks
    : null;
}

interface Resolution {
  key: string;
  tracks: MockTrack[] | null;
  missingTrackIds: string[];
  error: unknown;
}

/**
 * Resolves playlist memberships as one batched catalogue read. The shared
 * registry still powers library mosaics and menus, but playlist rendering
 * consumes this returned array directly so an unregistered id can never be
 * silently omitted again.
 */
export default function useResolvedCollectionTracks(
  collection?: MockCollection
): ResolvedCollectionTracks {
  const backend = useBackend();
  const collectionId = collection?.id ?? "";
  const trackIdsKey = collection?.trackIds.join("\u0000") ?? "";
  const resolutionKey = collectionId
    ? `${collectionId}\u0001${trackIdsKey}`
    : "";
  const stableTrackIds = useMemo(
    () =>
      collectionId ? (trackIdsKey ? trackIdsKey.split("\u0000") : []) : null,
    [collectionId, trackIdsKey]
  );
  const [resolution, setResolution] = useState<Resolution>(() => ({
    key: resolutionKey,
    tracks: completeRegistryTracks(collection?.trackIds),
    missingTrackIds: [],
    error: null,
  }));
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let live = true;
    if (!stableTrackIds) return;

    const cached = completeRegistryTracks(stableTrackIds);
    if (cached) {
      queueMicrotask(() => {
        if (live) {
          setResolution({
            key: resolutionKey,
            tracks: cached,
            missingTrackIds: [],
            error: null,
          });
        }
      });
      return () => {
        live = false;
      };
    }

    void (async () => {
      try {
        const batch = await backend.catalog.tracksByIds(stableTrackIds);
        const recovered = await Promise.all(
          batch.missingTrackIds.map((trackId) =>
            backend.catalog.track(trackId).catch(() => null)
          )
        );
        if (!live) return;

        const documents: Track[] = [
          ...batch.tracks,
          ...recovered.filter((track): track is Track => track !== null),
        ];
        const studioTracks = documents.map(toStudioTrack);
        registerStudioTracks(studioTracks);
        const tracksById = new Map(
          studioTracks.map((track) => [track.id, track])
        );
        const ordered = stableTrackIds
          .map((trackId) => tracksById.get(trackId))
          .filter((track): track is MockTrack => track !== undefined);
        setResolution({
          key: resolutionKey,
          tracks: ordered,
          missingTrackIds: stableTrackIds.filter(
            (trackId) => !tracksById.has(trackId)
          ),
          error: null,
        });
      } catch (reason) {
        if (live) {
          setResolution({
            key: resolutionKey,
            tracks: null,
            missingTrackIds: [],
            error: reason,
          });
        }
      }
    })();

    return () => {
      live = false;
    };
  }, [attempt, backend, resolutionKey, stableTrackIds]);

  const current =
    resolution.key === resolutionKey
      ? resolution
      : {
          key: resolutionKey,
          tracks: null,
          missingTrackIds: [],
          error: null,
        };
  return {
    tracks: current.tracks,
    missingTrackIds: current.missingTrackIds,
    error: current.error,
    retry,
  };
}
