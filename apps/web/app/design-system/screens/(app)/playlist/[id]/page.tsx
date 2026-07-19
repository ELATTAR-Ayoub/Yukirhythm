"use client";

import { useParams } from "next/navigation";

import EmptyState from "@/components/studio/EmptyState";
import CollectionDetail from "@/components/studio/screens/CollectionDetail";
import PlaylistHero from "@/components/studio/screens/PlaylistHero";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";

export default function PlaylistScreen() {
  const { collections } = useMockStudio();
  // next-env.d.ts pulls in next/navigation-types/compat/navigation, which
  // types useParams() as `T | null` for pages/-router back-compat even
  // though the app router never actually returns null here — so this guard
  // exists to satisfy tsc, not because we expect to hit it.
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
      <PlaylistHero collection={collection} />
      <div className="px-1 mt-4">
        <CollectionDetail collection={collection} />
      </div>
    </div>
  );
}
