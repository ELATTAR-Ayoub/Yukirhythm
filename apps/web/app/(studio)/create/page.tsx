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
    // A normal in-flow column. The shell locks the viewport at every width
    // now and `main` is the scroller, so `h-full` claims exactly the
    // column's height — enough for the wizard to pin its own header and
    // footer and scroll only the middle. `main`'s own `overflow-y-auto`
    // never engages here because nothing overflows it, and staying inside
    // `main` means the column's surface and bottom clearance still apply.
    <div className="relative flex h-full min-h-0 flex-col">
      <PageTexture />
      {/* Lifted above the texture — it sits at z-0 rather than behind the
          column's opaque background. */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="shrink-0">
          <BackHeader title="Create playlist" backHref={LIBRARY} />
        </div>
        <div className="min-h-0 flex-1">
          <CreatePlaylistFlow
            onCreated={(collection) => router.push(playlistHref(collection.id))}
          />
        </div>
      </div>
    </div>
  );
}
