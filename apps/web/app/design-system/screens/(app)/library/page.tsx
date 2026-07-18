"use client";

import { useState } from "react";
import { DrawingPinFilledIcon, PlusIcon } from "@radix-ui/react-icons";

import MediaCard from "@/components/studio/MediaCard";
import { PlayerButton } from "@/components/studio/PlayerButton";
import PageHeader from "@/components/studio/screens/PageHeader";
import SignInPrompt from "@/components/studio/screens/SignInPrompt";
import PlaylistDrawer from "@/components/studio/screens/PlaylistDrawer";
import CreatePlaylistDrawer from "@/components/studio/screens/CreatePlaylistDrawer";
import { FilterChipRow } from "@/components/studio/screens/TagChip";
import {
  LIBRARY_FILTERS,
  filterLibrary,
} from "@/components/studio/screens/library-utils";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import type { MockCollection } from "@/components/studio/screens/mock-data";

export default function LibraryScreen() {
  const { user, collections, libraryFilter, setLibraryFilter } =
    useMockStudio();
  const [openCollection, setOpenCollection] = useState<MockCollection | null>(
    null
  );
  const [creating, setCreating] = useState(false);

  if (!user) {
    return (
      <div>
        <PageHeader title="Your Library" />
        <SignInPrompt hint="Playlists, podcasts and Liked Songs live here." />
      </div>
    );
  }

  const visible = filterLibrary(collections, libraryFilter);

  /** Enter/Space activation for the non-button collection row (it nests a PlayerButton). */
  const openKeyHandler = (c: MockCollection) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpenCollection(c);
    }
  };

  return (
    <div>
      <PageHeader
        title="Your Library"
        actions={
          <PlayerButton
            variant="ghost"
            aria-label="Create playlist"
            onClick={() => setCreating(true)}
          >
            <PlusIcon />
          </PlayerButton>
        }
      />

      <FilterChipRow
        options={LIBRARY_FILTERS}
        value={libraryFilter}
        onChange={setLibraryFilter}
        className="mb-6"
      />

      <div className="space-y-2">
        {visible.map((c) => (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            aria-label={`Open collection ${c.title}`}
            onClick={() => setOpenCollection(c)}
            onKeyDown={openKeyHandler(c)}
            className="relative w-full text-left cursor-pointer"
          >
            <MediaCard
              title={c.title}
              artist={`${c.trackIds.length} tracks · ${c.kind}`}
              texture={c.texture}
              variant="extended"
              size="sm"
            />
            {c.pinned ? (
              <DrawingPinFilledIcon
                aria-label="Pinned"
                className="absolute top-2.5 right-2.5 w-3.5 h-3.5 text-primary"
              />
            ) : null}
          </div>
        ))}

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-full flex items-center gap-4 p-3 rounded-lg border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors duration-fast"
        >
          <span className="flex items-center justify-center w-12 h-12 rounded-md bg-secondary shrink-0">
            <PlusIcon className="w-5 h-5" />
          </span>
          <span className="font-ui font-medium text-sm">Create playlist</span>
        </button>
      </div>

      <PlaylistDrawer
        collection={openCollection}
        onOpenChange={(o) => {
          if (!o) setOpenCollection(null);
        }}
      />
      <CreatePlaylistDrawer open={creating} onOpenChange={setCreating} />
    </div>
  );
}
