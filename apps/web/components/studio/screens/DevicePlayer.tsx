"use client";

import { useState } from "react";
import { ChevronDownIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import DataText from "@/components/studio/DataText";
import { PlayerButton } from "@/components/studio/PlayerButton";
import Transport from "./Transport";
import VinylDisc from "./VinylDisc";
import QueueDrawer from "./QueueDrawer";
import { useMockStudio } from "./MockStudioProvider";
import { formatDuration } from "./mock-data";

interface DevicePlayerProps {
  onCollapse?: () => void;
}

/** The full device player — the app's signature surface, now a component. */
export default function DevicePlayer({ onCollapse }: DevicePlayerProps) {
  const { nowPlaying, isPlaying, progressSec, navDirection } = useMockStudio();
  const [discExpanded, setDiscExpanded] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  return (
    <section
      className={cn(
        "player_shadow bg-card relative overflow-hidden w-full max-w-[320px]",
        "rounded-[42px] sm:rounded-[52px] flex flex-col items-center"
      )}
    >
      {onCollapse ? (
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
          "text-center w-full px-6 sm:px-8 transition-opacity duration-500",
          discExpanded && "opacity-0 pointer-events-none"
        )}
      >
        <div className="font-label text-[11px] uppercase tracking-[0.2em] text-primary truncate">
          {nowPlaying ? nowPlaying.artist : "Welcome!"}
        </div>
        <div className="font-ui font-semibold truncate mt-0.5">
          {nowPlaying ? nowPlaying.title : "Pick a track"}
        </div>
        {nowPlaying ? (
          <DataText className="text-xs text-muted-foreground mt-1 inline-block">
            {formatDuration(progressSec)} /{" "}
            {formatDuration(nowPlaying.durationSec)}
          </DataText>
        ) : null}
      </div>

      {/* stays above the expanded disc so the controls never get covered */}
      <div className="relative z-20 py-6 sm:py-8">
        <Transport size="lg" onQueue={() => setQueueOpen(true)} />
      </div>

      <QueueDrawer open={queueOpen} onOpenChange={setQueueOpen} />
    </section>
  );
}
