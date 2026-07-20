"use client";

import { useState } from "react";
import {
  DotsHorizontalIcon,
  HeartFilledIcon,
  HeartIcon,
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
import { playlistHref, LIBRARY } from "@/components/studio/shell/routes";
import ShareDialog, { absoluteUrl } from "./ShareDialog";
import AddToPlaylistDialog from "./AddToPlaylistDialog";
import { useMockStudio } from "./MockStudioProvider";
import type { MockCollection, MockTrack } from "./mock-data";

interface TrackMenuProps {
  track: MockTrack;
  /**
   * The collection this row belongs to, where there is one. No route exists
   * for a single track, so a share link points at the playlist holding it — a
   * link that actually resolves — rather than inventing a track URL that
   * would 404.
   */
  collection?: MockCollection;
}

/** The ⋯ menu on every track row: like, add to playlists, share. */
export default function TrackMenu({ track, collection }: TrackMenuProps) {
  const { isLiked, toggleLike } = useMockStudio();
  const [sharing, setSharing] = useState(false);
  const [adding, setAdding] = useState(false);
  const liked = isLiked(track.id);

  const url = absoluteUrl(
    collection ? playlistHref(collection.id) : LIBRARY
  );

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
