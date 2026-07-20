"use client";

import { DrawerTitle } from "@/components/ui/drawer";
import AppDrawer from "./AppDrawer";
import CreatePlaylistForm from "./CreatePlaylistForm";

interface CreatePlaylistDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Sheet presentation of CreatePlaylistForm, demoed in the design-system
 *  docs gallery. The app's create-playlist flow is the routed page
 *  (`/screens/create`, reachable at every width) rather than this drawer. */
export default function CreatePlaylistDrawer({
  open,
  onOpenChange,
}: CreatePlaylistDrawerProps) {
  return (
    <AppDrawer open={open} onOpenChange={onOpenChange} height="90vh">
      <div className="max-w-md mx-auto space-y-4">
        <DrawerTitle className="type-h2">Create playlist</DrawerTitle>
        <CreatePlaylistForm onCreated={() => onOpenChange(false)} />
      </div>
    </AppDrawer>
  );
}
