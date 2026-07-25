"use client";

import RailShelf from "@/components/studio/RailShelf";
import MediaCard from "@/components/studio/MediaCard";
import { useMockStudio } from "./MockStudioProvider";
import { formatDuration, type MockTrack } from "./mock-data";

/** Enter/Space activation for non-button click targets. */
const playKeyHandler = (fn: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};

interface FeedShelfProps {
  label: string;
  title: string;
  tracks: MockTrack[];
  /** RailShelf skeletons the whole shelf (header included) while true. */
  loading: boolean;
  grid?: boolean;
  size?: "sm" | "md";
  cardClassName?: string;
}

/**
 * A feed-backed shelf of playable track cards with honest loading and empty
 * states: skeletons while the feed settles, a quiet line when it settles
 * empty, cards otherwise. Home's "New releases" and Search's two shelves
 * share this, so the surfaces cannot drift in how they treat the same data.
 */
export default function FeedShelf({
  label,
  title,
  tracks,
  loading,
  grid = false,
  size = "sm",
  cardClassName,
}: FeedShelfProps) {
  const { play, nowPlaying, isPlaying } = useMockStudio();

  if (loading) {
    return <RailShelf label={label} title={title} grid={grid} loading />;
  }

  if (tracks.length === 0) {
    return (
      <RailShelf label={label} title={title}>
        {/* One quiet line, not an EmptyState block — an unfilled feed is a
            normal cold-account state, and it must not dominate the page. */}
        <p className="text-sm text-muted-foreground py-2">
          Nothing here yet — play something and check back.
        </p>
      </RailShelf>
    );
  }

  return (
    <RailShelf label={label} title={title} grid={grid}>
      {tracks.map((track) => (
        <div
          key={track.id}
          role="button"
          tabIndex={0}
          aria-label={`Play ${track.title}`}
          onClick={() => play(track)}
          onKeyDown={playKeyHandler(() => play(track))}
          className="text-left shrink-0 cursor-pointer"
        >
          <MediaCard
            title={track.title}
            artist={track.artist}
            texture={track.texture}
            artUrl={track.artUrl}
            duration={formatDuration(track.durationSec)}
            size={size}
            playing={nowPlaying?.id === track.id && isPlaying}
            className={cardClassName}
          />
        </div>
      ))}
    </RailShelf>
  );
}
