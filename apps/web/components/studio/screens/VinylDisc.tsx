"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import Texture, { type TextureName } from "@/components/studio/Texture";
import SpinningDisc from "@/components/studio/SpinningDisc";

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
  // Expanded it fills a rounded rect, where any rotation would swing the
  // artwork's corners off the card — so only the circle spins.
  if (expanded) {
    return (
      <div className="absolute inset-0">
        <Texture name={texture} className="absolute inset-0 w-full h-full" />
        <div
          className={cn(
            "absolute inset-0 m-auto w-16 h-16 rounded-full overflow-hidden",
            "border-4 border-card transition-opacity duration-500 opacity-0"
          )}
        >
          <Texture name="tx-k2-vinyl" className="w-full h-full" />
        </div>
      </div>
    );
  }

  return (
    <SpinningDisc
      texture={texture}
      labelTexture="tx-k2-vinyl"
      spinning={spinning}
      className="absolute inset-0"
      labelClassName="w-16 h-16 border-4 border-card"
    />
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
  /*
    Two persistent layers that trade places, rather than mounting a fresh
    "outgoing" copy each swap. Keying the discs on trackKey remounted
    SpinningDisc, so the departing record snapped back to angle 0 the instant
    it began moving — the jolt that made the swap read as broken.

    Each layer keeps its animation class after the animation ends (the
    keyframes hold their final frame), so the parked disc stays off-stage
    until it is called back in.
  */
  const [layers, setLayers] = useState<
    { texture: TextureName | null; cls: string }[]
  >([
    { texture, cls: "" },
    { texture: null, cls: "" },
  ]);
  const [active, setActive] = useState(0);
  const prev = useRef(trackKey);

  useEffect(() => {
    if (prev.current === trackKey) return;
    prev.current = trackKey;

    // A fresh play() rather than next/prev: swap the face in place, no travel.
    if (!direction) {
      setLayers((l) =>
        l.map((layer, i) => (i === active ? { ...layer, texture } : layer))
      );
      return;
    }

    const incoming = active === 0 ? 1 : 0;
    const out =
      direction === "prev" ? "disc-arc-out-right" : "disc-arc-out-left";
    const into =
      direction === "prev" ? "disc-arc-in-left" : "disc-arc-in-right";
    setLayers((l) =>
      l.map((layer, i) =>
        i === incoming ? { texture, cls: into } : { ...layer, cls: out }
      )
    );
    setActive(incoming);
  }, [trackKey, texture, direction, active]);

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
          stationary hole. The keys are fixed slots, never the track id — that
          is what keeps each SpinningDisc mounted across a swap. */}
      {layers.map((layer, i) =>
        layer.texture ? (
          <span key={i} className={cn(discShape(expanded), layer.cls)}>
            <DiscFace
              texture={layer.texture}
              // only the disc on stage keeps turning
              spinning={spinning && i === active}
              expanded={expanded}
            />
          </span>
        ) : null
      )}

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
