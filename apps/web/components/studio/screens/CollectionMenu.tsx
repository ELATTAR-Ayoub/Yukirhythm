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
import { CircleSpinner, PlayerButton } from "@/components/studio/PlayerButton";
import ShareDialog, { absoluteUrl } from "./ShareDialog";
import type { MockCollection } from "./mock-data";
import { useMockStudio } from "./MockStudioProvider";

interface CollectionMenuProps {
  collection: MockCollection;
}

/** The ⋯ menu on a library playlist: pin it, or share it. */
export default function CollectionMenu({ collection }: CollectionMenuProps) {
  const { togglePin, publishCollectionShare } = useMockStudio();
  const [sharing, setSharing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const pinned = collection.pinned;

  const text = `Listen to ${collection.title} on Yukirhythm`;

  const publishShare = async () => {
    if (publishing) return;
    setPublishing(true);
    const toastId = toast.loading("Preparing public playlist link...");
    try {
      const result = await publishCollectionShare(collection.id);
      setShareUrl(absoluteUrl(result.path));
      setSharing(true);
      toast.success("Playlist link is ready", { id: toastId });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Please try again.";
      toast.error(`Couldn't prepare the link: ${message}`, { id: toastId });
    } finally {
      setPublishing(false);
    }
  };

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
          <DropdownMenuItem
            disabled={publishing}
            onSelect={() => void publishShare()}
          >
            {publishing ? (
              <span className="mr-2 h-3.5 w-3.5">
                <CircleSpinner />
              </span>
            ) : (
              <Share1Icon className="mr-2 h-3.5 w-3.5" />
            )}
            {publishing ? "Preparing link..." : "Share"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ShareDialog
        open={sharing}
        onOpenChange={setSharing}
        title={collection.title}
        url={shareUrl}
        text={text}
      />
    </>
  );
}
