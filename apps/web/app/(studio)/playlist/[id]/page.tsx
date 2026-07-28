"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import BackHeader from "@/components/studio/screens/BackHeader";
import EmptyState from "@/components/studio/EmptyState";
import CollectionDetail from "@/components/studio/screens/CollectionDetail";
import PlaylistHero from "@/components/studio/screens/PlaylistHero";
import { PlaylistPageSkeleton } from "@/components/studio/screens/RouteSkeletons";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { LIBRARY, playlistHref } from "@/components/studio/shell/routes";
import useResolvedCollectionTracks from "@/components/studio/screens/useResolvedCollectionTracks";
import { Button } from "@/components/ui/button";

export default function PlaylistScreen() {
  const { collections, libraryLoading } = useMockStudio();
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const createdTitle = searchParams.get("created");
  const collection = id
    ? (collections.find((c) => c.id === id) ??
      (id.startsWith("pending-") && createdTitle
        ? [...collections].reverse().find((c) => c.title === createdTitle)
        : undefined))
    : undefined;
  const resolved = useResolvedCollectionTracks(collection);

  // Once the refreshed library exposes the server-issued id, canonicalise
  // the optimistic URL. Until then `collection` keeps the detail page
  // rendered, so users never fall through to the not-found state.
  useEffect(() => {
    if (id?.startsWith("pending-") && collection && collection.id !== id) {
      router.replace(playlistHref(collection.id));
    }
  }, [collection, id, router]);

  // The library loads asynchronously; an empty list on the first render is
  // "not loaded yet", not "missing". Claiming not-found here flashed a false
  // error on every direct navigation.
  if (libraryLoading) return <PlaylistPageSkeleton />;

  if (!collection) {
    return (
      <EmptyState
        title="Collection not found"
        hint="It may have been removed. Pick another from your library."
        texture="tx-k2-static"
      />
    );
  }

  if (resolved.tracks === null && !resolved.error) {
    return <PlaylistPageSkeleton title={collection.title} />;
  }

  if (resolved.error) {
    return (
      <div className="pb-8">
        <BackHeader title={collection.title} fallbackHref={LIBRARY} />
        <PlaylistHero collection={collection} />
        <EmptyState
          title="Could not load playlist tracks"
          hint="Your playlist is still saved. Check your connection and try loading its songs again."
          texture="tx-k2-static"
          action={<Button onClick={resolved.retry}>Try again</Button>}
        />
      </div>
    );
  }

  const tracks = resolved.tracks ?? [];

  return (
    <div className="pb-8">
      {/* The same header every other screen uses — it anchors the top of the
          page, names where you are, and carries the way back. Playlist detail
          used to be a sheet you dismissed by swiping; as a route it needs a
          real exit, and on a phone there is no library rail to fall back to.
          The hero deliberately has no title of its own so this is the page's
          single heading. */}
      <BackHeader title={collection.title} fallbackHref={LIBRARY} />

      <PlaylistHero collection={collection} tracks={tracks} />
      <div className="px-1 mt-4">
        {resolved.missingTrackIds.length ? (
          <p
            role="status"
            className="mb-3 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-muted-foreground"
          >
            {resolved.missingTrackIds.length}{" "}
            {resolved.missingTrackIds.length === 1 ? "track is" : "tracks are"}{" "}
            currently unavailable from the music provider.
          </p>
        ) : null}
        <CollectionDetail collection={collection} tracks={tracks} />
      </div>
    </div>
  );
}
