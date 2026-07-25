"use client";

import ReactPlayer from "react-player";
import type { MutableRefObject } from "react";

/** The one slice of react-player's instance API the app uses. */
export type SeekablePlayer = {
  seekTo: (amount: number, type?: "seconds" | "fraction") => void;
};

interface HiddenYouTubePlayerProps {
  /**
   * Written from a callback ref on mount. A plain prop, deliberately not a
   * real `ref`: this component is loaded via next/dynamic, whose wrapper
   * does not reliably forward refs to the lazy-loaded class component —
   * which is exactly the silent-no-op seek bug this file exists to fix.
   */
  playerRef: MutableRefObject<SeekablePlayer | null>;
  url: string;
  playing: boolean;
  volume: number;
  onReady: () => void;
  onStart: () => void;
  onProgress: (s: { playedSeconds: number }) => void;
  onEnded: () => void;
}

/** Hidden real audio: the vinyl UI is decorative; sound comes from here. */
export default function HiddenYouTubePlayer({
  playerRef,
  ...player
}: HiddenYouTubePlayerProps) {
  return (
    <ReactPlayer
      ref={(p: ReactPlayer | null) => {
        playerRef.current = p;
      }}
      {...player}
      width="1px"
      height="1px"
    />
  );
}
