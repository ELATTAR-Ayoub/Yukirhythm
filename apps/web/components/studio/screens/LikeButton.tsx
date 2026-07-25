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
  /**
   * Once a track is already saved, the heart doubles as the door to
   * playlists rather than an unlike shortcut — that surface (e.g. the device
   * player) has no other one-tap way to file a track, and unliking is still
   * reachable from inside the dialog this opens (its Liked Songs row).
   * Omitted entirely, the button keeps its plain toggle behavior — every
   * existing call site (rows, queue, ...) is unaffected.
   */
  onAlreadyLiked?: () => void;
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
  onAlreadyLiked,
}: LikeButtonProps) {
  const { isLiked, toggleLike } = useMockStudio();
  const liked = isLiked(trackId);

  return (
    <PlayerButton
      variant="secondary"
      size={size}
      aria-label={`Like ${trackTitle}`}
      aria-pressed={liked}
      onClick={() => {
        if (liked && onAlreadyLiked) {
          onAlreadyLiked();
          return;
        }
        toggleLike(trackId);
      }}
      data-signal="track_like"
      className={cn(liked && "text-primary", className)}
    >
      <IconSwap active={liked ? "on" : "off"} icons={HEART_ICONS} />
    </PlayerButton>
  );
}
