"use client";

import { useState } from "react";
import { PlusIcon } from "@radix-ui/react-icons";

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
import {
  CreatePlaylistTile,
  LibraryRowCard,
} from "@/components/studio/screens/LibraryRow";
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
            <LibraryRowCard collection={c} />
          </div>
        ))}

        <CreatePlaylistTile onClick={() => setCreating(true)} />
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
