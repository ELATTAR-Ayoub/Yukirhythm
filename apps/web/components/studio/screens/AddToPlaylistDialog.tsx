"use client";

import { useEffect, useState } from "react";
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
import { CircleSpinner } from "@/components/studio/PlayerButton";
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
  const [pending, setPending] = useState<
    Record<string, { desired: boolean; startedAt: number }>
  >({});

  // Podcasts hold episodes, not tracks — offering them here would be a lie.
  const targets = collections.filter((c) => c.kind === "music");

  // The production mutation is followed by a library refresh. Keep each row
  // visibly pending until that refreshed membership agrees with the click.
  // A short minimum duration means even the synchronous preview store gives
  // perceptible feedback instead of flashing too quickly to see.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    Object.entries(pending).forEach(([collectionId, operation]) => {
      const collection = collections.find((c) => c.id === collectionId);
      if (collection?.trackIds.includes(track.id) !== operation.desired) {
        return;
      }
      const elapsed = Date.now() - operation.startedAt;
      timers.push(
        setTimeout(
          () => {
            setPending((current) => {
              if (current[collectionId] !== operation) return current;
              const next = { ...current };
              delete next[collectionId];
              return next;
            });
          },
          Math.max(0, 600 - elapsed)
        )
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [collections, pending, track.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="truncate">Add to playlist</DialogTitle>
          <DialogDescription className="truncate">
            {track.title} — {track.artist}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 min-h-0 space-y-1 overflow-y-auto px-1">
          {targets.map((c) => {
            const checked = c.trackIds.includes(track.id);
            const operation = pending[c.id];
            return (
              <button
                key={c.id}
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-busy={Boolean(operation)}
                disabled={Boolean(operation)}
                aria-label={`${c.title}`}
                onClick={() => {
                  setPending((current) => ({
                    ...current,
                    [c.id]: {
                      desired: !checked,
                      startedAt: Date.now(),
                    },
                  }));
                  toggleTrackInCollection(c.id, track.id);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded-lg text-left",
                  "hover:bg-secondary transition-colors duration-fast",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  "disabled:cursor-wait disabled:opacity-70"
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
                    "flex items-center justify-center w-5 h-5 rounded-full border shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5",
                    checked
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-input"
                  )}
                >
                  {operation ? (
                    <CircleSpinner />
                  ) : checked ? (
                    <CheckIcon className="w-3.5 h-3.5" />
                  ) : null}
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
