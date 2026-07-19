"use client";

import { useMemo } from "react";

import { useMockStudio } from "./MockStudioProvider";
import { type MockCollection } from "./mock-data";

/**
 * What's playing right now, as a collection. When playback was launched from a
 * collection this is that collection; when a track was played straight from
 * search or a rail there is no source, so the whole library queue is presented
 * under a synthetic "Up next" collection.
 *
 * Call this once per surface and pass the result down — QueueDrawer and the
 * desktop rail both need the collection for their heading as well as for the
 * body, and deriving it twice would produce two unequal fallback objects.
 */
export default function useQueueCollection(): MockCollection {
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
