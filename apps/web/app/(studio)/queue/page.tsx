"use client";

import BackHeader from "@/components/studio/screens/BackHeader";
import CollectionDetail from "@/components/studio/screens/CollectionDetail";
import useQueueCollection from "@/components/studio/screens/useQueueCollection";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { HOME, QUEUE_ADD } from "@/components/studio/shell/routes";

/**
 * The queue route, reachable at every width — see NowPlayingRail's and
 * DevicePlayer's transport queue controls. QueueDrawer (still demoed in the
 * design-system docs) renders the same CollectionDetail body inside a sheet,
 * but no longer has an app-flow consumer of its own.
 *
 * useQueueCollection() falls back to a synthetic "Up next" collection over
 * the whole library when nothing has ever played, so this route renders
 * (rather than 404ing on missing state) even on a cold session.
 */
export default function QueueScreen() {
  const { playingCollection } = useMockStudio();
  const collection = useQueueCollection();

  return (
    <div className="pb-8">
      <BackHeader title={collection.title} backHref={HOME} />
      <CollectionDetail
        collection={collection}
        playFrom={playingCollection ?? undefined}
        addHref={QUEUE_ADD}
      />
    </div>
  );
}
