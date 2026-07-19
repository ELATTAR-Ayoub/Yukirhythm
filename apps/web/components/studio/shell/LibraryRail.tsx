"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DrawingPinFilledIcon, PlusIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import MediaCard from "@/components/studio/MediaCard";
import { PlayerButton } from "@/components/studio/PlayerButton";
import SignInPrompt from "@/components/studio/screens/SignInPrompt";
import CreatePlaylistDrawer from "@/components/studio/screens/CreatePlaylistDrawer";
import { FilterChipRow } from "@/components/studio/screens/TagChip";
import {
  LIBRARY_FILTERS,
  filterLibrary,
} from "@/components/studio/screens/library-utils";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { playlistHref } from "./routes";

/**
 * The left column: the library, permanently docked. Rows navigate to the
 * playlist route rather than opening a sheet — on desktop the page column is
 * where detail belongs, and the rail must stay put so the user keeps their
 * place in the list.
 */
export default function LibraryRail() {
  const { user, collections, libraryFilter, setLibraryFilter } =
    useMockStudio();
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);

  if (!user) {
    return (
      <div className="p-4">
        <h2 className="type-h3 mb-3">Your Library</h2>
        <SignInPrompt hint="Playlists, podcasts and Liked Songs live here." />
      </div>
    );
  }

  const visible = filterLibrary(collections, libraryFilter);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3 shrink-0">
        <h2 className="type-h3">Your Library</h2>
        <PlayerButton
          variant="ghost"
          aria-label="Create playlist"
          onClick={() => setCreating(true)}
        >
          <PlusIcon />
        </PlayerButton>
      </div>

      <div className="px-4 shrink-0">
        <FilterChipRow
          options={LIBRARY_FILTERS}
          value={libraryFilter}
          onChange={setLibraryFilter}
          className="mb-4"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3 pb-4 space-y-2">
        {visible.map((c) => {
          const href = playlistHref(c.id);
          const active = pathname === href;
          return (
            <Link
              key={c.id}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={`Open collection ${c.title}`}
              className={cn(
                "relative block rounded-lg transition-colors duration-fast",
                active && "bg-secondary"
              )}
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
            </Link>
          );
        })}

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

      <CreatePlaylistDrawer open={creating} onOpenChange={setCreating} />
    </div>
  );
}
