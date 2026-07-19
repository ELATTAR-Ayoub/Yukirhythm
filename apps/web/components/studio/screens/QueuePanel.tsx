"use client";

import { useMemo } from "react";

import CollectionDetail from "./CollectionDetail";
import { useMockStudio } from "./MockStudioProvider";
import { type MockCollection } from "./mock-data";

/**
 * What's playing right now. When playback was launched from a collection this
 * is that collection; when a track was played straight from search or a rail
 * there is no source, so the whole library queue is presented under a
 * synthetic "Up next" collection.
 *
 * Body only — QueueDrawer wraps this in a sheet on mobile, NowPlayingRail
 * renders it inline on desktop.
 */
export function useQueueCollection(): MockCollection {
  const { playingCollection, queue } = useMockStudio();

  return useMemo(
    () =>
      playingCollection ?? {
        id: "queue",
        title: "Up next",
        desc: "Everything queued from your library.",
        texture: "tx-k-silk",
        trackIds: queue.map((t) => t.id),
        likes: 0,
        tags: ["queue"],
        kind: "music",
        pinned: false,
      },
    [playingCollection, queue]
  );
}

export default function QueuePanel() {
  const { playingCollection } = useMockStudio();
  const collection = useQueueCollection();

  return (
    <CollectionDetail
      collection={collection}
      playFrom={playingCollection ?? undefined}
    />
  );
}
