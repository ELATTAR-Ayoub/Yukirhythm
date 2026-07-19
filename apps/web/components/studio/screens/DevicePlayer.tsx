"use client";

import { useState } from "react";
import { ChevronDownIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import DataText from "@/components/studio/DataText";
import { PlayerButton } from "@/components/studio/PlayerButton";
import { Slider } from "@/components/ui/slider";
import Transport from "./Transport";
import VinylDisc from "./VinylDisc";
import PlayerSearchDrawer from "./PlayerSearchDrawer";
import { useMockStudio } from "./MockStudioProvider";
import { formatDuration } from "./mock-data";

interface DevicePlayerProps {
  onCollapse?: () => void;
  /**
   * Docked in the now-playing rail rather than presented as an overlay:
   * fills its column, no collapse control, and no search tray (the tray hangs
   * below the card and would collide with the panels beneath it in the rail).
   */
  docked?: boolean;
}

/** The full device player — the app's signature surface, now a component. */
export default function DevicePlayer({ onCollapse, docked = false }: DevicePlayerProps) {
  const { nowPlaying, isPlaying, progressSec, seek, navDirection, setQueueOpen } =
    useMockStudio();
  const [discExpanded, setDiscExpanded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className={cn("relative w-full", !docked && "max-w-[340px]")}>
      {/*
        The search tray. It sits behind the card and slides down out of it like
        the keyboard on a slider phone: tucked under the card's bottom edge so
        the two read as one chassis, with only the lower slab and its input
        showing. z-0 keeps it under the card, which hides the tucked portion.
      */}
      {docked ? null : (
        <div
          className={cn(
            "absolute inset-x-4 top-full -mt-11 z-0 anim-tray-out",
            "transition-opacity duration-500",
            discExpanded && "opacity-0 pointer-events-none"
          )}
        >
          <div
            className={cn(
              "rounded-b-[30px] border border-t-0 border-border bg-muted/60",
              "shadow-e3 pt-14 pb-4 px-4"
            )}
          >
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search tracks"
              data-signal="player_search_open"
              className={cn(
                "w-full flex items-center gap-2.5 rounded-full border border-border bg-background/70",
                "px-4 py-2.5 text-left text-muted-foreground",
                "hover:text-foreground hover:border-primary/40 transition-colors duration-fast",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              )}
            >
              <MagnifyingGlassIcon className="w-4 h-4 shrink-0" />
              <span className="type-small font-normal truncate">
                Search tracks, artists…
              </span>
            </button>
          </div>
        </div>
      )}

      <section
        className={cn(
          "player_shadow bg-card relative z-10 overflow-hidden w-full",
          "rounded-[42px] sm:rounded-[52px] flex flex-col items-center"
        )}
      >
      {!docked && onCollapse ? (
        <PlayerButton
          variant="ghost"
          size="sm"
          aria-label="Collapse player"
          onClick={onCollapse}
          className="absolute top-4 right-4 z-30"
        >
          <ChevronDownIcon />
        </PlayerButton>
      ) : null}

      {nowPlaying ? (
        <VinylDisc
          texture={nowPlaying.texture}
          trackKey={nowPlaying.id}
          direction={navDirection}
          spinning={isPlaying}
          expanded={discExpanded}
          onToggle={() => setDiscExpanded((e) => !e)}
        >
          <span className="block font-label text-[11px] uppercase tracking-[0.2em] text-ink-50/80 truncate">
            {nowPlaying.artist}
          </span>
          <span className="block font-ui font-semibold text-ink-50 truncate">
            {nowPlaying.title}
          </span>
        </VinylDisc>
      ) : null}

      {/* reserves the disc's visible half — 112% card width, so 56% for half */}
      <div aria-hidden className="w-full pt-[56%] shrink-0" />

      <div
        className={cn(
          "w-full px-7 transition-opacity duration-500",
          discExpanded && "opacity-0 pointer-events-none"
        )}
      >
        <div className="text-center mt-2">
          <div className="font-label text-[11px] uppercase tracking-[0.2em] text-primary truncate">
            {nowPlaying ? nowPlaying.artist : "Welcome!"}
          </div>
          <div className="font-ui font-semibold text-lg truncate mt-1">
            {nowPlaying ? nowPlaying.title : "Pick a track"}
          </div>
        </div>

        {/* Scrub bar — drag to jump to any second in the track. */}
        {nowPlaying ? (
          <div className="mt-6">
            <Slider
              value={[Math.min(progressSec, nowPlaying.durationSec)]}
              max={nowPlaying.durationSec}
              step={1}
              onValueChange={(v) => seek(v[0])}
              aria-label="Seek"
              data-signal="seek"
            />
            <div className="flex items-center justify-between mt-2">
              <DataText className="text-xs text-muted-foreground">
                {formatDuration(progressSec)}
              </DataText>
              <DataText className="text-xs text-muted-foreground">
                {formatDuration(nowPlaying.durationSec)}
              </DataText>
            </div>
          </div>
        ) : null}
      </div>

      {/* stays above the expanded disc so the controls never get covered */}
      <div className="relative z-20 mt-7">
        <Transport size="lg" onQueue={() => setQueueOpen(true)} />
      </div>

        <div aria-hidden className="w-full pb-8" />
      </section>

      <PlayerSearchDrawer open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
