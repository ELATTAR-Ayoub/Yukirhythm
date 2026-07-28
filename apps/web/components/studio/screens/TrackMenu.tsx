"use client";

import { useState } from "react";
import {
  DotsHorizontalIcon,
  HeartFilledIcon,
  HeartIcon,
  MinusIcon,
  PlusIcon,
  Share1Icon,
} from "@radix-ui/react-icons";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlayerButton } from "@/components/studio/PlayerButton";
import { sharedTrackHref } from "@/components/studio/shell/routes";
import ShareDialog, { absoluteUrl } from "./ShareDialog";
import AddToPlaylistDialog from "./AddToPlaylistDialog";
import { useMockStudio } from "./MockStudioProvider";
import type { MockTrack } from "./mock-data";

interface TrackMenuProps {
  track: MockTrack;
  /**
   * This row's position in the running queue, when it is a queue row. A
   * position, not a boolean: removing must drop the copy the user pointed at,
   * and a track may sit in the queue more than once.
   */
  queueIndex?: number;
}

/** The ⋯ menu on every track row: like, add to playlists, share. */
export default function TrackMenu({ track, queueIndex }: TrackMenuProps) {
  const { isLiked, toggleLike, dequeue } = useMockStudio();
  const [sharing, setSharing] = useState(false);
  const [adding, setAdding] = useState(false);
  const liked = isLiked(track.id);

  // The surrounding queue/playlist is private playback context. The public
  // link always names only the track the user selected.
  const url = absoluteUrl(sharedTrackHref(track.id));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <PlayerButton
            variant="ghost"
            size="sm"
            aria-label={`More for ${track.title}`}
          >
            <DotsHorizontalIcon />
          </PlayerButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Names the outcome, not the control — "Like" on an already-liked
              track would be a lie about what the click does. */}
          <DropdownMenuItem onClick={() => toggleLike(track.id)}>
            {liked ? (
              <HeartFilledIcon className="mr-2 h-3.5 w-3.5 text-primary" />
            ) : (
              <HeartIcon className="mr-2 h-3.5 w-3.5" />
            )}
            {liked ? "Remove from Liked Songs" : "Like"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAdding(true)}>
            <PlusIcon className="mr-2 h-3.5 w-3.5" /> Add to playlist
          </DropdownMenuItem>
          {queueIndex !== undefined ? (
            <DropdownMenuItem onClick={() => dequeue(queueIndex)}>
              <MinusIcon className="mr-2 h-3.5 w-3.5" /> Remove from queue
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setSharing(true)}>
            <Share1Icon className="mr-2 h-3.5 w-3.5" /> Share
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AddToPlaylistDialog
        track={track}
        open={adding}
        onOpenChange={setAdding}
      />
      <ShareDialog
        open={sharing}
        onOpenChange={setSharing}
        title={track.title}
        url={url}
        text={`Listen to ${track.title} by ${track.artist} on Yukirhythm`}
      />
    </>
  );
}
