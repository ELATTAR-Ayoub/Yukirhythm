"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import Texture, { type TextureName } from "@/components/studio/Texture";
import SpinningDisc from "@/components/studio/SpinningDisc";

/*
  The expand is two phases, not one blend: the record travels to the middle of
  the card, and only then grows to cover it. Collapsing runs the same beats in
  reverse — shrink back to a circle first, then ride back up to the shoulder.

  Both use --ease-out. The arc animations below already carry the note that an
  overshooting curve on a moving disc "read as a wobble"; the expand used to
  use --ease-spring (1.56 overshoot) on `transition-all`, so width, height,
  top, translate and border-radius each overshot on their own schedule. That
  was the vibration.
*/
const TRAVEL_MS = 300;
const GROW_MS = 460;
const SHRINK_MS = 320;

const GROW_DELAY_MS = TRAVEL_MS - 40;

const EXPAND_TRANSITION: React.CSSProperties = {
  transition: [
    `top ${TRAVEL_MS}ms var(--ease-out)`,
    `scale ${GROW_MS}ms var(--ease-out) ${GROW_DELAY_MS}ms`,
  ].join(", "),
};

const COLLAPSE_TRANSITION: React.CSSProperties = {
  transition: [
    `scale ${SHRINK_MS}ms var(--ease-out)`,
    `top ${TRAVEL_MS + 60}ms var(--ease-out) ${SHRINK_MS - 60}ms`,
  ].join(", "),
};

/**
 * The travelling element: a clipped disc that fills its wrapper.
 *
 * Corner radii are pre-divided by the 1.2 expand scale so they *render* at the
 * card's own 42/52px once grown — a radius on a scaled box is scaled with it.
 * The morph runs on the grow phase's clock so the circle is still a circle
 * while it travels.
 */
const discShape = (expanded: boolean) =>
  cn(
    "absolute inset-0 overflow-hidden transition-[border-radius] ease-out",
    // Literal classes on purpose — Tailwind scans source text, so an
    // interpolated `duration-[${x}ms]` would never generate any CSS.
    expanded
      ? "rounded-[35px] sm:rounded-[43px] duration-[460ms] delay-[260ms]"
      : "rounded-full disc_shadow duration-[320ms]"
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
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-label={expanded ? "Shrink artwork" : "Expand artwork"}
        aria-expanded={expanded}
        data-signal="disc_toggle"
        style={expanded ? EXPAND_TRANSITION : COLLAPSE_TRANSITION}
        className={cn(
          "absolute z-10",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          "motion-reduce:transition-none",
          /*
          Geometry is fixed: a card-width circle, always centred on `left` and
          pinned by a constant `translate`. Only `top` and `scale` change, so
          nothing interpolates width, height or position at the same time —
          that simultaneous interpolation, on an overshooting curve, is what
          made the old expand read as a vibration.
        */
          "left-1/2 w-[112%] aspect-square -translate-x-1/2 -translate-y-1/2",
          expanded
            ? // centred, then grown past the card's bounds — the card clips it,
              // so the silhouette you see is the card's own rounded rect
              "top-1/2 scale-[1.2]"
            : // half off the top, the rest clipped by the card
              "top-0 scale-100"
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
      </button>

      {/*
        Scrim + overlay copy, a SIBLING of the disc rather than a child.
        Inside the button it inherited the 1.2 expand scale: the type grew
        with the artwork and its left edge was clipped by the card, so the
        artist read as a fragment and the title lost its first characters.
        Out here it sits on the card's own box at 1:1 and stays put.
      */}
      <span
        aria-hidden={!expanded}
        className={cn(
          // pb clears the transport row, which floats above this
          "absolute inset-0 z-10 flex flex-col justify-end px-6 pb-24 text-left",
          "bg-gradient-to-t from-ink/95 via-ink/65 to-transparent",
          "transition-opacity duration-500",
          // Never interactive: as a sibling it lies over the disc, so taking
          // pointer events here would swallow the tap that shrinks it again.
          "pointer-events-none",
          // fades in as the disc finishes growing, not while it travels
          expanded ? "opacity-100 delay-[260ms]" : "opacity-0"
        )}
      >
        {children}
      </span>
    </>
  );
}
