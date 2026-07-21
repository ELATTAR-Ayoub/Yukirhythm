"use client";

import BackHeader from "@/components/studio/screens/BackHeader";
import SignInPrompt from "@/components/studio/screens/SignInPrompt";
import SectionLabel from "@/components/studio/SectionLabel";
import TrackRow from "@/components/studio/TrackRow";
import EmptyState from "@/components/studio/EmptyState";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import {
  HISTORY_GROUPS,
  getTrack,
} from "@/components/studio/screens/mock-data";

const BASE = "/design-system/screens";

export default function RecentsScreen() {
  const { user, collections, play, nowPlaying, isPlaying, recents } = useMockStudio();
  if (!user) return <SignInPrompt />;

  /** Enter/Space activation for non-button click targets. */
  const playKeyHandler = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };

  return (
    <div>
      <BackHeader title="Recents" backHref={`${BASE}/profile`} />
      {recents.length === 0 ? (
        <EmptyState
          title="Nothing played yet"
          hint="Your listening history shows up here."
          texture="tx-k2-static"
        />
      ) : (
        <div className="space-y-8">
          {HISTORY_GROUPS.map((group) => {
            const entries = recents.filter((e) => e.group === group);
            if (entries.length === 0) return null;
            return (
              <section key={group}>
                <SectionLabel>{group}</SectionLabel>
                <div className="space-y-1 mt-2">
                  {entries.map((entry, i) => {
                    const track = getTrack(entry.trackId);
                    if (!track) return null;
                    const source = collections.find(
                      (c) => c.id === entry.collectionId
                    );
                    return (
                      <div
                        key={`${entry.trackId}-${i}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Play ${track.title}`}
                        onClick={() => play(track, source)}
                        onKeyDown={playKeyHandler(() => play(track, source))}
                        className="cursor-pointer"
                      >
                        {/* The wrapping div is the button; an overlay would
                            nest one inside it. */}
                        <TrackRow
                          title={track.title}
                          artist={
                            source
                              ? `${track.artist} — from ${source.title}`
                              : track.artist
                          }
                          duration={entry.timeLabel}
                          texture={track.texture}
                          playing={nowPlaying?.id === track.id && isPlaying}
                          playable={false}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
