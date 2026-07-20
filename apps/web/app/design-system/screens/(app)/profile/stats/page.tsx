"use client";

import BackHeader from "@/components/studio/screens/BackHeader";
import SignInPrompt from "@/components/studio/screens/SignInPrompt";
import StatCard from "@/components/studio/screens/StatCard";
import SectionLabel from "@/components/studio/SectionLabel";
import DataText from "@/components/studio/DataText";
import TrackRow from "@/components/studio/TrackRow";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import {
  MOCK_STATS,
  formatDuration,
  getTrack,
} from "@/components/studio/screens/mock-data";

const BASE = "/design-system/screens";

export default function StatsScreen() {
  const { user, play, nowPlaying, isPlaying } = useMockStudio();
  if (!user) return <SignInPrompt />;

  /** Enter/Space activation for non-button click targets. */
  const playKeyHandler = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };

  return (
    <div className="space-y-10">
      <div>
        <BackHeader title="Listening stats" backHref={`${BASE}/profile`} />
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="This week" value={`${MOCK_STATS.minutesWeek} min`} />
          <StatCard label="This month" value={`${MOCK_STATS.minutesMonth} min`} />
          <StatCard
            label="All time"
            value={`${Math.round(MOCK_STATS.minutesAllTime / 60)} hrs`}
          />
          <StatCard
            label="Streak"
            value={`${MOCK_STATS.streakDays} days`}
            hint="listened every day"
          />
        </div>
      </div>

      <section>
        <SectionLabel>Top artists</SectionLabel>
        <div className="mt-2 rounded-lg border border-border bg-card divide-y divide-border">
          {MOCK_STATS.topArtists.map((artist, i) => (
            <div key={artist.name} className="flex items-center gap-3 px-4 py-2.5">
              <DataText className="text-sm text-muted-foreground w-6">
                {String(i + 1).padStart(2, "0")}
              </DataText>
              <span className="font-ui font-medium text-sm flex-1 truncate">
                {artist.name}
              </span>
              <DataText className="text-xs text-muted-foreground">
                {artist.plays} plays
              </DataText>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>Top tracks</SectionLabel>
        <div className="space-y-1 mt-2">
          {MOCK_STATS.topTrackIds.map((id, i) => {
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
                className="cursor-pointer"
              >
                <TrackRow
                  index={i + 1}
                  title={track.title}
                  artist={track.artist}
                  duration={formatDuration(track.durationSec)}
                  texture={track.texture}
                  playing={nowPlaying?.id === track.id && isPlaying}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <SectionLabel>Genres</SectionLabel>
        <div className="space-y-2.5 mt-2">
          {MOCK_STATS.genreSplit.map((genre) => (
            <div key={genre.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-ui text-sm">{genre.name}</span>
                <DataText className="text-xs text-muted-foreground">
                  {genre.pct}%
                </DataText>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${genre.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>By hour</SectionLabel>
        <div
          className="flex items-end gap-1 h-24 mt-2"
          aria-label="Listening intensity by hour of day"
        >
          {MOCK_STATS.byHour.map((v, hour) => (
            <div
              key={hour}
              className="flex-1 rounded-sm bg-primary/80 min-h-[2px]"
              style={{ height: `${v * 100}%` }}
              title={`${hour}:00`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1 font-label text-[9px] uppercase tracking-wider text-muted-foreground">
          <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
        </div>
      </section>
    </div>
  );
}
