"use client";

import { cn } from "@/lib/utils";
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
 * A flat 15% in both themes, set by eye rather than derived. Light would
 * carry slightly more alpha than dark for equal *perceived* weight — sRGB is
 * gamma-encoded, so the same luminance spread sits higher on the curve
 * against a near-white card — but at this weight the field is a hint rather
 * than a texture, and the difference is not worth two numbers.
 */
export default function PageTexture({
  kind = "ascii-dunes",
}: PageTextureProps) {
  return (
    // NOT -z-10: the page column paints an opaque bg-card, and a negative
    // z-index child paints behind its ancestor's background, so the field
    // rendered correctly and was never visible. It sits at the bottom of the
    // normal stack instead, with the page's content lifted above it.
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl"
    >
      <AnimatedTexture
        kind={kind}
        speed={0.4}
        className="absolute inset-0 h-full w-full opacity-[0.15] [mask-image:radial-gradient(130%_100%_at_50%_0%,#000_30%,transparent_100%)]"
      />
      {/* Settles the field into the card rather than letting it end on a cut.
          Two passes, because the gradient alone still left a visible seam at
          the corners: a radial wash toward the card colour, then an inset
          shadow in that same colour that tightens the last few pixels of
          every edge. Both are driven by --card, so they track the theme. */}
      <div
        className={cn(
          "absolute inset-0",
          "bg-[radial-gradient(130%_100%_at_50%_5%,transparent_45%,hsl(var(--card))_100%)]",
          "shadow-[inset_0_0_70px_20px_hsl(var(--card))]"
        )}
      />
    </div>
  );
}
