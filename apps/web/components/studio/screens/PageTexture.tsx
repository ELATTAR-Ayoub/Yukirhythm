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
 * `ascii-dunes` paints its own fixed palette — a `#191919` ink fill under
 * hardcoded brand-colour glyphs (see AnimatedTexture; it quantises onto the
 * six-stop Studio ramp, not any theme token). That ink fill is most of the
 * canvas by area, so a plain alpha blend reads fine in dark theme (near-black
 * on a near-black card, ~13% L) but turns into a flat grey veil in light
 * theme (near-black on a ~98% L card) — the whole field darkens the card
 * instead of just hinting at a texture.
 *
 * `mix-blend-screen` fixes that without touching the canvas: screen only
 * ever lightens, so the ink fill contributes nothing over a light card and
 * only the bright accent glyphs (green/blue/white) show through — the same
 * "hint, not a texture" read the dark theme already had. Dark theme keeps
 * the default `normal` blend, since ink-on-ink was already correct there and
 * `screen` would wash out the glyphs' own contrast against a dark card for
 * no benefit. Opacity stays a flat 15% in both — only the blend mode needed
 * to change.
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
        className={cn(
          "absolute inset-0 h-full w-full opacity-[0.15] [mask-image:radial-gradient(130%_100%_at_50%_0%,#000_30%,transparent_100%)]",
          "mix-blend-screen dark:mix-blend-normal"
        )}
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
