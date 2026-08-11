"use client";

import { toast } from "sonner";

import MediaCard, {
  type MediaCardSize,
  type MediaCardVariant,
} from "@/components/studio/MediaCard";
import { cn } from "@/lib/utils";
import { useMockStudio } from "./MockStudioProvider";
import {
  formatDuration,
  previewStartForTrack,
  type MockTrack,
} from "./mock-data";

/**
 * The canonical interactive song card. Browsing is queue-neutral: one click
 * auditions, two clicks persist an enqueue, and only the explicit play control
 * starts full playback.
 */
export default function StudioMediaCard({
  track,
  size = "md",
  variant = "boxy",
  className,
  onPlayFull,
}: {
  track: MockTrack;
  size?: MediaCardSize;
  variant?: MediaCardVariant;
  className?: string;
  onPlayFull?: () => void;
}) {
  const {
    play,
    enqueuePersisted,
    nowPlaying,
    isPlaying,
    previewTrack,
    previewProgressSec,
    startPreview,
    stopPreview,
  } = useMockStudio();
  const previewActive = previewTrack?.id === track.id;
  const previewSecondsRemaining = previewActive
    ? 10 - (previewProgressSec - previewStartForTrack(track))
    : undefined;

  const addToQueue = () => {
    const pending = enqueuePersisted(track, "end");
    toast.promise(pending, {
      loading: `Adding “${track.title}”…`,
      success: `“${track.title}” added to queue`,
      error: `Couldn’t add “${track.title}” to queue`,
    });
  };

  return (
    <MediaCard
      title={track.title}
      artist={track.artist}
      texture={track.texture}
      artUrl={track.artUrl}
      duration={formatDuration(track.durationSec)}
      size={size}
      variant={variant}
      playing={nowPlaying?.id === track.id && isPlaying}
      previewSecondsRemaining={previewSecondsRemaining}
      className={cn(previewActive && "ring-2 ring-primary", className)}
      onPreview={() => startPreview(track)}
      onPlayFull={() => {
        stopPreview();
        if (onPlayFull) onPlayFull();
        else play(track);
      }}
      onAddToQueue={addToQueue}
    />
  );
}
