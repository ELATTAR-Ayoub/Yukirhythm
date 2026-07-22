"use client";

import { useState } from "react";
import {
  DotsHorizontalIcon,
  DrawingPinFilledIcon,
  DrawingPinIcon,
  Share1Icon,
} from "@radix-ui/react-icons";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlayerButton } from "@/components/studio/PlayerButton";
import { playlistHref } from "@/components/studio/shell/routes";
import ShareDialog, { absoluteUrl } from "./ShareDialog";
import type { MockCollection } from "./mock-data";
import { useMockStudio } from "./MockStudioProvider";

interface CollectionMenuProps {
  collection: MockCollection;
}

/** The ⋯ menu on a library playlist: pin it, or share it. */
export default function CollectionMenu({ collection }: CollectionMenuProps) {
  const { togglePin } = useMockStudio();
  const [sharing, setSharing] = useState(false);
  const pinned = collection.pinned;

  const url = absoluteUrl(playlistHref(collection.id));
  const text = `Listen to ${collection.title} on Yukirhythm`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <PlayerButton
            variant="ghost"
            size="sm"
            aria-label={`More for ${collection.title}`}
          >
            <DotsHorizontalIcon />
          </PlayerButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Liked Songs is permanent — there is no state in which pinning or
              unpinning it means anything, so the whole item is omitted rather
              than disabled. */}
          {!collection.system && (
            <>
              <DropdownMenuItem
                onClick={() => {
                  togglePin(collection.id);
                  toast(pinned ? "Unpinned" : "Pinned to the top");
                }}
              >
                {pinned ? (
                  <DrawingPinFilledIcon className="mr-2 h-3.5 w-3.5" />
                ) : (
                  <DrawingPinIcon className="mr-2 h-3.5 w-3.5" />
                )}
                {pinned ? "Unpin" : "Pin to top"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={() => setSharing(true)}>
            <Share1Icon className="mr-2 h-3.5 w-3.5" /> Share
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ShareDialog
        open={sharing}
        onOpenChange={setSharing}
        title={collection.title}
        url={url}
        text={text}
      />
    </>
  );
}
