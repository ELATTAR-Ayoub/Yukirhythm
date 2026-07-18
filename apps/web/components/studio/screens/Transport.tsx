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
import { toast } from "sonner";

import { PlayerButton, CircleSpinner } from "@/components/studio/PlayerButton";
import IconSwap from "@/components/studio/IconSwap";
import { useMockStudio } from "./MockStudioProvider";

/**
 * The transport cluster from the DS spec, wired to the mock player.
 * Left→right: loop · prev · play/pause/wait (3-face IconSwap) · next · queue.
 */
export default function Transport({ size = "lg" }: { size?: "base" | "lg" }) {
  const { queue, nowPlaying, isPlaying, isLoading, toggle, next, prev } =
    useMockStudio();
  const [looping, setLooping] = useState(false);
  const disabled = !nowPlaying;

  return (
    <div className="flex items-center gap-3">
      <PlayerButton
        variant={looping ? "primary" : "outline"}
        active={looping}
        onClick={() => setLooping((l) => !l)}
        aria-label="Loop"
        data-signal="loop"
      >
        <LoopIcon />
      </PlayerButton>
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
      <PlayerButton
        variant="outline"
        onClick={() => toast(`Queue · ${queue.length} tracks`)}
        aria-label="Queue"
        data-signal="queue_open"
      >
        <ListBulletIcon />
      </PlayerButton>
    </div>
  );
}
