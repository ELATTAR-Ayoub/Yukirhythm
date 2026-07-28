"use client";

import { useState } from "react";

import TrackRow from "@/components/studio/TrackRow";
import SectionLabel from "@/components/studio/SectionLabel";
import { Button } from "@/components/ui/button";
import { useMockStudio } from "./MockStudioProvider";
import { formatDuration, type MockTrack } from "./mock-data";
import LikeButton from "./LikeButton";
import TrackMenu from "./TrackMenu";

const PAGE_SIZE = 20;

/** Enter/Space activation for non-button click targets. */
const playKeyHandler = (fn: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};

/**
 * Track search results reveal one stable 20-row page at a time. Keeping the
 * paging state in a keyed child means every newly submitted query naturally
 * starts back at page one.
 */
export default function SearchTrackResults({
  tracks,
}: {
  tracks: MockTrack[];
}) {
  const { play, nowPlaying, isPlaying } = useMockStudio();
  const [visibleTrackCount, setVisibleTrackCount] = useState(PAGE_SIZE);
  const visibleTracks = tracks.slice(0, visibleTrackCount);

  return (
    <section>
      <SectionLabel>Tracks</SectionLabel>
      <div className="space-y-1 mt-2">
        {visibleTracks.map((track, i) => (
          <div key={track.id} className="flex items-center gap-2 pr-1">
            <div
              role="button"
              tabIndex={0}
              aria-label={`Play ${track.title}`}
              onClick={() => play(track)}
              onKeyDown={playKeyHandler(() => play(track))}
              className="min-w-0 flex-1 cursor-pointer"
            >
              <TrackRow
                index={i + 1}
                title={track.title}
                artist={track.artist}
                duration={formatDuration(track.durationSec)}
                texture={track.texture}
                artUrl={track.artUrl}
                playing={nowPlaying?.id === track.id && isPlaying}
                playable={false}
              />
            </div>
            <LikeButton trackId={track.id} trackTitle={track.title} />
            <TrackMenu track={track} />
          </div>
        ))}
      </div>
      {visibleTrackCount < tracks.length ? (
        <div className="flex justify-center mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setVisibleTrackCount((count) => count + PAGE_SIZE)}
          >
            See more
          </Button>
        </div>
      ) : null}
    </section>
  );
}
