"use client";

import AnimatedTexture, {
  type AnimatedTextureKind,
} from "@/components/studio/AnimatedTexture";

interface PageTextureProps {
  /** Defaults to the dunes field used by the playlist authoring routes. */
  kind?: AnimatedTextureKind;
}

/**
 * A full-bleed texture wash behind a page's content.
 *
 * The edges are the whole problem: a texture that simply stops at the
 * container's bounds reads as a cropped image rather than a backdrop. Two
 * treatments handle it — the texture itself is masked so it dissolves toward
 * the edges, and a vignette in the card's own colour sits over the top so
 * whatever survives the mask settles into the surface behind it instead of
 * meeting a hard line.
 *
 * Light carries more alpha than dark for the same perceived weight: equal
 * opacity gives an identical absolute luminance spread, but sRGB is
 * gamma-encoded, so that spread sits high on the curve against a near-white
 * card and low against a near-black one.
 */
export default function PageTexture({
  kind = "ascii-dunes",
}: PageTextureProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl"
    >
      <AnimatedTexture
        kind={kind}
        speed={0.4}
        className="absolute inset-0 h-full w-full opacity-40 dark:opacity-30 [mask-image:radial-gradient(130%_100%_at_50%_0%,#000_30%,transparent_100%)]"
      />
      {/* Settles the field into the card rather than letting it end on a cut. */}
      <div className="absolute inset-0 bg-[radial-gradient(130%_100%_at_50%_5%,transparent_45%,hsl(var(--card))_100%)]" />
    </div>
  );
}
