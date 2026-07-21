"use client";

import { useRef, useState } from "react";

import { cn } from "@/lib/utils";
import Texture, { type TextureName } from "@/components/studio/Texture";

interface ArtworkProps {
  /** Resolved by lib/studio/artwork.ts. Empty means "no picture available". */
  src?: string;
  /** The procedural fallback — deterministic per track, so it is stable. */
  texture?: TextureName;
  /** Empty string for decorative art whose label is already in the row. */
  alt: string;
  className?: string;
}

/**
 * The one place artwork is drawn.
 *
 * Every surface — rows, cards, mosaics, the vinyl disc — renders through this
 * rather than reaching for `<Texture>` or an `<img>` directly, so a track
 * cannot show its thumbnail in one place and a generated swatch in another,
 * and a dead CDN URL degrades identically everywhere.
 */
export default function Artwork({
  src,
  texture,
  alt,
  className,
}: ArtworkProps) {
  const [failed, setFailed] = useState(false);

  // Reset during render, not in an effect. A disc face keeps the same element
  // across track changes, so an effect-based reset would paint one frame of
  // the NEW track wearing the OLD track's failure before correcting itself.
  const lastSrc = useRef(src);
  if (lastSrc.current !== src) {
    lastSrc.current = src;
    if (failed) setFailed(false);
  }

  if (!src || failed) {
    return <Texture name={texture ?? "tx-k-marble"} className={className} />;
  }

  return (
    // Plain <img>: the codebase's established pattern, and next/image would
    // need remote-pattern config for a third-party CDN to buy nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      aria-hidden={alt === "" ? true : undefined}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  );
}
