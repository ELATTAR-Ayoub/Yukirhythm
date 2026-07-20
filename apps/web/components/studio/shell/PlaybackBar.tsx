"use client";

import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import SpinningDisc from "@/components/studio/SpinningDisc";
import DataText from "@/components/studio/DataText";
import { Slider } from "@/components/ui/slider";
import Transport from "@/components/studio/screens/Transport";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { formatDuration } from "@/components/studio/screens/mock-data";
import {
  IDLE_LABEL,
  NO_TIME,
} from "@/components/studio/screens/player-idle";
import { useIsWide } from "./useBreakpoint";
import PlayerExtras from "./PlayerExtras";
import { QUEUE } from "./routes";

interface PlaybackBarProps {
  /** Opens the fullscreen DevicePlayer overlay. Ignored at 1440+ — see below. */
  onExpand: () => void;
}

/**
 * Full-width desktop playback bar (md and up, replacing MiniPlayerBar).
 * Left: art + title/artist. Centre: transport above a seek slider flanked by
 * elapsed/total. Right: volume and fullscreen, in a block matching the left
 * one's footprint so the transport stays optically centred rather than
 * drifting toward whichever side is lighter. That block used to be an empty
 * spacer holding the balance; real controls of the same width do it honestly.
 *
 * At `useIsWide()` (1440+) the left block is plain info, not a button: the
 * now-playing rail is on screen at that width and already *is* the expanded
 * player, so a fullscreen overlay would duplicate a surface the user can
 * already see. Below 1440 it's a button that opens that overlay.
 *
 * Permanent chrome: it renders whether or not anything is playing, so the
 * shell's bottom row keeps a constant height — it is an in-flow flex
 * sibling here, so hiding it would collapse that row and shift the whole
 * grid. (`MiniPlayerBar` is `fixed` and does hide, for the opposite
 * reason.) With no track it keeps the
 * same card, footprint and control layout but goes deliberately inert — no
 * metadata, a blank art well rather than a record, `--:--` for both times, a
 * disabled seek, and a transport whose buttons are all disabled (Transport
 * derives that from `nowPlaying` itself). Nothing about the idle bar should
 * suggest it can be played.
 */
export default function PlaybackBar({ onExpand }: PlaybackBarProps) {
  const { nowPlaying, isPlaying, progressSec, seek } = useMockStudio();
  const router = useRouter();
  const isWide = useIsWide();

  const identity = nowPlaying ? (
    <>
      <SpinningDisc
        texture={nowPlaying.texture}
        labelTexture="tx-k2-vinyl"
        spinning={isPlaying}
        className="w-12 h-12 shrink-0 disc_shadow"
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
        className="w-12 h-12 shrink-0 rounded-full border border-dashed border-border bg-secondary/40"
      />
      <span className="min-w-0">
        <span className="block font-label text-[10px] uppercase tracking-wider text-muted-foreground truncate">
          {IDLE_LABEL}
        </span>
      </span>
    </>
  );

  // Shared footprint for the left block and its balancing spacer, so both
  // presentations (button vs. plain div) take up the same width.
  const sideBlockClass = "flex-1 basis-[340px] max-w-[30%] min-w-0";

  return (
    <div
      className={cn(
        "h-[var(--shell-bar-h)] w-full shrink-0 flex items-center gap-4 px-4",
        "rounded-lg border border-border bg-card shadow-e3"
      )}
    >
      <div className={sideBlockClass}>
        {/* Plain info at 1440+ (the rail already is the expanded player) and
            also whenever nothing is loaded — with no track there is no
            fullscreen player to expand into, and a focusable control that
            does nothing is worse than no control at all. */}
        {isWide || !nowPlaying ? (
          <div className="flex items-center gap-3 min-w-0">{identity}</div>
        ) : (
          <button
            type="button"
            aria-label="Expand player"
            onClick={onExpand}
            className={cn(
              "flex items-center gap-3 min-w-0 w-full text-left rounded-md",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            )}
          >
            {identity}
          </button>
        )}
      </div>

      <div className="flex-[2] flex flex-col items-center gap-2 min-w-0 max-w-xl mx-auto">
        {/* PlaybackBar only ever renders once GlobalPlayer's own isDesktop
            check picks it over MiniPlayerBar, so unlike NowPlayingRail/
            DevicePlayer there is no mobile fallback to branch to here. */}
        <Transport size="base" onQueue={() => router.push(QUEUE)} />
        <div className="w-full flex items-center gap-2">
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
      </div>

      <div className={sideBlockClass}>
        <PlayerExtras />
      </div>
    </div>
  );
}
