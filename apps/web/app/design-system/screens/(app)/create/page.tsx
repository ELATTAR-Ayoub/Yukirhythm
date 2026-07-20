"use client";

import { useRouter } from "next/navigation";

import BackHeader from "@/components/studio/screens/BackHeader";
import CreatePlaylistForm from "@/components/studio/screens/CreatePlaylistForm";
import { LIBRARY, playlistHref } from "@/components/studio/shell/routes";

/**
 * The create-playlist route, reachable at every width — see LibraryRail's
 * and the mobile library page's create controls. CreatePlaylistForm is the
 * same body CreatePlaylistDrawer renders inside a sheet for the
 * design-system docs gallery; this page is the only app-flow consumer now.
 */
export default function CreatePlaylistScreen() {
  const router = useRouter();

  return (
    <div>
      <BackHeader title="Create playlist" backHref={LIBRARY} />
      <div className="max-w-md">
        <CreatePlaylistForm
          onCreated={(collection) => router.push(playlistHref(collection.id))}
        />
      </div>
    </div>
  );
}
