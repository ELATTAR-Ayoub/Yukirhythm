import { cn } from "@/lib/utils";
import Texture from "@/components/studio/Texture";
import { getTrack, type MockTrack } from "./mock-data";
import type { TextureName } from "@/components/studio/Texture";

/** The minimum shape CollectionArt needs — satisfied by both `MockCollection`
 *  and the wizard's `Draft` (same field names throughout), so the review
 *  step can hand its live draft straight in without adapting it. */
export interface CollectionArtSource {
  texture: TextureName;
  cover?: "texture" | "mosaic";
  trackIds: string[];
}

function tracksFor(trackIds: string[]): MockTrack[] {
  return trackIds.map(getTrack).filter((t): t is MockTrack => t !== undefined);
}

/**
 * One 2-wide cell, one full-height cell — the lead track gets the bigger
 * share, the next two are supporting. Matches the asymmetric split most
 * mosaic pickers (Spotify included) use for exactly three images: a plain
 * 2x2 grid would leave a blank fourth quadrant, and three equal columns
 * reads as a filmstrip rather than a cover.
 */
function ThreeUp({ textures }: { textures: TextureName[] }) {
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2">
      <Texture name={textures[0]} className="row-span-2 h-full w-full" />
      <Texture name={textures[1]} className="h-full w-full" />
      <Texture name={textures[2]} className="h-full w-full" />
    </div>
  );
}

interface CollectionArtProps {
  collection: CollectionArtSource;
  className?: string;
}

/**
 * Renders a collection's art — its texture swatch, or (when `cover` is
 * "mosaic") a collage of its own tracks' textures. The single place that
 * decides how a collection's art looks; every surface that draws a
 * collection's artwork should render through this rather than reading
 * `.texture` directly, or a collection would show its collage in one place
 * and a plain swatch in another.
 *
 * `className` should carry sizing (w/h) and rounding — it is applied to
 * whichever of the single-texture or grid path renders.
 */
export default function CollectionArt({ collection, className }: CollectionArtProps) {
  const cover = collection.cover ?? "texture";
  const textures =
    cover === "mosaic"
      ? tracksFor(collection.trackIds)
          .slice(0, 4)
          .map((t) => t.texture)
      : [];

  if (textures.length === 0) {
    return <Texture name={collection.texture} className={className} />;
  }
  if (textures.length === 1) {
    return <Texture name={textures[0]} className={className} />;
  }
  if (textures.length === 2) {
    return (
      <div className={cn("grid grid-cols-2 overflow-hidden", className)}>
        <Texture name={textures[0]} className="h-full w-full" />
        <Texture name={textures[1]} className="h-full w-full" />
      </div>
    );
  }
  if (textures.length === 3) {
    return (
      <div className={cn("overflow-hidden", className)}>
        <ThreeUp textures={textures} />
      </div>
    );
  }
  return (
    <div className={cn("grid grid-cols-2 grid-rows-2 overflow-hidden", className)}>
      {textures.map((t, i) => (
        <Texture key={i} name={t} className="h-full w-full" />
      ))}
    </div>
  );
}
