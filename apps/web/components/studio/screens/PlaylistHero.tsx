"use client";

import SpinningDisc from "@/components/studio/SpinningDisc";
import Texture from "@/components/studio/Texture";
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

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Texture wash rather than a flat gradient — the brand's dithered
          texture language already owns this treatment. */}
      <Texture
        name={collection.texture}
        className="absolute inset-0 w-full h-full opacity-30"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-transparent"
      />

      <div className="relative flex items-end gap-6 p-6">
        <SpinningDisc
          texture={collection.texture}
          labelTexture="tx-k2-vinyl"
          spinning={spinning}
          className="w-[200px] h-[200px] shrink-0 disc_shadow"
          labelClassName="w-1/3 h-1/3 border-4 border-card"
        />
        <div className="min-w-0 pb-2">
          <div className="font-label text-[11px] uppercase tracking-[0.2em] text-primary">
            {collection.kind}
          </div>
          {/* type-h1, not type-display: this column will sit flanked by the
              library rail and the now-playing rail once the desktop shell
              lands, and type-display's text-6xl reads oversized once a
              200px disc is already anchoring the row. */}
          <h1 className="type-h1 truncate mt-1">{collection.title}</h1>
        </div>
      </div>
    </div>
  );
}
