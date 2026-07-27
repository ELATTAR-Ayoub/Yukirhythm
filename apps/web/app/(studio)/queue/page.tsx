"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import BackHeader from "@/components/studio/screens/BackHeader";
import ClearQueueButton from "@/components/studio/screens/ClearQueueButton";
import CollectionDetail from "@/components/studio/screens/CollectionDetail";
import { QueuePageSkeleton } from "@/components/studio/screens/RouteSkeletons";
import useQueueCollection from "@/components/studio/screens/useQueueCollection";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import {
  HOME,
  QUEUE_ADD,
  playlistHref,
} from "@/components/studio/shell/routes";

/**
 * The queue route, reachable at every width — see NowPlayingRail's and
 * DevicePlayer's transport queue controls. QueueDrawer (still demoed in the
 * design-system docs) renders the same CollectionDetail body inside a sheet,
 * but no longer has an app-flow consumer of its own.
 *
 * useQueueCollection() falls back to a synthetic "Up next" collection over
 * the whole library when nothing has ever played, so this route renders
 * (rather than 404ing on missing state) even on a cold session. The row list
 * itself, though, comes straight from the live `queue` array rather than
 * that collection's `trackIds`: the queue's tracks are already whole objects
 * (round-tripping through the id registry would drop any that miss), and
 * rows play by position (`onPlayAt`) so a duplicated track's second copy
 * doesn't start the first.
 */
export default function QueueScreen() {
  const { playingCollection, queue, playAt, playbackLoading } = useMockStudio();
  const collection = useQueueCollection();
  const router = useRouter();

  useEffect(() => {
    if (!playbackLoading && playingCollection) {
      router.replace(playlistHref(playingCollection.id));
    }
  }, [playbackLoading, playingCollection, router]);

  // Never expose queue-only actions while persisted playback is still being
  // classified, nor during the one render before a playlist redirect lands.
  if (playbackLoading || playingCollection) return <QueuePageSkeleton />;

  return (
    <div className="pb-8">
      <BackHeader title={collection.title} fallbackHref={HOME} />
      <CollectionDetail
        collection={collection}
        playFrom={playingCollection ?? undefined}
        addHref={QUEUE_ADD}
        tracks={queue}
        onPlayAt={playAt}
        queueAction={<ClearQueueButton />}
      />
    </div>
  );
}
