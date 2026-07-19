"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import Texture, { type TextureName } from "@/components/studio/Texture";

const ARC_MS = 520;

/** The travelling element: a clipped disc that fills its wrapper. */
const discShape = (expanded: boolean) =>
  cn(
    "absolute inset-0 overflow-hidden",
    expanded
      ? "rounded-[42px] sm:rounded-[52px]"
      : "rounded-full disc_shadow"
  );

interface VinylDiscProps {
  /** Artwork for the current track — fills the disc face. */
  texture: TextureName;
  /** Changes whenever the track changes; drives the arc swap. */
  trackKey: string;
  /** Which way the last change went, so the disc arcs the right way. */
  direction: "next" | "prev" | null;
  spinning: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** Revealed over the artwork once expanded (artist, title, time). */
  children?: React.ReactNode;
}

/** One disc face — artwork under the grooves, label at the spindle. */
function DiscFace({
  texture,
  spinning,
  expanded,
}: {
  texture: TextureName;
  spinning: boolean;
  expanded: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0",
        // Only the circle spins. Expanded it fills a rounded rect, where any
        // rotation would swing the artwork's corners off the card.
        !expanded && "discRotation",
        // paused in place rather than unmounting the animation, so the disc
        // resumes at the angle it stopped at instead of snapping back to 0
        !spinning && "animation-state-pause"
      )}
    >
      <Texture name={texture} className="absolute inset-0 w-full h-full" />
      <div
        className={cn(
          "absolute inset-0 m-auto w-16 h-16 rounded-full overflow-hidden",
          "border-4 border-card transition-opacity duration-500",
          expanded && "opacity-0"
        )}
      >
        <Texture name="tx-k2-vinyl" className="w-full h-full" />
      </div>
    </div>
  );
}

/**
 * The signature disc, ported from the landing hero: it sits half-off the top
 * of its card (the card clips it), and a tap re-centers it to fill the card so
 * the artwork reads full-size. Track changes arc the old disc off one shoulder
 * as the new one swings in from the other.
 *
 * The parent must be `relative overflow-hidden`.
 */
export default function VinylDisc({
  texture,
  trackKey,
  direction,
  spinning,
  expanded,
  onToggle,
  children,
}: VinylDiscProps) {
  // While swapping we hold the previous face on screen so both can animate.
  const [outgoing, setOutgoing] = useState<{
    key: string;
    texture: TextureName;
  } | null>(null);
  const prev = useRef({ trackKey, texture });

  useEffect(() => {
    if (prev.current.trackKey === trackKey) return;
    const last = prev.current;
    prev.current = { trackKey, texture };
    if (!direction) return; // a fresh play(), not a next/prev — no arc
    setOutgoing({ key: last.trackKey, texture: last.texture });
    const id = setTimeout(() => setOutgoing(null), ARC_MS);
    return () => clearTimeout(id);
  }, [trackKey, texture, direction]);

  const outClass =
    direction === "prev" ? "disc-arc-out-right" : "disc-arc-out-left";
  const inClass =
    direction === "prev" ? "disc-arc-in-left" : "disc-arc-in-right";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={expanded ? "Shrink artwork" : "Expand artwork"}
      aria-expanded={expanded}
      data-signal="disc_toggle"
      className={cn(
        "absolute z-10 transition-all duration-700 ease-spring",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        "motion-reduce:transition-none",
        expanded
          ? // fills the card as a rounded rect — the landing hover state
            "inset-0 w-full h-full"
          : // half of a card-width circle, the rest clipped by the card
            "left-1/2 -translate-x-1/2 -translate-y-1/2 top-0 w-[112%] aspect-square"
      )}
    >
      {/* Each disc is its own clipped circle so the ARC MOVES THE WHOLE DISC.
          Clipping on the wrapper instead would just slide the art inside a
          stationary hole. */}
      {outgoing ? (
        <span key={outgoing.key} className={cn(discShape(expanded), outClass)}>
          <DiscFace
            texture={outgoing.texture}
            spinning={spinning}
            expanded={expanded}
          />
        </span>
      ) : null}
      <span
        key={trackKey}
        className={cn(discShape(expanded), outgoing && inClass)}
      >
        <DiscFace texture={texture} spinning={spinning} expanded={expanded} />
      </span>

      {/* scrim + overlay copy, only once expanded */}
      <span
        aria-hidden={!expanded}
        className={cn(
          // pb clears the transport row, which floats above this
          "absolute inset-0 z-10 flex flex-col justify-end px-6 pb-24 text-left",
          "bg-gradient-to-t from-ink/95 via-ink/65 to-transparent",
          "transition-opacity duration-500",
          expanded ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {children}
      </span>
    </button>
  );
}
