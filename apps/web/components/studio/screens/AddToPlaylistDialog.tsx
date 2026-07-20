"use client";

import { CheckIcon, PlusIcon } from "@radix-ui/react-icons";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import CollectionArt from "./CollectionArt";
import { useMockStudio } from "./MockStudioProvider";
import { CREATE } from "@/components/studio/shell/routes";
import type { MockTrack } from "./mock-data";

interface AddToPlaylistDialogProps {
  track: MockTrack;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Pick which playlists a track belongs to.
 *
 * A checklist rather than a one-shot "add": a track can sit in several
 * playlists, and the same surface that adds it should be able to take it back
 * out — otherwise removing means hunting down the playlist and deleting the
 * row there. Each toggle applies immediately, so there is no half-applied
 * state to lose if the dialog is dismissed.
 *
 * Rows are `role="checkbox"` buttons rather than real inputs, to match the
 * house control vocabulary; the semantics are carried by aria-checked.
 */
export default function AddToPlaylistDialog({
  track,
  open,
  onOpenChange,
}: AddToPlaylistDialogProps) {
  const { collections, toggleTrackInCollection } = useMockStudio();
  const router = useRouter();

  // Podcasts hold episodes, not tracks — offering them here would be a lie.
  const targets = collections.filter((c) => c.kind === "music");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="truncate">Add to playlist</DialogTitle>
          <DialogDescription className="truncate">
            {track.title} — {track.artist}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1 space-y-1">
          {targets.map((c) => {
            const checked = c.trackIds.includes(track.id);
            return (
              <button
                key={c.id}
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={`${c.title}`}
                onClick={() => toggleTrackInCollection(c.id, track.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded-lg text-left",
                  "hover:bg-secondary transition-colors duration-fast",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                )}
              >
                <span className="relative w-10 h-10 rounded-md overflow-hidden shrink-0">
                  <CollectionArt collection={c} className="w-full h-full" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-ui font-medium text-sm truncate">
                    {c.title}
                  </span>
                  <span className="block font-label text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                    {c.trackIds.length} tracks
                  </span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "flex items-center justify-center w-5 h-5 rounded-full border shrink-0",
                    checked
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-input"
                  )}
                >
                  {checked ? <CheckIcon className="w-3.5 h-3.5" /> : null}
                </span>
              </button>
            );
          })}
        </div>

        <Button
          variant="outline"
          onClick={() => {
            onOpenChange(false);
            router.push(CREATE);
          }}
        >
          <PlusIcon className="mr-2 h-3.5 w-3.5" /> New playlist
        </Button>
      </DialogContent>
    </Dialog>
  );
}
