"use client";

import {
  DotsHorizontalIcon,
  Share1Icon,
  PlusIcon,
  HeartIcon,
} from "@radix-ui/react-icons";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlayerButton } from "@/components/studio/PlayerButton";

interface TrackMenuProps {
  trackTitle: string;
}

/** The ⋯ menu on every track row — mock actions surface as toasts. */
export default function TrackMenu({ trackTitle }: TrackMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <PlayerButton variant="ghost" size="sm" aria-label={`More for ${trackTitle}`}>
          <DotsHorizontalIcon />
        </PlayerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => toast(`Link for “${trackTitle}” copied`)}>
          <Share1Icon className="mr-2 h-3.5 w-3.5" /> Share
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast(`“${trackTitle}” added to a playlist`)}>
          <PlusIcon className="mr-2 h-3.5 w-3.5" /> Add to playlist
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast(`“${trackTitle}” added to Liked Songs`)}>
          <HeartIcon className="mr-2 h-3.5 w-3.5" /> Like
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
