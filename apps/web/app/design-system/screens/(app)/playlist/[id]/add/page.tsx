"use client";

import { useParams } from "next/navigation";

import EmptyState from "@/components/studio/EmptyState";
import BackHeader from "@/components/studio/screens/BackHeader";
import AddMusicPanel from "@/components/studio/screens/AddMusicPanel";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { playlistHref } from "@/components/studio/shell/routes";

/**
 * The add-music route, reachable at every width — see CollectionDetail's
 * "Add music" control. AddMusicDrawer (the same AddMusicPanel body inside a
 * sheet) has no consumer left anywhere, app-flow or docs, now that this
 * route covers every width — left in place rather than deleted unilaterally.
 */
export default function AddMusicScreen() {
  const { collections } = useMockStudio();
  // next-env.d.ts types useParams() as `T | null` for pages/-router
  // back-compat even though the app router never actually returns null here
  // — mirrors the guard in the playlist route for the same reason.
  const params = useParams<{ id: string }>();
  const rawId = params
    ? Array.isArray(params.id)
      ? params.id[0]
      : params.id
    : undefined;
  const id = rawId ? decodeURIComponent(rawId) : undefined;
  const collection = id ? collections.find((c) => c.id === id) : undefined;

  if (!collection) {
    return (
      <EmptyState
        title="Collection not found"
        hint="It may have been removed. Pick another from your library."
        texture="tx-k2-static"
      />
    );
  }

  return (
    <div className="pb-8">
      <BackHeader title="Add music" backHref={playlistHref(collection.id)} />
      <p className="type-muted -mt-4 mb-4 truncate">to {collection.title}</p>
      <AddMusicPanel collection={collection} autoFocus />
    </div>
  );
}
