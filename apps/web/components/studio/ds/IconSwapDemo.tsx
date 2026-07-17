"use client";

import { useState } from "react";
import {
  PauseIcon,
  PlayIcon,
  SpeakerLoudIcon,
  SpeakerOffIcon,
  HeartIcon,
  HeartFilledIcon,
} from "@radix-ui/react-icons";

import IconSwap from "@/components/studio/IconSwap";
import { PlayerButton } from "@/components/studio/PlayerButton";

/** Live IconSwap demos — click each button and watch the roll. */
export default function IconSwapDemo() {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [liked, setLiked] = useState(false);

  return (
    <div className="flex flex-wrap items-start gap-x-8 gap-y-5">
      <div className="flex flex-col items-center gap-2">
        <PlayerButton
          variant="primary"
          size="lg"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause" : "Play"}
        >
          <IconSwap
            active={playing ? "pause" : "play"}
            icons={{ play: <PlayIcon />, pause: <PauseIcon /> }}
          />
        </PlayerButton>
        <span className="type-label text-muted-foreground">play / pause</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <PlayerButton
          size="lg"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          <IconSwap
            active={muted ? "off" : "on"}
            icons={{ on: <SpeakerLoudIcon />, off: <SpeakerOffIcon /> }}
          />
        </PlayerButton>
        <span className="type-label text-muted-foreground">mute / unmute</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <PlayerButton
          variant="outline"
          size="lg"
          onClick={() => setLiked((l) => !l)}
          aria-label={liked ? "Unlike" : "Like"}
          className={liked ? "text-destructive" : undefined}
        >
          <IconSwap
            active={liked ? "liked" : "unliked"}
            icons={{ unliked: <HeartIcon />, liked: <HeartFilledIcon /> }}
          />
        </PlayerButton>
        <span className="type-label text-muted-foreground">like / unlike</span>
      </div>
    </div>
  );
}
