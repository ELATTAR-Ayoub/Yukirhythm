"use client";

import Texture from "@/components/studio/Texture";
import DataText from "@/components/studio/DataText";
import { Slider } from "@/components/ui/slider";
import Transport from "./Transport";
import { useMockStudio } from "./MockStudioProvider";
import { formatDuration } from "./mock-data";

interface MiniPlayerBarProps {
  onExpand: () => void;
}

/** Compressed player — info left, controls right, tap to expand. */
export default function MiniPlayerBar({ onExpand }: MiniPlayerBarProps) {
  const { nowPlaying, progressSec, seek } = useMockStudio();
  if (!nowPlaying) return null;

  return (
    <div className="fixed inset-x-0 bottom-12 md:bottom-4 z-30 flex justify-center px-4 pb-2 md:pb-0 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-3xl rounded-lg border border-border bg-card shadow-e3 px-4 py-3 flex items-center gap-4">
        <button
          type="button"
          aria-label="Expand player"
          onClick={onExpand}
          className="flex items-center gap-4 min-w-0 flex-1 text-left rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <span className="relative w-11 h-11 rounded-md overflow-hidden shrink-0">
            <Texture
              name={nowPlaying.texture}
              className="absolute inset-0 w-full h-full"
            />
          </span>
          <span className="min-w-0">
            <span className="block font-ui font-medium text-sm truncate text-primary">
              {nowPlaying.title}
            </span>
            <span className="block font-label text-[10px] uppercase tracking-wider text-muted-foreground truncate">
              {nowPlaying.artist}
            </span>
          </span>
        </button>
        <div className="hidden sm:flex flex-1 items-center gap-3 min-w-0">
          <DataText className="text-xs text-muted-foreground shrink-0">
            {formatDuration(progressSec)}
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
          <Transport size="base" />
        </div>
      </div>
    </div>
  );
}
