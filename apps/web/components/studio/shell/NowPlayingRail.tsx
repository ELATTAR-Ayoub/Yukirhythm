"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ListBulletIcon } from "@radix-ui/react-icons";

import SectionLabel from "@/components/studio/SectionLabel";
import TrackRow from "@/components/studio/TrackRow";
import EmptyState from "@/components/studio/EmptyState";
import { PlayerButton } from "@/components/studio/PlayerButton";
import DevicePlayer from "@/components/studio/screens/DevicePlayer";
import QueueDrawer from "@/components/studio/screens/QueueDrawer";
import AddMusicPanel from "@/components/studio/screens/AddMusicPanel";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import useQueueCollection from "@/components/studio/screens/useQueueCollection";
import { formatDuration, getCollectionTracks } from "@/components/studio/screens/mock-data";
import { SCREENS } from "./routes";

/**
 * A 340px rail has no room for the whole queue before it starts pushing the
 * player itself out of view — 5 rows is enough to preview what's coming
 * without turning the rail into a second scrollable queue. The full list is
 * one tap away via "Open queue".
 */
const UPCOMING_CAP = 5;

const PLAYLIST_PREFIX = `${SCREENS}/playlist/`;

/** The docked player, or an honest line when nothing has started. */
function PlayerSection() {
  const { nowPlaying } = useMockStudio();

  return (
    <div className="px-4 pt-4 shrink-0">
      {nowPlaying ? (
        <DevicePlayer docked />
      ) : (
        <p className="type-muted text-sm text-muted-foreground text-center py-6">
          Nothing playing yet.
        </p>
      )}
    </div>
  );
}

/**
 * A light preview of the queue — deliberately not CollectionDetail, which
 * carries a description block, tags, sort/view controls and its own
 * Add-music drawer. That's far too heavy for a 340px column and would
 * duplicate the rail's own Add music section below. Instead this renders a
 * capped list of TrackRows for what's coming up, with a control that opens
 * the existing QueueDrawer for the full list.
 */
function UpNextSection() {
  const { nowPlaying, playingCollection, play } = useMockStudio();
  const collection = useQueueCollection();
  const [queueOpen, setQueueOpen] = useState(false);

  const tracks = useMemo(() => getCollectionTracks(collection), [collection]);
  const currentIndex = nowPlaying
    ? tracks.findIndex((t) => t.id === nowPlaying.id)
    : -1;
  // Nothing has started yet: the whole queue is "up next". Mid-queue: only
  // what follows the current track, so the preview never repeats what's
  // already playing.
  const upcoming =
    currentIndex >= 0
      ? tracks.slice(currentIndex + 1, currentIndex + 1 + UPCOMING_CAP)
      : tracks.slice(0, UPCOMING_CAP);

  const playKeyHandler =
    (track: (typeof upcoming)[number]) => (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        play(track, playingCollection ?? undefined);
      }
    };

  return (
    <div className="shrink-0">
      <div className="flex items-center justify-between gap-2 px-4 pt-5 pb-2">
        <SectionLabel>Up next</SectionLabel>
        <PlayerButton
          variant="ghost"
          size="sm"
          aria-label="Open queue"
          onClick={() => setQueueOpen(true)}
          data-signal="queue_open"
        >
          <ListBulletIcon />
        </PlayerButton>
      </div>

      {upcoming.length === 0 ? (
        <EmptyState
          title="Queue is empty"
          hint="Nothing lined up after this track."
          texture="tx-k2-static"
          className="py-8"
        />
      ) : (
        <div className="px-3 pb-2 space-y-1">
          {upcoming.map((track, i) => (
            <div
              key={track.id}
              role="button"
              tabIndex={0}
              aria-label={`Play ${track.title}`}
              className="cursor-pointer"
              onClick={() => play(track, playingCollection ?? undefined)}
              onKeyDown={playKeyHandler(track)}
            >
              <TrackRow
                index={i + 1}
                title={track.title}
                artist={track.artist}
                duration={formatDuration(track.durationSec)}
                texture={track.texture}
              />
            </div>
          ))}
        </div>
      )}

      <QueueDrawer open={queueOpen} onOpenChange={setQueueOpen} />
    </div>
  );
}

/**
 * AddMusicPanel for whichever collection the page column currently shows.
 * Derived from the pathname rather than context — the rail has no other way
 * to know what playlist route is open. Anywhere else (home, search, a
 * system route, or an unknown playlist id) gets an honest hint instead of a
 * disabled form.
 */
function AddMusicSection() {
  const pathname = usePathname();
  const { collections } = useMockStudio();

  const collection = useMemo(() => {
    if (!pathname || !pathname.startsWith(PLAYLIST_PREFIX)) return undefined;
    const rawId = pathname.slice(PLAYLIST_PREFIX.length);
    const id = rawId ? decodeURIComponent(rawId) : undefined;
    return id ? collections.find((c) => c.id === id) : undefined;
  }, [pathname, collections]);

  return (
    <div className="px-4 pt-5 pb-4 shrink-0">
      <SectionLabel className="block mb-2">Add music</SectionLabel>
      {collection ? (
        <AddMusicPanel collection={collection} />
      ) : (
        <p className="type-muted text-sm text-muted-foreground">
          Open a playlist to add tracks to it.
        </p>
      )}
    </div>
  );
}

/**
 * The right-hand 340px column: docked player, an Up next preview, and
 * Add music for whatever playlist the page column has open. Not wired into
 * a layout yet — that's a later task.
 */
export default function NowPlayingRail() {
  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto no-scrollbar">
      <PlayerSection />
      <UpNextSection />
      <AddMusicSection />
    </div>
  );
}
