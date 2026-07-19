"use client";

import { ChevronDownIcon } from "@radix-ui/react-icons";

import { DrawerClose, DrawerTitle } from "@/components/ui/drawer";
import { PlayerButton } from "@/components/studio/PlayerButton";
import { useMockStudio } from "./MockStudioProvider";
import AppDrawer from "./AppDrawer";
import CollectionDetail from "./CollectionDetail";
import useQueueCollection from "./useQueueCollection";

interface QueueDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The queue as a full sheet. The desktop rail deliberately does not reuse this
 * body — CollectionDetail's description block, tags, sort/view controls and
 * add-music drawer are far too heavy for a 340px column, so NowPlayingRail
 * renders its own light preview and opens this drawer for the full list.
 */
export default function QueueDrawer({ open, onOpenChange }: QueueDrawerProps) {
  const { playingCollection } = useMockStudio();
  const collection = useQueueCollection();

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

        <CollectionDetail
          collection={collection}
          playFrom={playingCollection ?? undefined}
        />
      </div>
    </AppDrawer>
  );
}
