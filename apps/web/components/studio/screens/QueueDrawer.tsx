"use client";

import { ChevronDownIcon } from "@radix-ui/react-icons";

import { DrawerClose, DrawerTitle } from "@/components/ui/drawer";
import { PlayerButton } from "@/components/studio/PlayerButton";
import AppDrawer from "./AppDrawer";
import QueuePanel, { useQueueCollection } from "./QueuePanel";

interface QueueDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The queue as a full sheet — mobile presentation of QueuePanel. */
export default function QueueDrawer({ open, onOpenChange }: QueueDrawerProps) {
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

        <QueuePanel />
      </div>
    </AppDrawer>
  );
}
