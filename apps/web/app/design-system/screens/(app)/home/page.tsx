"use client";

import { useState } from "react";
import { BellIcon } from "@radix-ui/react-icons";
import { toast } from "sonner";

import RailShelf from "@/components/studio/RailShelf";
import MediaCard from "@/components/studio/MediaCard";
import { PlayerButton } from "@/components/studio/PlayerButton";
import PageHeader from "@/components/studio/screens/PageHeader";
import PlaylistDrawer from "@/components/studio/screens/PlaylistDrawer";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import {
  MOCK_HISTORY,
  NEW_RELEASE_IDS,
  formatDuration,
  getTrack,
  recentCollections,
  type MockCollection,
} from "@/components/studio/screens/mock-data";

export default function HomeScreen() {
  const { user, collections, nowPlaying, isPlaying, play } = useMockStudio();
  const [openCollection, setOpenCollection] = useState<MockCollection | null>(
    null
  );

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
          <RailShelf label="Recently played" title="Jump back in">
            {recents.map((c) => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                aria-label={`Open ${c.title}`}
                onClick={() => setOpenCollection(c)}
                onKeyDown={playKeyHandler(() => setOpenCollection(c))}
                className="text-left shrink-0 cursor-pointer"
              >
                <MediaCard
                  title={c.title}
                  artist={`${c.trackIds.length} tracks`}
                  texture={c.texture}
                  size="sm"
                />
              </div>
            ))}
          </RailShelf>
        ) : null}

        <RailShelf label="Fresh drops" title="New releases">
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
                />
              </div>
            );
          })}
        </RailShelf>
      </div>

      <PlaylistDrawer
        collection={openCollection}
        onOpenChange={(o) => {
          if (!o) setOpenCollection(null);
        }}
      />
    </div>
  );
}
