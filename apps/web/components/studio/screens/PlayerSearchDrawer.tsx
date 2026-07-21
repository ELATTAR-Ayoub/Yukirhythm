"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";

import { Input } from "@/components/ui/input";
import { DrawerTitle } from "@/components/ui/drawer";
import TrackRow from "@/components/studio/TrackRow";
import EmptyState from "@/components/studio/EmptyState";
import FadeScrollArea from "@/components/studio/FadeScrollArea";
import AppDrawer from "./AppDrawer";
import { useMockStudio } from "./MockStudioProvider";
import { formatDuration, searchMockTracks } from "./mock-data";

interface PlayerSearchDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Seeds the field from the input the user typed into on the player. */
  initialQuery?: string;
}

/** Search the catalogue from the player and jump straight to a track. */
export default function PlayerSearchDrawer({
  open,
  onOpenChange,
  initialQuery = "",
}: PlayerSearchDrawerProps) {
  const { play, nowPlaying, isPlaying } = useMockStudio();
  const [q, setQ] = useState(initialQuery);

  const results = useMemo(() => (q.trim() ? searchMockTracks(q) : []), [q]);

  return (
    <AppDrawer open={open} onOpenChange={onOpenChange} height="full">
      <div className="max-w-3xl mx-auto">
        <DrawerTitle className="type-h2">Search</DrawerTitle>

        <div className="relative mt-4 mb-6">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tracks, artists, tags…"
            aria-label="Search tracks"
            className="pl-9"
            data-signal="player_search"
          />
        </div>

        {!q.trim() ? (
          <EmptyState
            title="What do you want to hear?"
            hint="Search by title, artist or tag."
            texture="tx-k2-static"
          />
        ) : results.length === 0 ? (
          <EmptyState
            title="No results"
            hint="Try a different title, artist or tag."
            texture="tx-k2-static"
          />
        ) : (
          <FadeScrollArea maxHeight="max-h-[70vh]" className="space-y-1">
            {results.map((track, i) => (
              <div
                key={track.id}
                role="button"
                tabIndex={0}
                aria-label={`Play ${track.title}`}
                className="cursor-pointer"
                onClick={() => {
                  play(track);
                  onOpenChange(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    play(track);
                    onOpenChange(false);
                  }
                }}
              >
                {/* No play overlay: this row sits inside a role="button" div,
                    and TrackRow's overlay would nest a button inside it. */}
                <TrackRow
                  index={i + 1}
                  title={track.title}
                  artist={track.artist}
                  duration={formatDuration(track.durationSec)}
                  texture={track.texture}
                  artUrl={track.artUrl}
                  playing={nowPlaying?.id === track.id && isPlaying}
                  playable={false}
                />
              </div>
            ))}
          </FadeScrollArea>
        )}
      </div>
    </AppDrawer>
  );
}
