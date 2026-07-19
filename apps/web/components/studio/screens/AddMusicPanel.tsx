"use client";

import { useMemo, useState } from "react";
import { CheckIcon, MagnifyingGlassIcon, PlusIcon } from "@radix-ui/react-icons";

import { Input } from "@/components/ui/input";
import TrackRow from "@/components/studio/TrackRow";
import EmptyState from "@/components/studio/EmptyState";
import { PlayerButton } from "@/components/studio/PlayerButton";
import { useMockStudio } from "./MockStudioProvider";
import {
  formatDuration,
  searchMockTracks,
  type MockCollection,
} from "./mock-data";

interface AddMusicPanelProps {
  collection: MockCollection;
  /** The drawer focuses the field on open; the docked rail must not. */
  autoFocus?: boolean;
}

/**
 * Search-and-add body. Suggestions render inline rather than in a floating
 * popover — on a phone a popup over a sheet is unreachable, and in the rail a
 * popover would escape the column.
 */
export default function AddMusicPanel({
  collection,
  autoFocus = false,
}: AddMusicPanelProps) {
  const { addTrackToCollection } = useMockStudio();
  const [q, setQ] = useState("");

  // Suggestions are synchronous here — no need for the debounced global search.
  const results = useMemo(() => (q.trim() ? searchMockTracks(q) : []), [q]);

  return (
    <>
      <div className="relative mt-4 mb-6">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          autoFocus={autoFocus}
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
    </>
  );
}
