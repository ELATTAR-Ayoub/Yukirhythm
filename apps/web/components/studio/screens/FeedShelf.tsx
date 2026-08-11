"use client";

import { ReloadIcon } from "@radix-ui/react-icons";

import RailShelf from "@/components/studio/RailShelf";
import StudioMediaCard from "./StudioMediaCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type MockTrack } from "./mock-data";

interface FeedShelfProps {
  label: string;
  title: string;
  tracks: MockTrack[];
  /** RailShelf skeletons the whole shelf (header included) while true. */
  loading: boolean;
  grid?: boolean;
  size?: "sm" | "md";
  cardClassName?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
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
  onRefresh,
  refreshing = false,
}: FeedShelfProps) {
  const refreshAction = onRefresh ? (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onRefresh}
      disabled={refreshing}
      aria-busy={refreshing}
    >
      <ReloadIcon
        className={cn("mr-1.5 h-3.5 w-3.5", refreshing && "animate-spin")}
      />
      Refresh
    </Button>
  ) : null;

  if (loading) {
    return <RailShelf label={label} title={title} grid={grid} loading />;
  }

  if (tracks.length === 0) {
    return (
      <RailShelf label={label} title={title} headerAction={refreshAction}>
        {/* One quiet line, not an EmptyState block — an unfilled feed is a
            normal cold-account state, and it must not dominate the page. */}
        <p className="text-sm text-muted-foreground py-2">
          Nothing here yet — play something and check back.
        </p>
      </RailShelf>
    );
  }

  return (
    <RailShelf
      label={label}
      title={title}
      grid={grid}
      headerAction={refreshAction}
    >
      {tracks.map((track) => (
        <div key={track.id} className="text-left shrink-0">
          <StudioMediaCard
            track={track}
            size={size}
            className={cardClassName}
          />
        </div>
      ))}
    </RailShelf>
  );
}
