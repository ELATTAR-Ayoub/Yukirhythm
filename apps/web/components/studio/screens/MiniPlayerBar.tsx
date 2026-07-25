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

/**
 * Compressed player — info left, controls right, tap to expand.
 *
 * Renders nothing with no track, unlike the desktop `PlaybackBar`, which
 * keeps an idle presentation. The two are not the same situation: at `md`+
 * the bar is an in-flow flex sibling, so hiding it would collapse the
 * shell's bottom row and shift the whole grid, whereas this one is `fixed`
 * and costs only the padding `main` reserves for it. On a phone an idle bar
 * is a dead 70px band competing with the tab bar for the scarcest space on
 * screen — with nothing to play there is nothing worth spending it on.
 *
 * `main`'s bottom reservation follows this same condition (see the `(app)`
 * layout), so the space and the bar appear and disappear together.
 */
export default function MiniPlayerBar({ onExpand }: MiniPlayerBarProps) {
  const { nowPlaying, isPlaying, progressSec, seek } = useMockStudio();
  if (!nowPlaying) return null;

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
        <button
          type="button"
          aria-label="Expand player"
          onClick={onExpand}
          className="flex items-center gap-4 min-w-0 flex-1 text-left rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <SpinningDisc
            texture={nowPlaying.texture}
            artUrl={nowPlaying.artUrl}
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
        </button>
        <div className="hidden sm:flex flex-1 items-center gap-3 min-w-0">
          <DataText className="text-xs text-muted-foreground shrink-0">
            {/* zeroIsKnown: 0s elapsed at the start of a track is real,
                unlike a 0/null duration — see formatDuration's doc. */}
            {formatDuration(progressSec, { zeroIsKnown: true })}
          </DataText>
          <Slider
            value={[Math.min(progressSec, nowPlaying.durationSec)]}
            max={nowPlaying.durationSec}
            step={1}
            onValueChange={(v) => seek(v[0])}
            aria-label="Seek"
            data-signal="seek"
          />
          <DataText className="text-xs text-muted-foreground shrink-0">
            {formatDuration(nowPlaying.durationSec)}
          </DataText>
        </div>
        <div className="shrink-0">
          <Transport size="base" compact />
        </div>
      </div>
    </div>
  );
}
