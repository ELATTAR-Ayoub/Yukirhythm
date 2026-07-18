"use client";

import { ChevronDownIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import Texture from "@/components/studio/Texture";
import DataText from "@/components/studio/DataText";
import { PlayerButton } from "@/components/studio/PlayerButton";
import Transport from "./Transport";
import { useMockStudio } from "./MockStudioProvider";
import { formatDuration } from "./mock-data";

interface DevicePlayerProps {
  onCollapse?: () => void;
}

/** The full device player — the app's signature surface, now a component. */
export default function DevicePlayer({ onCollapse }: DevicePlayerProps) {
  const { nowPlaying, isPlaying, progressSec } = useMockStudio();

  return (
    <section className="player_shadow bg-card relative w-full max-w-[320px] rounded-[42px] sm:rounded-[52px] p-6 sm:p-8 flex flex-col items-center gap-6">
      {onCollapse ? (
        <PlayerButton
          variant="ghost"
          size="sm"
          aria-label="Collapse player"
          onClick={onCollapse}
          className="absolute top-4 right-4"
        >
          <ChevronDownIcon />
        </PlayerButton>
      ) : null}

      <div className="relative w-52 h-52 flex items-center justify-center">
        <div
          className={cn(
            "relative w-52 h-52 rounded-full overflow-hidden disc_shadow",
            isPlaying && "animate-[spin_6s_linear_infinite]"
          )}
        >
          <Texture name="tx-k2-vinyl" className="absolute inset-0 w-full h-full" />
          <div className="absolute inset-0 m-auto w-16 h-16 rounded-full overflow-hidden border-4 border-card">
            {nowPlaying ? (
              <Texture name={nowPlaying.texture} className="w-full h-full" />
            ) : (
              <div className="w-full h-full bg-ink" />
            )}
          </div>
        </div>
      </div>

      <div className="text-center w-full">
        <div className="font-label text-[11px] uppercase tracking-[0.2em] text-primary truncate">
          {nowPlaying ? nowPlaying.artist : "Welcome!"}
        </div>
        <div className="font-ui font-semibold truncate mt-0.5">
          {nowPlaying ? nowPlaying.title : "Pick a track"}
        </div>
        {nowPlaying ? (
          <DataText className="text-xs text-muted-foreground mt-1 inline-block">
            {formatDuration(progressSec)} / {formatDuration(nowPlaying.durationSec)}
          </DataText>
        ) : null}
      </div>

      <Transport size="lg" />
    </section>
  );
}
