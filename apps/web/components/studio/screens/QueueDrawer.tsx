"use client";

import { useMemo } from "react";
import { ChevronDownIcon } from "@radix-ui/react-icons";

import { DrawerClose, DrawerTitle } from "@/components/ui/drawer";
import { PlayerButton } from "@/components/studio/PlayerButton";
import AppDrawer from "./AppDrawer";
import CollectionDetail from "./CollectionDetail";
import { useMockStudio } from "./MockStudioProvider";
import { type MockCollection } from "./mock-data";

interface QueueDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * What's playing right now, as a full collection sheet. When playback was
 * launched from a collection this is that collection; when a track was played
 * straight from search or a rail there is no source, so the whole library
 * queue is presented under a synthetic "Up next" collection.
 */
export default function QueueDrawer({ open, onOpenChange }: QueueDrawerProps) {
  const { playingCollection, queue } = useMockStudio();

  const collection: MockCollection = useMemo(
    () =>
      playingCollection ?? {
        id: "queue",
        title: "Up next",
        desc: "Everything queued from your library.",
        texture: "tx-k-silk",
        trackIds: queue.map((t) => t.id),
        likes: 0,
        tags: ["queue"],
        kind: "music",
        pinned: false,
      },
    [playingCollection, queue]
  );

  return (
    <AppDrawer open={open} onOpenChange={onOpenChange} height="full">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2">
          <DrawerClose asChild>
            <PlayerButton variant="ghost" size="sm" aria-label="Close queue">
              <ChevronDownIcon />
            </PlayerButton>
          </DrawerClose>
          <DrawerTitle className="type-h2 truncate">
            {collection.title}
          </DrawerTitle>
        </div>

        <CollectionDetail collection={collection} playFrom={playingCollection ?? undefined} />
      </div>
    </AppDrawer>
  );
}
