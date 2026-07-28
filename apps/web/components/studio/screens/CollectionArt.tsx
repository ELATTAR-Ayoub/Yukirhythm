import { cn } from "@/lib/utils";
import Artwork from "@/components/studio/Artwork";
import { getTrack, type MockTrack } from "./mock-data";
import type { TextureName } from "@/components/studio/Texture";

/** The minimum shape CollectionArt needs — satisfied by both `MockCollection`
 *  and the wizard's `Draft` (same field names throughout), so the review
 *  step can hand its live draft straight in without adapting it. */
export interface CollectionArtSource {
  texture: TextureName;
  cover?: "texture" | "mosaic" | "image";
  /** A stored cover image, when `cover` is "image". */
  artUrl?: string;
  trackIds: string[];
}

function tracksFor(trackIds: string[]): MockTrack[] {
  return trackIds.map(getTrack).filter((t): t is MockTrack => t !== undefined);
}

/** One mosaic cell — the track's thumbnail, its texture if that is all we have. */
function Cell({ track, className }: { track: MockTrack; className?: string }) {
  return (
    <Artwork
      src={track.artUrl}
      texture={track.texture}
      alt=""
      className={className}
    />
  );
}

/**
 * One 2-wide cell, one full-height cell — the lead track gets the bigger
 * share, the next two are supporting. Matches the asymmetric split most
 * mosaic pickers (Spotify included) use for exactly three images: a plain
 * 2x2 grid would leave a blank fourth quadrant, and three equal columns
 * reads as a filmstrip rather than a cover.
 */
function ThreeUp({ tracks }: { tracks: MockTrack[] }) {
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2">
      <Cell track={tracks[0]} className="row-span-2 h-full w-full" />
      <Cell track={tracks[1]} className="h-full w-full" />
      <Cell track={tracks[2]} className="h-full w-full" />
    </div>
  );
}

interface CollectionArtProps {
  collection: CollectionArtSource;
  /**
   * Tracks that have already been resolved by the caller. Most studio
   * surfaces use the shared track registry; server-backed/public surfaces can
   * pass their resolved tracks directly and still use this same renderer.
   */
  tracks?: MockTrack[];
  className?: string;
}

/**
 * Renders a collection's art — its own cover image, a collage of its tracks'
 * artwork, or its texture swatch. The single place that decides how a
 * collection's art looks; every surface that draws one should render through
 * this rather than reading `.texture` directly, or a collection would show its
 * collage in one place and a plain swatch in another.
 *
 * `className` should carry sizing (w/h) and rounding — it is applied to
 * whichever path renders.
 */
export default function CollectionArt({
  collection,
  tracks: resolvedTracks,
  className,
}: CollectionArtProps) {
  const cover = collection.cover ?? "texture";

  // An uploaded cover wins outright: the owner chose it over any collage.
  if (cover === "image" && collection.artUrl) {
    return (
      <Artwork
        src={collection.artUrl}
        texture={collection.texture}
        alt=""
        className={className}
      />
    );
  }

  const tracks =
    cover === "mosaic"
      ? (resolvedTracks ?? tracksFor(collection.trackIds)).slice(0, 4)
      : [];

  if (tracks.length === 0) {
    return (
      <Artwork
        src=""
        texture={collection.texture}
        alt=""
        className={className}
      />
    );
  }
  if (tracks.length === 1) {
    return <Cell track={tracks[0]} className={className} />;
  }
  if (tracks.length === 2) {
    return (
      <div className={cn("grid grid-cols-2 overflow-hidden", className)}>
        <Cell track={tracks[0]} className="h-full w-full" />
        <Cell track={tracks[1]} className="h-full w-full" />
      </div>
    );
  }
  if (tracks.length === 3) {
    return (
      <div className={cn("overflow-hidden", className)}>
        <ThreeUp tracks={tracks} />
      </div>
    );
  }
  return (
    <div
      className={cn("grid grid-cols-2 grid-rows-2 overflow-hidden", className)}
    >
      {tracks.map((t, i) => (
        <Cell key={`${t.id}:${i}`} track={t} className="h-full w-full" />
      ))}
    </div>
  );
}
