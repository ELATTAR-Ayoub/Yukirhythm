"use client";

import { DrawerTitle } from "@/components/ui/drawer";
import AppDrawer from "./AppDrawer";
import AddMusicPanel from "./AddMusicPanel";
import { type MockCollection } from "./mock-data";

interface AddMusicDrawerProps {
  collection: MockCollection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Mobile presentation of AddMusicPanel. */
export default function AddMusicDrawer({
  collection,
  open,
  onOpenChange,
}: AddMusicDrawerProps) {
  return (
    <AppDrawer open={open} onOpenChange={onOpenChange} height="full">
      <div className="max-w-3xl mx-auto">
        <DrawerTitle className="type-h2 truncate">Add music</DrawerTitle>
        <p className="type-muted mt-1 truncate">to {collection.title}</p>

        <AddMusicPanel collection={collection} autoFocus />
      </div>
    </AppDrawer>
  );
}
