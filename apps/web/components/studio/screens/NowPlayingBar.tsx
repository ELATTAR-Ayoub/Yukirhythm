"use client";

import Texture from "@/components/studio/Texture";
import DataText from "@/components/studio/DataText";
import { Slider } from "@/components/ui/slider";
import Transport from "./Transport";
import { useMockStudio } from "./MockStudioProvider";
import { formatDuration } from "./mock-data";

/** Persistent now-playing bar — the shared floating player surface (shadow-e3). */
export default function NowPlayingBar() {
  const { nowPlaying, progressSec, seek } = useMockStudio();
  if (!nowPlaying) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-3xl rounded-lg border border-border bg-card shadow-e3 px-4 py-3 flex items-center gap-4">
        <div className="relative w-11 h-11 rounded-md overflow-hidden shrink-0">
          <Texture
            name={nowPlaying.texture}
            className="absolute inset-0 w-full h-full"
          />
        </div>
        <div className="min-w-0 w-36 shrink-0">
          <div className="font-ui font-medium text-sm truncate text-primary">
            {nowPlaying.title}
          </div>
          <div className="font-label text-[10px] uppercase tracking-wider text-muted-foreground truncate">
            {nowPlaying.artist}
          </div>
        </div>
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
        <div className="shrink-0 ml-auto sm:ml-0">
          <Transport size="base" />
        </div>
      </div>
    </div>
  );
}
