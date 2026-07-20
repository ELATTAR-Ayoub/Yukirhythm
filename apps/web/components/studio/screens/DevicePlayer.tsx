"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import DataText from "@/components/studio/DataText";
import { PlayerButton } from "@/components/studio/PlayerButton";
import { Slider } from "@/components/ui/slider";
import Transport from "./Transport";
import VinylDisc from "./VinylDisc";
import PlayerSearchDrawer from "./PlayerSearchDrawer";
import { useMockStudio } from "./MockStudioProvider";
import { QUEUE } from "../shell/routes";
import { formatDuration } from "./mock-data";
import { IDLE_LABEL, NO_TIME } from "./player-idle";

interface DevicePlayerProps {
  onCollapse?: () => void;
  /**
   * Docked in the now-playing rail rather than presented as an overlay:
   * fills its column, no collapse control, and no search tray (the tray hangs
   * below the card and would collide with the panels beneath it in the rail).
   */
  docked?: boolean;
}

/**
 * The full device player — the app's signature surface, now a component.
 *
 * With no track it renders the same chassis, unloaded: a blank art well
 * where the record sits, `IDLE_LABEL` instead of metadata, and a disabled
 * seek reading `--:--` at both ends. Every part of that is laid out to
 * occupy the SAME footprint as a loaded player — the art well mirrors
 * VinylDisc's absolute geometry (so, like the disc, it contributes no flow
 * height; the `pt-[56%]` spacer below reserves the visible half either
 * way), and the scrub block renders in both states rather than being
 * omitted when idle. The rail must not jump when playback starts.
 */
export default function DevicePlayer({ onCollapse, docked = false }: DevicePlayerProps) {
  const { nowPlaying, isPlaying, progressSec, seek, navDirection } =
    useMockStudio();
  const router = useRouter();
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
      ) : (
        // The empty art well. Same absolute geometry as VinylDisc's own
        // button (half off the top, clipped by the card) so the silhouette
        // and the footprint are identical — just no record in it. Not a
        // button: there is nothing to expand.
        <span
          aria-hidden
          className={cn(
            "absolute z-10 left-1/2 top-0 w-[112%] aspect-square",
            "-translate-x-1/2 -translate-y-1/2 rounded-full",
            "border border-dashed border-border bg-secondary/40"
          )}
        />
      )}

      {/* reserves the disc's visible half — 112% card width, so 56% for half */}
      <div aria-hidden className="w-full pt-[56%] shrink-0" />

      <div
        className={cn(
          "w-full px-7 transition-opacity duration-500",
          discExpanded && "opacity-0 pointer-events-none"
        )}
      >
        <div className="text-center mt-2">
          {/* Idle keeps both lines so the block is the same height either
              way — the artist slot holds a non-breaking space rather than
              collapsing, and the title slot states the player's state
              instead of naming a track that isn't loaded. */}
          <div
            aria-hidden={!nowPlaying}
            className="font-label text-[11px] uppercase tracking-[0.2em] text-primary truncate"
          >
            {nowPlaying ? nowPlaying.artist : " "}
          </div>
          <div
            className={cn(
              "font-ui font-semibold text-lg truncate mt-1",
              !nowPlaying && "text-muted-foreground"
            )}
          >
            {nowPlaying ? nowPlaying.title : IDLE_LABEL}
          </div>
        </div>

        {/* Scrub bar — drag to jump to any second in the track. Rendered in
            both states (disabled and reading --:-- when idle) so the chassis
            keeps one height; omitting it made the empty rail player shorter
            than a loaded one and the whole column jumped on first play. */}
        <div className="mt-6">
          <Slider
            value={[nowPlaying ? Math.min(progressSec, nowPlaying.durationSec) : 0]}
            max={nowPlaying ? nowPlaying.durationSec : 1}
            step={1}
            disabled={!nowPlaying}
            onValueChange={(v) => seek(v[0])}
            aria-label="Seek"
            data-signal="seek"
          />
          <div className="flex items-center justify-between mt-2">
            <DataText className="text-xs text-muted-foreground">
              {nowPlaying ? formatDuration(progressSec) : NO_TIME}
            </DataText>
            <DataText className="text-xs text-muted-foreground">
              {nowPlaying ? formatDuration(nowPlaying.durationSec) : NO_TIME}
            </DataText>
          </div>
        </div>
      </div>

      {/* stays above the expanded disc so the controls never get covered */}
      <div className="relative z-20 mt-7">
        <Transport size="lg" onQueue={() => router.push(QUEUE)} />
      </div>

        <div aria-hidden className="w-full pb-8" />
      </section>

      <PlayerSearchDrawer open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
