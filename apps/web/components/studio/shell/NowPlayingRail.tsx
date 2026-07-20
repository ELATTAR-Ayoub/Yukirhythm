"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ListBulletIcon } from "@radix-ui/react-icons";

import SectionLabel from "@/components/studio/SectionLabel";
import TrackRow from "@/components/studio/TrackRow";
import EmptyState from "@/components/studio/EmptyState";
import { PlayerButton } from "@/components/studio/PlayerButton";
import DevicePlayer from "@/components/studio/screens/DevicePlayer";
import AddMusicPanel from "@/components/studio/screens/AddMusicPanel";
import LikeButton from "@/components/studio/screens/LikeButton";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import useQueueCollection from "@/components/studio/screens/useQueueCollection";
import { formatDuration, getCollectionTracks } from "@/components/studio/screens/mock-data";
import { QUEUE, SCREENS } from "./routes";

/**
 * A 340px rail has no room for the whole queue before it starts pushing the
 * player itself out of view — 5 rows is enough to preview what's coming
 * without turning the rail into a second scrollable queue. The full list is
 * one tap away via "Open queue".
 */
const UPCOMING_CAP = 5;

const PLAYLIST_PREFIX = `${SCREENS}/playlist/`;

/**
 * The docked player — always the player, even with nothing loaded.
 *
 * This used to collapse to a line of text when idle, which made the rail
 * change shape the instant playback started and gave a cold session no sense
 * of what the column is for. `DevicePlayer` carries its own idle
 * presentation (blank art well, `--:--`, inert transport), so the chassis is
 * present either way and only its contents change.
 */
function PlayerSection() {
  return (
    <div className="px-4 pt-4 shrink-0">
      <DevicePlayer docked />
    </div>
  );
}

/**
 * A light preview of the queue — deliberately not CollectionDetail, which
 * carries a description block, tags, sort/view controls and its own
 * add-music control. That's far too heavy for a 340px column and would
 * duplicate the rail's own Add music section below. Instead this renders a
 * capped list of TrackRows for what's coming up, with a control that routes
 * to the full queue page.
 */
function UpNextSection() {
  const { nowPlaying, playingCollection, play } = useMockStudio();
  const router = useRouter();
  const collection = useQueueCollection();

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
    // A named region, taking its name from the label already on screen rather
    // than repeating the string — the rail holds three distinct areas and
    // "the queue preview" needs to be addressable as one of them.
    <section aria-labelledby="up-next-label" className="shrink-0">
      {/* Asymmetric on purpose, to line the header up with the rows beneath
          it: the list is inset px-3 and TrackRow adds another px-3, so the
          artwork starts 24px in — pl-6 puts the label on that same edge. The
          rows' trailing control sits 12px from the rail edge, so pr-3 puts
          the queue button on the same column as the hearts. */}
      <div className="flex items-center justify-between gap-2 pl-6 pr-3 pt-5 pb-2">
        <SectionLabel id="up-next-label">Up next</SectionLabel>
        <PlayerButton
          variant="ghost"
          size="sm"
          aria-label="Open queue"
          onClick={() => router.push(QUEUE)}
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
            <div key={track.id} className="flex items-center gap-1">
              <div
                role="button"
                tabIndex={0}
                aria-label={`Play ${track.title}`}
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => play(track, playingCollection ?? undefined)}
                onKeyDown={playKeyHandler(track)}
              >
                {/* No play overlay: this row sits inside a role="button" div,
                    and TrackRow's overlay would nest a button inside it. */}
                <TrackRow
                  index={i + 1}
                  title={track.title}
                  artist={track.artist}
                  duration={formatDuration(track.durationSec)}
                  texture={track.texture}
                  playable={false}
                />
              </div>
              {/* Sibling of the row, not a child — nesting it in the
                  role="button" wrapper would make it a dead keyboard stop. */}
              <LikeButton trackId={track.id} trackTitle={track.title} />
            </div>
          ))}
        </div>
      )}
    </section>
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
 * Add music for whatever playlist the page column has open.
 *
 * The player is pinned (`shrink-0`, outside the scroll container) — same
 * pattern as `LibraryRail`'s header — so scrolling down to Up next / Add
 * music never pushes the docked player itself out of view. Only the
 * sections below it scroll.
 */
export default function NowPlayingRail() {
  return (
    <div className="flex flex-col h-full min-h-0">
      <PlayerSection />
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <UpNextSection />
        <AddMusicSection />
      </div>
    </div>
  );
}
