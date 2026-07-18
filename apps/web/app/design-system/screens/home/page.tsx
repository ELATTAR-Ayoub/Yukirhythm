"use client";

import { useState } from "react";
import { MagnifyingGlassIcon, PlusIcon } from "@radix-ui/react-icons";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import Texture from "@/components/studio/Texture";
import DataText from "@/components/studio/DataText";
import TrackRow from "@/components/studio/TrackRow";
import EmptyState from "@/components/studio/EmptyState";
import { SkeletonRow } from "@/components/studio/Skeletons";
import { PlayerButton } from "@/components/studio/PlayerButton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Transport from "@/components/studio/screens/Transport";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import {
  formatDuration,
  type MockTrack,
} from "@/components/studio/screens/mock-data";

export default function HomeScreen() {
  const {
    nowPlaying,
    isPlaying,
    progressSec,
    play,
    search,
    searchResults,
    searching,
    hasSearched,
    clearSearch,
  } = useMockStudio();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setOpen(true);
    search(q);
  };

  const pickTrack = (track: MockTrack) => {
    play(track);
    setOpen(false);
  };

  return (
    <div className="min-h-[68vh] flex items-center justify-center">
      <section className="player_shadow bg-card w-full max-w-[320px] rounded-[42px] sm:rounded-[52px] p-6 sm:p-8 flex flex-col items-center gap-6">
        {/* rotating disc */}
        <div className="relative w-52 h-52 flex items-center justify-center">
          <div
            className={cn(
              "relative w-52 h-52 rounded-full overflow-hidden disc_shadow",
              isPlaying && "animate-[spin_6s_linear_infinite]"
            )}
          >
            <Texture
              name="tx-k2-vinyl"
              className="absolute inset-0 w-full h-full"
            />
            <div className="absolute inset-0 m-auto w-16 h-16 rounded-full overflow-hidden border-4 border-card">
              {nowPlaying ? (
                <Texture name={nowPlaying.texture} className="w-full h-full" />
              ) : (
                <div className="w-full h-full bg-ink" />
              )}
            </div>
          </div>
        </div>

        {/* title / artist */}
        <div className="text-center w-full">
          <div className="font-label text-[11px] uppercase tracking-[0.2em] text-primary truncate">
            {nowPlaying ? nowPlaying.artist : "Welcome!"}
          </div>
          <div className="font-ui font-semibold truncate mt-0.5">
            {nowPlaying ? nowPlaying.title : "Search below"}
          </div>
          {nowPlaying ? (
            <DataText className="text-xs text-muted-foreground mt-1 inline-block">
              {formatDuration(progressSec)} / {formatDuration(nowPlaying.durationSec)}
            </DataText>
          ) : null}
        </div>

        {/* transport */}
        <Transport size="lg" />

        {/* search */}
        <form onSubmit={onSubmit} className="flex items-center gap-2 w-full">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tracks…"
            aria-label="Search tracks"
          />
          <PlayerButton
            type="submit"
            variant="primary"
            aria-label="Search"
            data-signal="search_query"
          >
            <MagnifyingGlassIcon />
          </PlayerButton>
        </form>
      </section>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) clearSearch();
        }}
      >
        <DialogContent className="max-w-2xl bg-card">
          <DialogHeader>
            <DialogTitle>Searched audios</DialogTitle>
            <DialogDescription>
              A curated list based on your search input.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-auto -mx-2 px-2">
            {searching ? (
              <div className="space-y-1">
                {Array.from({ length: 6 }, (_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-1">
                {searchResults.map((track, i) => (
                  <div key={track.id} className="flex items-center gap-1">
                    <div
                      className="flex-1 min-w-0"
                      onClick={() => pickTrack(track)}
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
                    <PlayerButton
                      variant="ghost"
                      size="sm"
                      aria-label="Add to queue"
                      data-signal="row_queue"
                      onClick={() => toast(`Added “${track.title}” to queue`)}
                    >
                      <PlusIcon />
                    </PlayerButton>
                  </div>
                ))}
              </div>
            ) : hasSearched ? (
              <EmptyState
                title="No audios found"
                hint="Try a different search — artist or title."
                texture="tx-k2-static"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
