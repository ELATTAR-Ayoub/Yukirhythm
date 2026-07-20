"use client";

import { useState } from "react";
import {
  CopyIcon,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlayerButton } from "@/components/studio/PlayerButton";
import { playlistHref } from "@/components/studio/shell/routes";
import type { MockCollection } from "./mock-data";
import { useMockStudio } from "./MockStudioProvider";

/**
 * Where a shared link points. Built from the browser's own origin rather than
 * a hardcoded host so a link copied from a preview deploy points back at that
 * deploy, not at production.
 */
function shareUrl(collection: MockCollection): string {
  const path = playlistHref(collection.id);
  return typeof window === "undefined"
    ? path
    : `${window.location.origin}${path}`;
}

/**
 * Share targets open an intent page with the link prefilled. Deliberately
 * *not* a post: the user still confirms on the destination, so nothing is
 * published on their behalf by clicking here.
 */
const TARGETS = [
  {
    id: "x",
    label: "X",
    href: (url: string, text: string) =>
      `https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    href: (url: string, text: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    id: "reddit",
    label: "Reddit",
    href: (url: string, text: string) =>
      `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
  },
];

interface CollectionMenuProps {
  collection: MockCollection;
}

/** The ⋯ menu on a library playlist: pin it, or share it. */
export default function CollectionMenu({ collection }: CollectionMenuProps) {
  const { togglePin } = useMockStudio();
  const [sharing, setSharing] = useState(false);
  const pinned = collection.pinned;

  const url = shareUrl(collection);
  const text = `Listen to ${collection.title} on Yukirhythm`;

  const copy = async () => {
    // Not every context grants clipboard access (insecure origin, denied
    // permission), and a silent failure would look like a successful copy.
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch {
      toast("Couldn't copy — you can select the link and copy it manually");
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
          <DropdownMenuItem onClick={() => setSharing(true)}>
            <Share1Icon className="mr-2 h-3.5 w-3.5" /> Share
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={sharing} onOpenChange={setSharing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="truncate">
              Share “{collection.title}”
            </DialogTitle>
            <DialogDescription>
              Copy the link, or open it in an app to post yourself.
            </DialogDescription>
          </DialogHeader>

          {/* The link is shown, not just copied — so it is inspectable before
              it goes anywhere, and still recoverable if the copy fails. */}
          <p className="type-code break-all rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
            {url}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="default" onClick={copy}>
              <CopyIcon className="mr-2 h-3.5 w-3.5" /> Copy link
            </Button>
            {TARGETS.map((t) => (
              <Button key={t.id} variant="outline" asChild>
                <a
                  href={t.href(url, text)}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {t.label}
                </a>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
