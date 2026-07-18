"use client";

import { useState } from "react";
import {
  ChevronLeftIcon,
  PlayIcon,
  PlusIcon,
  ShuffleIcon,
} from "@radix-ui/react-icons";
import { toast } from "sonner";

import { DrawerClose, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import DataText from "@/components/studio/DataText";
import MediaCard from "@/components/studio/MediaCard";
import TrackRow from "@/components/studio/TrackRow";
import EmptyState from "@/components/studio/EmptyState";
import { PlayerButton } from "@/components/studio/PlayerButton";
import AppDrawer from "./AppDrawer";
import TrackMenu from "./TrackMenu";
import ViewToggle, { type TrackView } from "./ViewToggle";
import SortControl from "./SortControl";
import { TagChip } from "./TagChip";
import { sortTracks, type TrackSort } from "./library-utils";
import { useMockStudio } from "./MockStudioProvider";
import {
  formatDuration,
  getCollectionTracks,
  type MockCollection,
} from "./mock-data";

interface PlaylistDrawerProps {
  collection: MockCollection | null;
  onOpenChange: (open: boolean) => void;
}

/** 95vh playlist detail — play, shuffle, tags, view/sort, tracks with menus. */
export default function PlaylistDrawer({
  collection,
  onOpenChange,
}: PlaylistDrawerProps) {
  const { play, nowPlaying, isPlaying } = useMockStudio();
  const [view, setView] = useState<TrackView>("rows");
  const [sort, setSort] = useState<TrackSort>("recent");

  const tracks = collection
    ? sortTracks(getCollectionTracks(collection), sort)
    : [];

  /** Enter/Space activation for non-button click targets. */
  const playKeyHandler =
    (track: (typeof tracks)[number]) => (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        play(track);
      }
    };

  return (
    <AppDrawer open={collection !== null} onOpenChange={onOpenChange} height="95vh">
      {collection ? (
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2">
            <DrawerClose asChild>
              <PlayerButton variant="ghost" size="sm" aria-label="Back">
                <ChevronLeftIcon />
              </PlayerButton>
            </DrawerClose>
            <DrawerTitle className="type-h2 truncate">
              {collection.title}
            </DrawerTitle>
            <DataText className="text-sm text-muted-foreground ml-auto shrink-0">
              {tracks.length} tracks
            </DataText>
          </div>

          <p className="type-muted mt-2">{collection.desc}</p>

          <div className="flex items-center gap-3 mt-4">
            <PlayerButton
              variant="primary"
              size="lg"
              aria-label="Play collection"
              onClick={() => tracks[0] && play(tracks[0])}
            >
              <PlayIcon />
            </PlayerButton>
            <PlayerButton
              variant="outline"
              aria-label="Shuffle collection"
              onClick={() =>
                tracks.length &&
                play(tracks[Math.floor(Math.random() * tracks.length)])
              }
            >
              <ShuffleIcon />
            </PlayerButton>
            <div className="flex flex-wrap gap-1.5 ml-2">
              {collection.tags.map((tag) => (
                <TagChip key={tag} label={tag} />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mt-6 mb-2">
            <div className="flex items-center gap-2">
              <ViewToggle view={view} onChange={setView} />
              <SortControl sort={sort} onChange={setSort} />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast(`Pick tracks to add to “${collection.title}”`)}
            >
              <PlusIcon className="mr-1.5 h-3.5 w-3.5" /> Add to this playlist
            </Button>
          </div>

          {tracks.length === 0 ? (
            <EmptyState
              title="Nothing in here yet"
              hint="Add tracks with the button above."
              texture="tx-k2-static"
            />
          ) : view === "rows" ? (
            <div className="space-y-1">
              {tracks.map((track, i) => (
                <div key={track.id} className="flex items-center gap-1">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`Play ${track.title}`}
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => play(track)}
                    onKeyDown={playKeyHandler(track)}
                  >
                    <TrackRow
                      index={i + 1}
                      title={track.title}
                      artist={track.artist}
                      duration={formatDuration(track.durationSec)}
                      texture={track.texture}
                      playing={nowPlaying?.id === track.id && isPlaying}
                    />
                  </div>
                  <TrackMenu trackTitle={track.title} />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {tracks.map((track) => (
                <div
                  key={track.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Play ${track.title}`}
                  className="text-left cursor-pointer"
                  onClick={() => play(track)}
                  onKeyDown={playKeyHandler(track)}
                >
                  <MediaCard
                    title={track.title}
                    artist={track.artist}
                    texture={track.texture}
                    size="sm"
                    playing={nowPlaying?.id === track.id && isPlaying}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </AppDrawer>
  );
}
