"use client";

import { useMemo } from "react";
import { Toaster } from "sonner";

import StudioProvider from "@/components/studio/StudioProvider";
import StudioShell from "@/components/studio/shell/StudioShell";
import BackHeader from "@/components/studio/screens/BackHeader";
import CollectionDetail from "@/components/studio/screens/CollectionDetail";
import CollectionMenu from "@/components/studio/screens/CollectionMenu";
import PlaylistHero from "@/components/studio/screens/PlaylistHero";
import type {
  MockCollection,
  MockTrack,
} from "@/components/studio/screens/mock-data";
import {
  HOME,
  sharedPlaylistHref,
  sharedTrackHref,
} from "@/components/studio/shell/routes";
import { useAuthState } from "@/lib/studio/useAuth";
import type { PublicPlaylist } from "@/lib/sharing/public";
import SaveSharedPlaylistButton from "./SaveSharedPlaylistButton";

export default function PublicListenClient({
  playlist,
  kind,
}: {
  playlist: PublicPlaylist;
  kind: "track" | "playlist";
}) {
  const { user } = useAuthState();
  const tracks = useMemo<MockTrack[]>(
    () =>
      playlist.tracks.map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        texture: track.texture,
        durationSec: track.durationSec,
        artUrl: track.artUrl,
      })),
    [playlist.tracks]
  );
  const playbackHref =
    kind === "track"
      ? sharedTrackHref(playlist.id)
      : sharedPlaylistHref(playlist.id);
  const collection = useMemo<MockCollection>(
    () => ({
      id: `shared-${playlist.id}`,
      playbackHref,
      title: playlist.title,
      desc: playlist.description,
      texture: playlist.texture,
      cover: playlist.cover,
      artUrl: playlist.artUrl,
      trackIds: tracks.map((track) => track.id),
      likes: 0,
      tags: playlist.tags,
      kind: "music",
      pinned: false,
    }),
    [playbackHref, playlist, tracks]
  );

  return (
    <StudioProvider
      authenticatedUser={user}
      preloadedTracks={tracks}
      restorePlayback={false}
    >
      <StudioShell>
        <div className="pb-8">
          <BackHeader title={playlist.title} fallbackHref={HOME} />
          <PlaylistHero collection={collection} tracks={tracks} />
          <div className="px-1 mt-4">
            <CollectionDetail
              collection={collection}
              tracks={tracks}
              editable={false}
              collectionAction={
                kind === "playlist" ? (
                  <>
                    <SaveSharedPlaylistButton playlist={playlist} />
                    <CollectionMenu
                      collection={collection}
                      sharePath={playbackHref}
                    />
                  </>
                ) : undefined
              }
            />
          </div>
        </div>
      </StudioShell>
      <Toaster />
    </StudioProvider>
  );
}
