"use client";

import SpinningDisc from "@/components/studio/SpinningDisc";
import CollectionArt from "./CollectionArt";
import { useMockStudio } from "./MockStudioProvider";
import type { MockCollection } from "./mock-data";

/**
 * Playlist page header. Spotify puts a square card here; we put the record,
 * and it only turns when this collection is the one actually playing — the
 * page should not imply playback it isn't driving.
 *
 * Track count and total duration live in CollectionDetail's description line
 * (via CollectionDesc), not here — this hero only owns identity (kind,
 * title) plus the disc, so the two don't repeat the same numbers.
 */
export default function PlaylistHero({
  collection,
}: {
  collection: MockCollection;
}) {
  const { playingCollection, isPlaying } = useMockStudio();
  const spinning = playingCollection?.id === collection.id && isPlaying;
  const isMosaic = collection.cover === "mosaic";

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Texture wash rather than a flat gradient — the brand's dithered
          texture language already owns this treatment.

          Light needs more alpha than dark for the same *perceived* texture.
          Equal opacity gives an identical absolute luminance spread in both
          themes, but sRGB is gamma-encoded: the same spread sits high on the
          curve against a 98% card and low against a 13% one, so light reads
          at ~0.78x dark. Measured across all eight collection textures,
          0.40/0.30 brings light to 1.06x dark in CIE L* — near parity. */}
      <CollectionArt
        collection={collection}
        className="absolute inset-0 w-full h-full opacity-40 dark:opacity-30"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-transparent"
      />

      {/* Stacked on a phone, side by side from sm up. Laid out as a row at
          every width the disc took most of a 393px screen and left the title
          about 100px, so "Late Study Lo-Fi" rendered as "Late…". */}
      <div className="relative flex flex-col items-center gap-4 p-5 text-center sm:flex-row sm:items-end sm:gap-6 sm:p-6 sm:text-left">
        <SpinningDisc
          texture={collection.texture}
          art={
            isMosaic ? (
              <CollectionArt collection={collection} className="absolute inset-0 w-full h-full" />
            ) : undefined
          }
          labelTexture="tx-k2-vinyl"
          spinning={spinning}
          className="w-36 h-36 shrink-0 disc_shadow sm:w-[200px] sm:h-[200px]"
          labelClassName="w-1/3 h-1/3 border-4 border-card"
        />
        {/* No title here — the page's BackHeader carries it, at every width,
            in the same type as every other screen's header. Rendering it in
            both places put two <h1>s on one page: a screen reader announced
            the collection twice, and on a phone the name was printed twice
            above the fold. */}
        <div className="min-w-0 sm:pb-2">
          <div className="font-label text-[11px] uppercase tracking-[0.2em] text-primary">
            {collection.kind}
          </div>
        </div>
      </div>
    </div>
  );
}
