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
    // `fixed inset-0` below `md`: the page column (`main` in the shared
    // shell layout) has no defined height there — it's a plain block and
    // the document itself scrolls, which is exactly what a header+footer
    // that "stay put" cannot ride along with. Escaping to the viewport
    // sidesteps that rather than teaching every route's `main` a height it
    // doesn't otherwise need. `pb-44` mirrors `main`'s own mobile
    // clearance so the footer settles above the fixed bottom tab bar (and
    // the mini player, if one is showing) instead of under it; z-20 keeps
    // both of those on top of this overlay.
    //
    // At `md`+ it reverts to a normal in-flow box: `main` already has a
    // definite height there (the shell locks the viewport with
    // `md:h-screen md:overflow-hidden`), so `h-full` is enough for this
    // column to claim exactly main's available height and let its own
    // inner region be the only scroller — main's `overflow-y-auto` never
    // engages because nothing here overflows it.
    <div className="fixed inset-0 z-20 flex flex-col p-2 pb-44 sm:p-6 sm:pb-44 md:static md:z-auto md:h-full md:p-0">
      <div className="relative flex min-h-0 flex-1 flex-col">
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
    </div>
  );
}
