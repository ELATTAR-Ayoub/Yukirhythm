// apps/web/components/studio/deck/CarouselDeck.tsx
"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  PauseIcon,
  PlayIcon,
  TrackNextIcon,
  TrackPreviousIcon,
} from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import { PlayerButton } from "@/components/studio/PlayerButton";
import IconSwap from "@/components/studio/IconSwap";
import type { DeckTrack } from "@/components/studio/DiscDeck";
import { useDeckChoreography, type DeckPhase } from "./useDeckChoreography";
import type { DiscHandle } from "./Disc";
import type { TonearmHandle } from "./Tonearm";

// The WebGL scene is client-only — no SSR (it touches document at render).
const CarouselDeckScene = dynamic(() => import("./CarouselDeckScene"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center">
      <span className="type-label text-muted-foreground">
        WARMING UP THE DECK…
      </span>
    </div>
  ),
});

interface CarouselDeckProps {
  tracks: DeckTrack[];
  className?: string;
}

/**
 * Cinematic 3D turntable carousel. All slot/arm motion is owned by the
 * GSAP choreography hook; this wrapper owns React state and the DOM
 * overlay (title, controls, status line).
 */
export default function CarouselDeck({ tracks, className }: CarouselDeckProps) {
  const n = tracks.length;
  const [current, setCurrent] = useState(0);
  const [phase, setPhase] = useState<DeckPhase>("standby");
  const [glitch, setGlitch] = useState(false);
  const currentRef = useRef(0);

  const discs = useRef(new Map<number, DiscHandle>());
  const tonearm = useRef<TonearmHandle | null>(null);
  const registerDisc = useCallback((i: number, h: DiscHandle | null) => {
    if (h) discs.current.set(i, h);
    else discs.current.delete(i);
  }, []);
  const registerArm = useCallback((h: TonearmHandle | null) => {
    tonearm.current = h;
  }, []);

  const { swap, setArm } = useDeckChoreography({
    n,
    currentRef,
    setCurrent,
    setPhase,
    setGlitch,
    discs,
    tonearm,
  });

  const busy = phase === "swapping";
  const playing = phase === "playing";

  const toggle = () => {
    if (busy) return;
    if (playing) {
      setPhase("standby");
      setArm(false);
    } else {
      setPhase("playing");
      setArm(true);
    }
  };

  const onSideClick = useCallback(
    (idx: number) => {
      // Route through swap() so currentRef/state stay in sync; direction
      // comes from which side slot the clicked disc occupies.
      const offset = (((idx - currentRef.current) % n) + n) % n;
      if (offset === 1) swap("next");
      else if (offset === n - 1) swap("prev");
    },
    [n, swap]
  );

  const track = tracks[current];

  return (
    <div className={cn("w-full flex flex-col items-center gap-4", className)}>
      {/* ── the deck (WebGL) ── */}
      <div
        data-deck-stage
        className="relative w-full max-w-3xl h-[460px] rounded-lg overflow-hidden"
      >
        <CarouselDeckScene
          tracks={tracks}
          current={current}
          playing={playing}
          glitch={glitch}
          registerDisc={registerDisc}
          registerArm={registerArm}
          onSideClick={onSideClick}
        />
      </div>

      {/* ── now playing ── */}
      <div className="text-center min-h-[52px]">
        <div className={cn("type-h4", busy && "opacity-60")}>{track.title}</div>
        <div className="type-label text-muted-foreground mt-0.5">
          {track.artist}
        </div>
      </div>

      {/* ── controls — next/prev stay live during a swap (mash-proof) ── */}
      <div className="flex items-center gap-3">
        <PlayerButton onClick={() => swap("prev")} aria-label="Previous track">
          <TrackPreviousIcon />
        </PlayerButton>
        <PlayerButton
          variant="primary"
          size="lg"
          loading={busy}
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
        >
          <IconSwap
            active={playing ? "pause" : "play"}
            icons={{ play: <PlayIcon />, pause: <PauseIcon /> }}
          />
        </PlayerButton>
        <PlayerButton onClick={() => swap("next")} aria-label="Next track">
          <TrackNextIcon />
        </PlayerButton>
      </div>

      {/* machine status line */}
      <div className="type-label text-muted-foreground">
        {busy ? "SWAPPING DISC…" : playing ? "NOW SPINNING" : "ON STANDBY"}
      </div>
    </div>
  );
}
