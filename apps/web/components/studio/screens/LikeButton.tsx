"use client";

import { HeartFilledIcon, HeartIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import IconSwap from "@/components/studio/IconSwap";
import { PlayerButton } from "@/components/studio/PlayerButton";
import { useMockStudio } from "./MockStudioProvider";

const HEART_ICONS = {
  off: <HeartIcon />,
  on: <HeartFilledIcon />,
};

interface LikeButtonProps {
  trackId: string;
  /** For the accessible name — "Like {title}" beats a row of bare "Like"s. */
  trackTitle: string;
  size?: "sm" | "base";
  className?: string;
}

/**
 * Toggles a track's membership of Liked Songs.
 *
 * `aria-pressed` rather than swapping the label between Like/Unlike: it is one
 * control with two states, and a toggle announces that better than a button
 * that appears to change identity under the cursor.
 */
export default function LikeButton({
  trackId,
  trackTitle,
  size = "sm",
  className,
}: LikeButtonProps) {
  const { isLiked, toggleLike } = useMockStudio();
  const liked = isLiked(trackId);

  return (
    <PlayerButton
      variant="secondary"
      size={size}
      aria-label={`Like ${trackTitle}`}
      aria-pressed={liked}
      onClick={() => toggleLike(trackId)}
      data-signal="track_like"
      className={cn(liked && "text-primary", className)}
    >
      <IconSwap active={liked ? "on" : "off"} icons={HEART_ICONS} />
    </PlayerButton>
  );
}
