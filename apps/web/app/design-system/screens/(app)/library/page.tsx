"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon } from "@radix-ui/react-icons";

import { PlayerButton } from "@/components/studio/PlayerButton";
import PageHeader from "@/components/studio/screens/PageHeader";
import SignInPrompt from "@/components/studio/screens/SignInPrompt";
import { FilterChipRow } from "@/components/studio/screens/TagChip";
import {
  LIBRARY_FILTERS,
  filterLibrary,
} from "@/components/studio/screens/library-utils";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import {
  CreatePlaylistTile,
  LibraryRowCard,
} from "@/components/studio/screens/LibraryRow";
import { CREATE, playlistHref } from "@/components/studio/shell/routes";

/**
 * The routed library screen. Rows navigate to the playlist route and the
 * create controls navigate to the create route, at every width — same
 * behaviour as LibraryRail, just for the surface mobile actually lands on
 * (LibraryRail itself is CSS-hidden below `md`).
 */
export default function LibraryScreen() {
  const { user, collections, libraryFilter, setLibraryFilter } =
    useMockStudio();
  const router = useRouter();

  if (!user) {
    return (
      <div>
        <PageHeader title="Your Library" />
        <SignInPrompt hint="Playlists, podcasts and Liked Songs live here." />
      </div>
    );
  }

  const visible = filterLibrary(collections, libraryFilter);
  const openCreate = () => router.push(CREATE);

  return (
    <div>
      <PageHeader
        title="Your Library"
        actions={
          <PlayerButton
            variant="ghost"
            aria-label="Create playlist"
            onClick={openCreate}
          >
            <PlusIcon />
          </PlayerButton>
        }
      />

      <FilterChipRow
        options={LIBRARY_FILTERS}
        value={libraryFilter}
        onChange={setLibraryFilter}
        className="mb-6"
      />

      <div className="space-y-2">
        {visible.map((c) => (
          <Link
            key={c.id}
            href={playlistHref(c.id)}
            aria-label={`Open collection ${c.title}`}
            className="relative block"
          >
            {/* No play overlay: this row is an anchor, and MediaCard's
                overlay would nest a button inside it. */}
            <LibraryRowCard collection={c} playable={false} />
          </Link>
        ))}

        <CreatePlaylistTile onClick={openCreate} />
      </div>
    </div>
  );
}
