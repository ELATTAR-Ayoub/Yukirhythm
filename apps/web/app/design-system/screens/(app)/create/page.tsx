"use client";

import { useRouter } from "next/navigation";

import BackHeader from "@/components/studio/screens/BackHeader";
import CreatePlaylistFlow from "@/components/studio/screens/CreatePlaylistFlow";
import PageTexture from "@/components/studio/screens/PageTexture";
import { LIBRARY, playlistHref } from "@/components/studio/shell/routes";

/**
 * The create-playlist route, reachable at every width — see LibraryRail's
 * and the mobile library page's create controls. A three-step wizard
 * (details -> add music -> review) rather than a single form: cover art and
 * starting tracks need somewhere to live before the write happens, and a
 * review step means the write only ever happens once. CreatePlaylistForm
 * (the older single-step body) lives on only as CreatePlaylistDrawer's sheet
 * demo in the design-system docs gallery.
 */
export default function CreatePlaylistScreen() {
  const router = useRouter();

  return (
    <div className="relative">
      <PageTexture />
      {/* Lifted above the texture — it sits at z-0 rather than behind the
          column's opaque background. */}
      <div className="relative z-10">
        <BackHeader title="Create playlist" backHref={LIBRARY} />
        <CreatePlaylistFlow
          onCreated={(collection) => router.push(playlistHref(collection.id))}
        />
      </div>
    </div>
  );
}
