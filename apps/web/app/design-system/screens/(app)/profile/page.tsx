"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import DataText from "@/components/studio/DataText";
import SectionLabel from "@/components/studio/SectionLabel";
import TrackRow from "@/components/studio/TrackRow";
import MediaCard from "@/components/studio/MediaCard";
import EmptyState from "@/components/studio/EmptyState";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import {
  MOCK_COLLECTIONS,
  MOCK_TRACKS,
  formatDuration,
} from "@/components/studio/screens/mock-data";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <DataText className="text-2xl">{value.toLocaleString()}</DataText>
      <SectionLabel className="mt-0.5">{label}</SectionLabel>
    </div>
  );
}

export default function ProfileScreen() {
  const { user, signIn, play, nowPlaying, isPlaying } = useMockStudio();

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <EmptyState
          title="You're signed out"
          hint="Sign in to see favorite audio and collections."
          texture="tx-k-glitch"
          action={<Button onClick={signIn}>Sign in</Button>}
        />
      </div>
    );
  }

  const loved = MOCK_TRACKS.slice(0, 8);

  return (
    <div>
      {/* header */}
      <div className="flex items-center gap-4">
        <Avatar className="w-16 h-16 border border-border shadow-e2">
          <AvatarFallback className="bg-cobalt text-snow font-ui text-lg">
            {user.initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <SectionLabel>Profile</SectionLabel>
          <h1 className="type-h2">{user.userName}</h1>
          <p className="type-muted">{user.email}</p>
        </div>
      </div>

      {/* stats */}
      <div className="flex flex-wrap gap-8 mt-6">
        <Stat label="Loved" value={loved.length} />
        <Stat label="Collections" value={MOCK_COLLECTIONS.length} />
        <Stat label="Followers" value={user.followers} />
        <Stat label="Following" value={user.following} />
      </div>

      <Tabs defaultValue="audio" className="w-full mt-8">
        <TabsList>
          <TabsTrigger value="audio">Favorite Audio</TabsTrigger>
          <TabsTrigger value="collections">Collections</TabsTrigger>
        </TabsList>

        <TabsContent value="audio">
          <div className="rounded-lg border border-border bg-card p-3 space-y-1">
            {loved.map((track, i) => (
              <div key={track.id} onClick={() => play(track)}>
                <TrackRow
                  index={i + 1}
                  title={track.title}
                  artist={track.artist}
                  duration={formatDuration(track.durationSec)}
                  texture={track.texture}
                  playing={nowPlaying?.id === track.id && isPlaying}
                />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="collections">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {MOCK_COLLECTIONS.map((c) => (
              <MediaCard
                key={c.id}
                title={c.title}
                artist={`${c.trackIds.length} tracks`}
                texture={c.texture}
                size="md"
                className="!w-full"
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
