"use client";

import { cn } from "@/lib/utils";
import SpinningDisc from "@/components/studio/SpinningDisc";
import DataText from "@/components/studio/DataText";
import { Slider } from "@/components/ui/slider";
import Transport from "./Transport";
import { useMockStudio } from "./MockStudioProvider";
import { formatDuration } from "./mock-data";

interface MiniPlayerBarProps {
  onExpand: () => void;
}

/** Elapsed/total with nothing loaded. Not "0:00" — that is a real position
 *  in a real track, and this bar has neither. */
const NO_TIME = "--:--";

/**
 * Compressed player — info left, controls right, tap to expand.
 *
 * Permanent chrome: it renders whether or not anything is playing, so the
 * bottom of the app has a constant height and the page column can reserve
 * exactly that much (see `--mobile-chrome-h`). With no track it keeps the
 * same card, footprint and control layout but goes deliberately inert — no
 * metadata, a blank art well rather than a record, `--:--` for both times, a
 * disabled seek, and a transport whose buttons are all disabled (Transport
 * derives that from `nowPlaying` itself). Nothing about the idle bar should
 * suggest it can be played.
 */
export default function MiniPlayerBar({ onExpand }: MiniPlayerBarProps) {
  const { nowPlaying, isPlaying, progressSec, seek } = useMockStudio();

  const identity = nowPlaying ? (
    <>
      <SpinningDisc
        texture={nowPlaying.texture}
        labelTexture="tx-k2-vinyl"
        spinning={isPlaying}
        className="w-11 h-11 shrink-0 disc_shadow"
        labelClassName="w-1/3 h-1/3 border-2 border-card"
      />
      <span className="min-w-0">
        <span className="block font-ui font-medium text-sm truncate">
          {nowPlaying.title}
        </span>
        <span className="block font-label text-[10px] uppercase tracking-wider text-muted-foreground truncate">
          {nowPlaying.artist}
        </span>
      </span>
    </>
  ) : (
    <>
      <span
        aria-hidden
        className="w-11 h-11 shrink-0 rounded-full border border-dashed border-border bg-secondary/40"
      />
      <span className="min-w-0">
        <span className="block font-label text-[10px] uppercase tracking-wider text-muted-foreground truncate">
          Nothing playing
        </span>
      </span>
    </>
  );

  return (
    // 12px above the bottom nav; md has no nav so it just clears the edge.
    // Both offsets come from the same tokens `main` reserves against, so the
    // bar and the space left for it cannot drift apart.
    <div className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+var(--mini-player-gap))] md:bottom-4 z-30 flex justify-center px-4 pointer-events-none">
      <div
        className={cn(
          "pointer-events-auto w-full max-w-3xl h-[var(--mini-player-h)]",
          "rounded-lg border border-border bg-card shadow-e3 px-4",
          "flex items-center gap-4"
        )}
      >
        {nowPlaying ? (
          <button
            type="button"
            aria-label="Expand player"
            onClick={onExpand}
            className="flex items-center gap-4 min-w-0 flex-1 text-left rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {identity}
          </button>
        ) : (
          // Not a button with nothing loaded: there is no fullscreen player
          // to expand into, and a focusable control that does nothing is
          // worse than no control at all.
          <div className="flex items-center gap-4 min-w-0 flex-1">{identity}</div>
        )}
        <div className="hidden sm:flex flex-1 items-center gap-3 min-w-0">
          <DataText className="text-xs text-muted-foreground shrink-0">
            {nowPlaying ? formatDuration(progressSec) : NO_TIME}
          </DataText>
          <Slider
            value={[
              nowPlaying ? Math.min(progressSec, nowPlaying.durationSec) : 0,
            ]}
            max={nowPlaying ? nowPlaying.durationSec : 1}
            step={1}
            disabled={!nowPlaying}
            onValueChange={(v) => seek(v[0])}
            aria-label="Seek"
            data-signal="seek"
          />
          <DataText className="text-xs text-muted-foreground shrink-0">
            {nowPlaying ? formatDuration(nowPlaying.durationSec) : NO_TIME}
          </DataText>
        </div>
        <div className="shrink-0">
          <Transport size="base" compact />
        </div>
      </div>
    </div>
  );
}
