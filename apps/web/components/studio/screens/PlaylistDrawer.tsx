"use client";

import { ChevronLeftIcon } from "@radix-ui/react-icons";

import { DrawerClose, DrawerTitle } from "@/components/ui/drawer";
import { PlayerButton } from "@/components/studio/PlayerButton";
import AppDrawer from "./AppDrawer";
import CollectionDetail from "./CollectionDetail";
import { type MockCollection } from "./mock-data";

interface PlaylistDrawerProps {
  collection: MockCollection | null;
  onOpenChange: (open: boolean) => void;
}

/** 95vh playlist detail — play, shuffle, tags, view/sort, tracks with menus. */
export default function PlaylistDrawer({
  collection,
  onOpenChange,
}: PlaylistDrawerProps) {
  return (
    <AppDrawer
      open={collection !== null}
      onOpenChange={onOpenChange}
      height="full"
    >
      {collection ? (
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2">
            <DrawerClose asChild>
              <PlayerButton variant="ghost" size="sm" aria-label="Back">
                <ChevronLeftIcon />
              </PlayerButton>
            </DrawerClose>
            <DrawerTitle className="type-h2 truncate">
              {collection.title}
            </DrawerTitle>
          </div>

          <CollectionDetail collection={collection} />
        </div>
      ) : null}
    </AppDrawer>
  );
}
