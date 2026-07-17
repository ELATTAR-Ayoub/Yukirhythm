"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  PauseIcon,
  PlayIcon,
  TrackNextIcon,
  TrackPreviousIcon,
} from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import type { TextureName } from "@/components/studio/Texture";
import { PlayerButton } from "@/components/studio/PlayerButton";
import IconSwap from "@/components/studio/IconSwap";

export interface DeckTrack {
  title: string;
  artist: string;
  texture?: TextureName;
  artUrl?: string;
}

export type DeckPhase = "paused" | "playing" | "lifting" | "installing";

const LIFT_MS = 450; // tonearm up + spin-down
const INSTALL_MS = 1000; // carousel travel + seat the disc

// The WebGL scene is client-only — no SSR.
const DeckScene = dynamic(() => import("@/components/studio/deck/DeckScene"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center">
      <span className="type-label text-muted-foreground">
        WARMING UP THE DECK…
      </span>
    </div>
  ),
});

interface DiscDeckProps {
  tracks: DeckTrack[];
  className?: string;
  /** Signals: disc_next, disc_prev, play, pause */
}

/**
 * Real-3D turntable track carousel (three.js). The current disc spins under
 * a physical tonearm; neighbours hover tilted at the sides. Changing tracks:
 * needle lifts, platter spins down, carousel turns, the incoming disc drops
 * onto the spindle, needle returns, spin-up.
 */
export default function DiscDeck({ tracks, className }: DiscDeckProps) {
  const [current, setCurrent] = useState(0);
  const [phase, setPhase] = useState<DeckPhase>("paused");
  const timers = useRef<number[]>([]);
  const n = tracks.length;

  useEffect(() => {
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const spinning = phase === "playing";
  const busy = phase === "lifting" || phase === "installing";

  const go = (dir: 1 | -1) => {
    if (busy || n < 2) return;
    setPhase("lifting");
    timers.current.push(
      window.setTimeout(() => {
        setCurrent((c) => (c + dir + n) % n);
        setPhase("installing");
        timers.current.push(
          window.setTimeout(() => setPhase("playing"), INSTALL_MS)
        );
      }, LIFT_MS)
    );
  };

  const toggle = () => {
    if (busy) return;
    setPhase((p) => (p === "playing" ? "paused" : "playing"));
  };

  const track = tracks[current];

  return (
    <div
      className={cn("w-full flex flex-col items-center gap-4", className)}
      data-signal="disc_next, disc_prev"
    >
      {/* ── the deck (WebGL) ── */}
      <div
        data-deck-stage
        className="relative w-full max-w-2xl h-[380px] rounded-lg overflow-hidden"
      >
        <DeckScene
          tracks={tracks}
          current={current}
          phase={phase}
          spinning={spinning}
        />
      </div>

      {/* ── now playing ── */}
      <div className="text-center min-h-[52px]">
        <div className={cn("type-h4", busy && "opacity-50")}>{track.title}</div>
        <div className="type-label text-muted-foreground mt-0.5">
          {track.artist}
        </div>
      </div>

      {/* ── controls ── */}
      <div className="flex items-center gap-3">
        <PlayerButton
          disabled={busy}
          onClick={() => go(-1)}
          aria-label="Previous track"
        >
          <TrackPreviousIcon />
        </PlayerButton>
        <PlayerButton
          variant="primary"
          size="lg"
          loading={busy}
          onClick={toggle}
          aria-label={spinning ? "Pause" : "Play"}
        >
          <IconSwap
            active={spinning ? "pause" : "play"}
            icons={{ play: <PlayIcon />, pause: <PauseIcon /> }}
          />
        </PlayerButton>
        <PlayerButton
          disabled={busy}
          onClick={() => go(1)}
          aria-label="Next track"
        >
          <TrackNextIcon />
        </PlayerButton>
      </div>

      {/* machine status line */}
      <div className="type-label text-muted-foreground">
        {phase === "installing"
          ? "INSTALLING DISC…"
          : phase === "lifting"
            ? "LIFTING NEEDLE…"
            : phase === "playing"
              ? "NOW SPINNING"
              : "ON STANDBY"}
      </div>
    </div>
  );
}
