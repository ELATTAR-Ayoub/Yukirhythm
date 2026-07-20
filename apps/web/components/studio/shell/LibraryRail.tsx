"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PlusIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import { PlayerButton } from "@/components/studio/PlayerButton";
import SignInPrompt from "@/components/studio/screens/SignInPrompt";
import {
  CreatePlaylistTile,
  LibraryRowCard,
} from "@/components/studio/screens/LibraryRow";
import CollectionMenu from "@/components/studio/screens/CollectionMenu";
import { FilterChipRow } from "@/components/studio/screens/TagChip";
import {
  LIBRARY_FILTERS,
  filterLibrary,
} from "@/components/studio/screens/library-utils";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { CREATE, playlistHref } from "./routes";

/**
 * The left column: the library, permanently docked. Rows navigate to the
 * playlist route rather than opening a sheet — on desktop the page column is
 * where detail belongs, and the rail must stay put so the user keeps their
 * place in the list.
 */
export default function LibraryRail() {
  const { user, collections, libraryFilter, setLibraryFilter } =
    useMockStudio();
  const pathname = usePathname();
  const router = useRouter();

  const openCreate = () => router.push(CREATE);

  if (!user) {
    return (
      <div className="p-4">
        <h2 id="library-rail-heading" className="type-h3 mb-3">
          Your Library
        </h2>
        <SignInPrompt hint="Playlists, podcasts and Liked Songs live here." />
      </div>
    );
  }

  const visible = filterLibrary(collections, libraryFilter);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3 shrink-0">
        <h2 id="library-rail-heading" className="type-h3">
          Your Library
        </h2>
        <PlayerButton
          variant="ghost"
          aria-label="Create playlist"
          onClick={openCreate}
        >
          <PlusIcon />
        </PlayerButton>
      </div>

      <div className="px-4 shrink-0">
        <FilterChipRow
          options={LIBRARY_FILTERS}
          value={libraryFilter}
          onChange={setLibraryFilter}
          className="mb-4"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3 pb-4 space-y-2">
        {visible.map((c) => {
          const href = playlistHref(c.id);
          const active = pathname === href;
          return (
            // The menu is a SIBLING of the anchor, not a child: a button
            // inside an <a> is invalid and becomes a dead keyboard stop that
            // only works because the click bubbles.
            <div key={c.id} className="relative">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={`Open collection ${c.title}`}
                className={cn(
                  "relative block rounded-lg transition-colors duration-fast",
                  active && "bg-secondary"
                )}
              >
                {/* No play overlay: this row is an anchor, and MediaCard's
                    overlay would nest a button inside it. */}
                <LibraryRowCard collection={c} playable={false} />
              </Link>
              {/* Bottom-right, clear of the pinned marker at the top. */}
              <div className="absolute right-2 bottom-2">
                <CollectionMenu collection={c} />
              </div>
            </div>
          );
        })}

        <CreatePlaylistTile onClick={openCreate} />
      </div>
    </div>
  );
}
