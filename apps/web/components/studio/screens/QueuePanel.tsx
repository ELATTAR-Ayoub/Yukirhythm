"use client";

import CollectionDetail from "./CollectionDetail";
import { type MockCollection } from "./mock-data";

interface QueuePanelProps {
  /** What's playing, real or synthetic — from useQueueCollection. */
  collection: MockCollection;
  /** The real source collection, or undefined when playing the whole library. */
  playFrom?: MockCollection;
}

/**
 * The queue body. Purely presentational — QueueDrawer wraps this in a sheet on
 * mobile, NowPlayingRail renders it inline on desktop, and each surface derives
 * the collection once with useQueueCollection and passes it down.
 */
export default function QueuePanel({ collection, playFrom }: QueuePanelProps) {
  return <CollectionDetail collection={collection} playFrom={playFrom} />;
}
