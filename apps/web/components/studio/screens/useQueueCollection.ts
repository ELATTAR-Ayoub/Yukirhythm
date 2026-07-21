"use client";

import { useMemo } from "react";

import { useMockStudio } from "./MockStudioProvider";
import { type MockCollection } from "./mock-data";

/**
 * The running queue, shaped as a collection so the queue surfaces can reuse
 * the collection components.
 *
 * The track list always comes from `queue` — never from the collection's own
 * `trackIds`. Playing from a playlist only supplies the identity (title,
 * texture) of what's running; the order being walked through is the queue,
 * which drifts from the playlist the moment anything is added to it from the
 * rail. Reading the playlist instead would silently hide queued tracks.
 *
 * Call this once per surface and pass the result down. QueueDrawer uses it for
 * both its heading and its body; NowPlayingRail uses it for the upcoming-track
 * preview. Deriving it twice within one surface would produce two unequal
 * fallback objects, since the synthetic collection is built fresh each time.
 */
export default function useQueueCollection(): MockCollection {
  const { playingCollection, queue } = useMockStudio();

  return useMemo(() => {
    const trackIds = queue.map((t) => t.id);
    return playingCollection
      ? { ...playingCollection, trackIds }
      : {
          id: "queue",
          title: "Up next",
          desc: "Everything queued from your library.",
          texture: "tx-k-silk",
          trackIds,
          likes: 0,
          tags: ["queue"],
          kind: "music",
          pinned: false,
        };
  }, [playingCollection, queue]);
}
