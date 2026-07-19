"use client";

import { useMemo, useState } from "react";
import { CheckIcon, MagnifyingGlassIcon, PlusIcon } from "@radix-ui/react-icons";

import { Input } from "@/components/ui/input";
import { DrawerTitle } from "@/components/ui/drawer";
import TrackRow from "@/components/studio/TrackRow";
import EmptyState from "@/components/studio/EmptyState";
import { PlayerButton } from "@/components/studio/PlayerButton";
import AppDrawer from "./AppDrawer";
import { useMockStudio } from "./MockStudioProvider";
import {
  formatDuration,
  searchMockTracks,
  type MockCollection,
} from "./mock-data";

interface AddMusicDrawerProps {
  collection: MockCollection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Search-and-add sheet. Suggestions render inline in this drawer rather than
 * in a floating popover — on a phone a popup over a sheet is unreachable.
 */
export default function AddMusicDrawer({
  collection,
  open,
  onOpenChange,
}: AddMusicDrawerProps) {
  const { addTrackToCollection } = useMockStudio();
  const [q, setQ] = useState("");

  // Suggestions are synchronous here — no need for the debounced global search.
  const results = useMemo(() => (q.trim() ? searchMockTracks(q) : []), [q]);

  return (
    <AppDrawer open={open} onOpenChange={onOpenChange} height="full">
      <div className="max-w-3xl mx-auto">
        <DrawerTitle className="type-h2 truncate">Add music</DrawerTitle>
        <p className="type-muted mt-1 truncate">to {collection.title}</p>

        <div className="relative mt-4 mb-6">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tracks, artists, tags…"
            aria-label="Search tracks to add"
            className="pl-9"
            data-signal="add_music_search"
          />
        </div>

        {!q.trim() ? (
          <EmptyState
            title="Search to add"
            hint="Find a track by title, artist or tag."
            texture="tx-k2-static"
          />
        ) : results.length === 0 ? (
          <EmptyState
            title="No matches"
            hint="Try a different title, artist or tag."
            texture="tx-k2-static"
          />
        ) : (
          <div className="space-y-1">
            {results.map((track, i) => {
              const added = collection.trackIds.includes(track.id);
              return (
                <div key={track.id} className="flex items-center gap-1">
                  <div className="flex-1 min-w-0">
                    <TrackRow
                      index={i + 1}
                      title={track.title}
                      artist={track.artist}
                      duration={formatDuration(track.durationSec)}
                      texture={track.texture}
                    />
                  </div>
                  <PlayerButton
                    variant={added ? "primary" : "outline"}
                    size="sm"
                    disabled={added}
                    aria-label={
                      added
                        ? `${track.title} already added`
                        : `Add ${track.title}`
                    }
                    onClick={() => addTrackToCollection(collection.id, track.id)}
                    data-signal="add_music_confirm"
                  >
                    {added ? <CheckIcon /> : <PlusIcon />}
                  </PlayerButton>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppDrawer>
  );
}
