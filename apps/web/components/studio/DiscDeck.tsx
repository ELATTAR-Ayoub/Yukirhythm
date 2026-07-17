"use client";

import { useEffect, useRef, useState } from "react";
import {
  PauseIcon,
  PlayIcon,
  TrackNextIcon,
  TrackPreviousIcon,
} from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import Texture, { TextureName } from "@/components/studio/Texture";
import { PlayerButton } from "@/components/studio/PlayerButton";

export interface DeckTrack {
  title: string;
  artist: string;
  texture?: TextureName;
  artUrl?: string;
}

type Phase = "paused" | "playing" | "lifting" | "installing";

const LIFT_MS = 380; // tonearm up + spin-down
const INSTALL_MS = 800; // carousel travel + seat the disc

/** One vinyl disc face — grooves, label artwork, spindle hole. */
function DiscFace({ track }: { track: DeckTrack }) {
  return (
    <div className="absolute inset-0 rounded-full overflow-hidden">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "repeating-radial-gradient(circle at center, #191919 0px, #191919 3px, #2b2b29 4px, #191919 5px)",
        }}
      />
      {/* light sweep so the grooves catch light */}
      <div className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,rgba(255,255,255,0.14)_0%,transparent_28%,transparent_72%,rgba(255,255,255,0.08)_100%)]" />
      {/* label */}
      <div className="absolute inset-[28%] rounded-full overflow-hidden border border-ink/70 shadow-e1">
        {track.artUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.artUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <Texture
            name={track.texture ?? "tx-k2-vinyl"}
            className="absolute inset-0"
          />
        )}
      </div>
      {/* spindle hole */}
      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-snow border border-ink/50" />
    </div>
  );
}

interface DiscDeckProps {
  tracks: DeckTrack[];
  className?: string;
  /** Signals: disc_next, disc_prev, play, pause */
}

/**
 * 3D turntable track carousel. The current disc spins under the tonearm;
 * prev/next wait tilted in 3D. Changing tracks lifts the arm, swaps discs,
 * seats the new one (install drop), then the needle returns and it plays.
 */
export default function DiscDeck({ tracks, className }: DiscDeckProps) {
  const [current, setCurrent] = useState(0);
  const [phase, setPhase] = useState<Phase>("paused");
  const timers = useRef<number[]>([]);
  const n = tracks.length;

  useEffect(() => {
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const spinning = phase === "playing";
  const armDown = phase === "playing";
  const busy = phase === "lifting" || phase === "installing";

  const go = (dir: 1 | -1) => {
    if (busy || n < 2) return;
    setPhase("lifting"); // needle up, platter stops
    timers.current.push(
      window.setTimeout(() => {
        setCurrent((c) => (c + dir + n) % n);
        setPhase("installing"); // carousel turns, disc seats
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
      className={cn("w-full flex flex-col items-center gap-5", className)}
      data-signal="disc_next, disc_prev"
    >
      {/* ── the deck ── */}
      <div className="relative w-full max-w-xl h-60 [perspective:1100px]">
        {tracks.map((t, i) => {
          const o = (((i - current) % n) + n) % n;
          const slot =
            o === 0
              ? "center"
              : o === 1
                ? "right"
                : o === n - 1
                  ? "left"
                  : "hidden";
          return (
            <div
              key={i}
              className={cn(
                "absolute left-1/2 top-1/2 -ml-24 -mt-24 h-48 w-48 [transform-style:preserve-3d]",
                "transition-all duration-slow ease-spring",
                slot === "center" && "z-20",
                slot === "left" &&
                  "z-10 [transform:translateX(-160px)_rotateY(55deg)_scale(0.66)] brightness-[0.65]",
                slot === "right" &&
                  "z-10 [transform:translateX(160px)_rotateY(-55deg)_scale(0.66)] brightness-[0.65]",
                slot === "hidden" &&
                  "z-0 opacity-0 [transform:translateY(60px)_scale(0.4)] pointer-events-none"
              )}
            >
              {/* install drop plays only on the disc that just became current */}
              <div
                className={cn(
                  "h-full w-full",
                  slot === "center" &&
                    phase === "installing" &&
                    "anim-disc-install"
                )}
              >
                <div
                  className={cn(
                    "relative h-full w-full rounded-full disc_shadow discRotation",
                    (slot !== "center" || !spinning) && "animation-state-pause"
                  )}
                >
                  <DiscFace track={t} />
                </div>
              </div>
            </div>
          );
        })}

        {/* ── tonearm ── */}
        <div className="absolute right-10 top-1 z-30" aria-hidden>
          {/* pivot base */}
          <div className="absolute -left-[18px] -top-[6px] h-10 w-10 rounded-full bg-secondary main_shadow" />
          <div className="absolute -left-[7px] top-[5px] h-4 w-4 rounded-full bg-ink-300 dark:bg-ink-600 shadow-e1" />
          {/* arm — hangs from the pivot; positive rotation swings onto the disc */}
          <div
            className={cn(
              "absolute left-0 top-2 origin-top transition-transform duration-slow ease-in-out",
              armDown ? "rotate-[16deg]" : "-rotate-[26deg]"
            )}
          >
            <div className="h-32 w-1.5 rounded-full bg-ink-400 dark:bg-ink-500 shadow-e2" />
            {/* headshell */}
            <div className="-ml-[5px] h-7 w-3.5 rounded-[3px] bg-ink shadow-e2" />
          </div>
        </div>
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
          {spinning ? <PauseIcon /> : <PlayIcon />}
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
