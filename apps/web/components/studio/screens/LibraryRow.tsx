"use client";

import { DrawingPinFilledIcon, PlusIcon } from "@radix-ui/react-icons";

import MediaCard from "@/components/studio/MediaCard";
import CollectionArt from "./CollectionArt";
import type { MockCollection } from "./mock-data";

interface LibraryRowCardProps {
  collection: MockCollection;
  /** Forwarded to MediaCard — false for callers that supply an anchor wrapper. */
  playable?: boolean;
}

/**
 * The inside of a library row: artwork, meta and the pinned marker.
 *
 * Deliberately a bare fragment with no wrapper element. The library screen and
 * the docked rail wrap this in different interactive elements — a div-as-button
 * that opens a sheet versus a real anchor that navigates — and that difference
 * is meant to stay visible at each call site rather than hide behind a prop.
 */
export function LibraryRowCard({ collection, playable }: LibraryRowCardProps) {
  return (
    <>
      <MediaCard
        title={collection.title}
        artist={`${collection.trackIds.length} tracks · ${collection.kind}`}
        art={<CollectionArt collection={collection} className="w-full h-full" />}
        variant="extended"
        size="sm"
        playable={playable}
      />
      {/* A pin badge promises "you pinned this, you can unpin it." Liked Songs
          is pinned: true so filterLibrary's ranking still sorts it first, but
          it's first because it's permanent — a different fact — and
          CollectionMenu no longer offers Unpin for it. Showing the badge
          would advertise a control the row doesn't have. */}
      {collection.pinned && !collection.system ? (
        <DrawingPinFilledIcon
          aria-label="Pinned"
          className="absolute top-2.5 right-2.5 w-3.5 h-3.5 text-primary"
        />
      ) : null}
    </>
  );
}

/** The dashed "add another" tile that closes every library list. */
export function CreatePlaylistTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 p-3 rounded-lg border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors duration-fast"
    >
      <span className="flex items-center justify-center w-12 h-12 rounded-md bg-secondary shrink-0">
        <PlusIcon className="w-5 h-5" />
      </span>
      <span className="font-ui font-medium text-sm">Create playlist</span>
    </button>
  );
}
