"use client";

import Link from "next/link";
import { BellIcon } from "@radix-ui/react-icons";
import { toast } from "sonner";

import RailShelf from "@/components/studio/RailShelf";
import MediaCard from "@/components/studio/MediaCard";
import { PlayerButton } from "@/components/studio/PlayerButton";
import PageHeader from "@/components/studio/screens/PageHeader";
import CollectionArt from "@/components/studio/screens/CollectionArt";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { useIsDesktop } from "@/components/studio/shell/useBreakpoint";
import { playlistHref } from "@/components/studio/shell/routes";
import {
  MOCK_HISTORY,
  NEW_RELEASE_IDS,
  formatDuration,
  getTrack,
  recentCollections,
} from "@/components/studio/screens/mock-data";

export default function HomeScreen() {
  const { user, collections, nowPlaying, isPlaying, play } = useMockStudio();
  const isDesktop = useIsDesktop();
  /**
   * MediaCard is a fixed-width scroller card (`BOXY_WIDTHS`) by default. The
   * shelves below opt into RailShelf's grid, which only actually activates
   * once `isDesktop` is true — mirror that same condition here so the card
   * fills its grid cell (matching CollectionDetail's grid view) exactly when,
   * and only when, the shelf itself is actually in grid shape.
   */
  const shelfCardClassName = isDesktop ? "w-full" : undefined;

  const recents = recentCollections(MOCK_HISTORY, collections);

  /** Enter/Space activation for non-button click targets. */
  const playKeyHandler = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };

  return (
    <div>
      <PageHeader
        title="Home"
        actions={
          <PlayerButton
            variant="ghost"
            aria-label="Notifications"
            onClick={() => toast("No new notifications")}
          >
            <BellIcon />
          </PlayerButton>
        }
      />

      <div className="space-y-10">
        {user && recents.length > 0 ? (
          <RailShelf label="Recently played" title="Jump back in" grid>
            {recents.map((c) => (
              <Link
                key={c.id}
                href={playlistHref(c.id)}
                aria-label={`Open ${c.title}`}
                className="block text-left shrink-0"
              >
                {/* No play overlay: this card is an anchor, and MediaCard's
                    overlay would nest a button inside it. */}
                <MediaCard
                  title={c.title}
                  artist={`${c.trackIds.length} tracks`}
                  art={<CollectionArt collection={c} className="w-full h-full" />}
                  size="sm"
                  playable={false}
                  className={shelfCardClassName}
                />
              </Link>
            ))}
          </RailShelf>
        ) : null}

        <RailShelf label="Fresh drops" title="New releases" grid>
          {NEW_RELEASE_IDS.map((id) => {
            const track = getTrack(id);
            if (!track) return null;
            return (
              <div
                key={id}
                role="button"
                tabIndex={0}
                aria-label={`Play ${track.title}`}
                onClick={() => play(track)}
                onKeyDown={playKeyHandler(() => play(track))}
                className="text-left shrink-0 cursor-pointer"
              >
                <MediaCard
                  title={track.title}
                  artist={track.artist}
                  texture={track.texture}
                  duration={formatDuration(track.durationSec)}
                  size="md"
                  playing={nowPlaying?.id === track.id && isPlaying}
                  className={shelfCardClassName}
                />
              </div>
            );
          })}
        </RailShelf>
      </div>
    </div>
  );
}
