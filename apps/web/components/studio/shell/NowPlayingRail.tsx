"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ListBulletIcon, PlusIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import SectionLabel from "@/components/studio/SectionLabel";
import TrackRow from "@/components/studio/TrackRow";
import { PlayerButton } from "@/components/studio/PlayerButton";
import DevicePlayer from "@/components/studio/screens/DevicePlayer";
import LikeButton from "@/components/studio/screens/LikeButton";
import TrackMenu from "@/components/studio/screens/TrackMenu";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { formatDuration } from "@/components/studio/screens/mock-data";
import { QUEUE, QUEUE_ADD, addMusicHref, matchPlaylistId } from "./routes";

/**
 * A 340px rail has no room for the whole queue before it starts pushing the
 * player itself out of view — 5 rows is enough to preview what's coming
 * without turning the rail into a second scrollable queue. The full list is
 * one tap away via "Open queue".
 */
const UPCOMING_CAP = 5;

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
  const { queue, currentIndex, playAt } = useMockStudio();
  const router = useRouter();

  // Read straight off the queue — not `getCollectionTracks(useQueueCollection())`.
  // That path degraded the queue's own MockTrack objects to ids, looked them
  // back up in a global registry, and silently dropped any that missed, so a
  // queued track could be invisible in the list yet still in the queue.
  //
  // The offset is what makes each row addressable: `upcoming[i]` lives at
  // `start + i` in the queue, and that absolute position — never a findIndex
  // on the track id — is what a click acts on. A track may sit in the queue
  // more than once, and id lookup would answer with the wrong copy.
  const start = currentIndex >= 0 ? currentIndex + 1 : 0;
  const upcoming = queue.slice(start, start + UPCOMING_CAP);

  const playKeyHandler = (at: number) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      playAt(at);
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
        // One quiet line, not a full empty-state block. An empty queue is the
        // normal resting state of the rail, so it must not dominate it.
        <p className="px-6 pb-3 text-sm text-muted-foreground">
          Nothing queued yet.
        </p>
      ) : (
        <div className="px-3 pb-2 space-y-1">
          {upcoming.map((track, i) => {
            const at = start + i;
            return (
              // Keyed by POSITION, not by track id. The queue is a list, not a
              // set: the same track may legitimately appear twice, and two
              // rows sharing a key is what made them swap and vanish.
              <div
                key={`${track.id}:${at}`}
                className="flex items-center gap-1"
              >
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Play ${track.title}`}
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => playAt(at)}
                  onKeyDown={playKeyHandler(at)}
                >
                  {/* No play overlay: this row sits inside a role="button" div,
                      and TrackRow's overlay would nest a button inside it. */}
                  <TrackRow
                    index={at + 1}
                    title={track.title}
                    artist={track.artist}
                    duration={formatDuration(track.durationSec)}
                    texture={track.texture}
                    artUrl={track.artUrl}
                    playable={false}
                  />
                </div>
                {/* Siblings of the row, not children — nesting them in the
                    role="button" wrapper would make each a dead keyboard stop. */}
                <LikeButton trackId={track.id} trackTitle={track.title} />
                <TrackMenu track={track} queueIndex={at} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/**
 * Where the "+" goes, read from the route rather than from playback state.
 *
 * The control must follow what the user is LOOKING at: someone reading a
 * playlist while something else plays means to add to the playlist in front
 * of them, not to the queue running behind it. Everywhere else — home,
 * search, profile, the queue itself — the queue is the only sensible
 * destination.
 */
function useAddTarget(): { href: string; label: string } {
  const pathname = usePathname();
  const { collections } = useMockStudio();

  const id = matchPlaylistId(pathname);
  if (id) {
    const open = collections.find((c) => c.id === id);
    if (open) return { href: addMusicHref(open.id), label: open.title };
  }
  return { href: QUEUE_ADD, label: "your queue" };
}

/**
 * A compact card carrying a "+", navigating to the add screen for whatever
 * the user is currently looking at.
 *
 * This used to be a permanently-open search field embedded in the rail — in
 * a 340px column that crowded out the queue preview above it and offered a
 * cramped result list. The card names its destination in words: a "+" that
 * could mean either the queue or a playlist is a "+" nobody trusts.
 */
function AddMusicSection() {
  const { href, label } = useAddTarget();

  return (
    <section
      aria-labelledby="add-to-queue-label"
      className="px-4 pt-5 pb-4 shrink-0"
    >
      <SectionLabel id="add-to-queue-label" className="block mb-2">
        Add music
      </SectionLabel>
      <Link
        href={href}
        aria-label={`Add music to ${label}`}
        data-signal="add_music_open"
        className={cn(
          "group flex items-center justify-between gap-3 rounded-lg border border-border bg-card/40 p-3",
          "transition-colors duration-base hover:border-primary/50 hover:bg-card/70",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        )}
      >
        <div className="min-w-0">
          <p className="font-ui text-sm font-medium truncate">Add music</p>
          <p className="font-label text-[10px] uppercase tracking-wider text-muted-foreground truncate mt-0.5">
            to {label}
          </p>
        </div>
        <span
          aria-hidden
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full shrink-0",
            "bg-primary text-primary-foreground",
            "transition-transform duration-base group-hover:scale-105"
          )}
        >
          <PlusIcon className="w-4 h-4" />
        </span>
      </Link>
    </section>
  );
}

/**
 * The right-hand 340px column: docked player, an Up next preview of the
 * running queue, and a field that adds to that same queue.
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
