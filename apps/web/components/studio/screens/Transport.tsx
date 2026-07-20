"use client";

import { useState } from "react";
import {
  LoopIcon,
  PauseIcon,
  PlayIcon,
  TrackNextIcon,
  TrackPreviousIcon,
  ListBulletIcon,
} from "@radix-ui/react-icons";


import { PlayerButton, CircleSpinner } from "@/components/studio/PlayerButton";
import IconSwap from "@/components/studio/IconSwap";
import { useMockStudio } from "./MockStudioProvider";

/**
 * The transport cluster from the DS spec, wired to the mock player.
 * Left→right: loop · prev · play/pause/wait (3-face IconSwap) · next · queue.
 * `compact` drops loop and queue — the compressed bar carries transport only.
 *
 * With no track loaded the playback controls — prev, play/pause, next and
 * Loop — are all disabled. The bars now render permanently in an idle
 * state, so this cluster is on screen with nothing to act on, and a live
 * Loop toggle there would be playback state for a track that doesn't
 * exist. Queue stays live; see the note on it below.
 */
export default function Transport({
  size = "lg",
  compact = false,
  onQueue,
}: {
  size?: "base" | "lg";
  /** Compressed player — prev/play/next only, no loop or queue. */
  compact?: boolean;
  onQueue?: () => void;
}) {
  const { nowPlaying, isPlaying, isLoading, toggle, next, prev } =
    useMockStudio();
  const [looping, setLooping] = useState(false);
  const disabled = !nowPlaying;

  return (
    <div className="flex items-center gap-3">
      {compact ? null : (
        <PlayerButton
          variant={looping ? "primary" : "outline"}
          active={looping}
          onClick={() => setLooping((l) => !l)}
          disabled={disabled}
          aria-label="Loop"
          data-signal="loop"
        >
          <LoopIcon />
        </PlayerButton>
      )}
      <PlayerButton
        onClick={prev}
        disabled={disabled}
        aria-label="Previous"
        data-signal="disc_prev"
      >
        <TrackPreviousIcon />
      </PlayerButton>
      <PlayerButton
        variant="primary"
        size={size}
        onClick={toggle}
        disabled={disabled || isLoading}
        aria-label={isPlaying ? "Pause" : "Play"}
        data-signal={isPlaying ? "pause" : "play"}
      >
        <IconSwap
          active={isLoading ? "wait" : isPlaying ? "pause" : "play"}
          icons={{
            play: <PlayIcon />,
            pause: <PauseIcon />,
            wait: <CircleSpinner />,
          }}
        />
      </PlayerButton>
      <PlayerButton
        onClick={next}
        disabled={disabled}
        aria-label="Next"
        data-signal="disc_next"
      >
        <TrackNextIcon />
      </PlayerButton>
      {/* Queue is deliberately NOT disabled when idle: it is navigation to a
          page that still has content (an unstarted queue is the whole
          library), not a playback control, so nothing about it implies the
          bar is playing something. */}
      {compact ? null : (
        <PlayerButton
          variant="outline"
          onClick={onQueue}
          aria-label="Queue"
          data-signal="queue_open"
        >
          <ListBulletIcon />
        </PlayerButton>
      )}
    </div>
  );
}
