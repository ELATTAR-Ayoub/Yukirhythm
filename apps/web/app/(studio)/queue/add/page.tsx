"use client";

import BackHeader from "@/components/studio/screens/BackHeader";
import AddMusicPanel from "@/components/studio/screens/AddMusicPanel";
import PageTexture from "@/components/studio/screens/PageTexture";
import { QUEUE } from "@/components/studio/shell/routes";

/**
 * Add music to the running queue.
 *
 * `AddMusicPanel` with no `collection` means "enqueue" — nothing is written to
 * any playlist. This route exists because the queue is not a collection: it has
 * no id, so `/playlist/<id>/add` can never serve it, and pointing the queue's
 * "+" at that route is what rendered "Collection not found".
 *
 * No library lookup and no loading gate: there is nothing to resolve, so this
 * screen is usable the instant it mounts.
 */
export default function QueueAddScreen() {
  return (
    <div className="relative pb-8">
      <PageTexture />
      {/* Lifted above the texture — it sits at z-0 rather than behind the
          column's opaque background. */}
      <div className="relative z-10">
        <BackHeader title="Search songs" fallbackHref={QUEUE} />
        <p className="type-muted -mt-4 mb-4 truncate">to your queue</p>
        <AddMusicPanel autoFocus />
      </div>
    </div>
  );
}
