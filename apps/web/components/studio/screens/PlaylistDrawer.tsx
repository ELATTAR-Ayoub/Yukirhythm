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

/**
 * 95vh playlist detail — play, shuffle, tags, view/sort, tracks with menus.
 *
 * No app-flow consumer left: every surface that used to open this (the
 * library, home's recently-played shelf, search's collection hits) now
 * navigates to the playlist route instead, at every width. Still rendered by
 * the design-system drawers gallery, which is why it stays.
 */
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
