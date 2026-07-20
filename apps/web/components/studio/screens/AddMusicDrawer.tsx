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

/** Sheet presentation of AddMusicPanel. No consumer left anywhere — the
 *  app's add-music flow is the routed page (`/screens/playlist/[id]/add`,
 *  reachable at every width) rather than this drawer. Kept rather than
 *  deleted unilaterally; see the task report for the call. */
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

        {/* the gap under the title block belongs to this wrapper, not the body */}
        <div className="mt-4">
          <AddMusicPanel collection={collection} autoFocus />
        </div>
      </div>
    </AppDrawer>
  );
}
