"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  PauseIcon,
  PlayIcon,
  Share1Icon,
  TrackNextIcon,
  TrackPreviousIcon,
} from "@radix-ui/react-icons";
import { Toaster, toast } from "sonner";

import Artwork from "@/components/studio/Artwork";
import DataText from "@/components/studio/DataText";
import { CircleSpinner, PlayerButton } from "@/components/studio/PlayerButton";
import SectionLabel from "@/components/studio/SectionLabel";
import TrackRow from "@/components/studio/TrackRow";
import CollectionArt, {
  type CollectionArtSource,
} from "@/components/studio/screens/CollectionArt";
import type { SeekablePlayer } from "@/components/studio/screens/HiddenYouTubePlayer";
import {
  formatDuration,
  type MockTrack,
} from "@/components/studio/screens/mock-data";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { PublicPlaylist } from "@/lib/sharing/public";

const HiddenYouTubePlayer = dynamic(
  () => import("@/components/studio/screens/HiddenYouTubePlayer"),
  { ssr: false }
);

export default function PublicListenClient({
  playlist,
  kind,
}: {
  playlist: PublicPlaylist;
  kind: "track" | "playlist";
}) {
  const playerRef = useRef<SeekablePlayer | null>(null);
  const [currentIndex, setCurrentIndex] = useState(
    playlist.tracks.length ? 0 : -1
  );
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressSec, setProgressSec] = useState(0);
  const current =
    currentIndex >= 0 ? (playlist.tracks[currentIndex] ?? null) : null;
  const studioTracks: MockTrack[] = playlist.tracks.map((track) => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    texture: track.texture,
    durationSec: track.durationSec,
    artUrl: track.artUrl,
  }));
  const coverCollection: CollectionArtSource = {
    texture: playlist.texture,
    cover: playlist.cover,
    artUrl: playlist.artUrl,
    trackIds: studioTracks.map((track) => track.id),
  };

  const startAt = (index: number) => {
    if (index === currentIndex) {
      setPlaying((value) => {
        const next = !value;
        if (next && progressSec === 0) setLoading(true);
        return next;
      });
      return;
    }
    setCurrentIndex(index);
    setProgressSec(0);
    setLoading(true);
    setPlaying(true);
  };

  const move = (direction: -1 | 1) => {
    if (playlist.tracks.length < 2) return;
    setCurrentIndex(
      (index) =>
        (index + direction + playlist.tracks.length) % playlist.tracks.length
    );
    setProgressSec(0);
    setLoading(true);
    setPlaying(true);
  };

  const share = async () => {
    const url = window.location.href;
    const data = {
      title: playlist.title,
      text: `Listen to ${playlist.title} on Yukirhythm`,
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
        toast.success("Shared");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const durationSec = current?.durationSec ?? 0;
  const boundedProgress = Math.min(progressSec, durationSec || progressSec);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center px-1">
            <Image
              src="/svgs/logo_light.svg"
              width={20}
              height={20}
              alt="Yukirhythm"
              className="h-5 w-auto object-contain"
            />
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void share()}>
              <Share1Icon className="mr-2 h-3.5 w-3.5" />
              Share
            </Button>
            <Button size="sm" asChild>
              <Link href="/auth">Open app</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 pb-36 sm:px-6 md:grid-cols-[minmax(240px,360px)_minmax(0,1fr)] md:items-start md:gap-12 md:py-14">
        <section className="mx-auto w-full max-w-[360px] md:sticky md:top-24">
          <CollectionArt
            collection={coverCollection}
            tracks={studioTracks}
            className="aspect-square w-full rounded-3xl shadow-e4"
          />
          <SectionLabel className="mt-6 text-primary">
            {kind === "track" ? "Shared track" : "Shared playlist"}
          </SectionLabel>
          <h1 className="type-h1 mt-2 break-words">{playlist.title}</h1>
          <p className="type-muted mt-3 break-words">
            {kind === "track"
              ? playlist.ownerName
              : `Playlist by ${playlist.ownerName}`}
          </p>
          {playlist.description ? (
            <p className="type-p mt-4 break-words text-muted-foreground">
              {playlist.description}
            </p>
          ) : null}
          {current ? (
            <Button
              className="mt-6 w-full"
              onClick={() => startAt(currentIndex)}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="mr-2 h-4 w-4">
                    <CircleSpinner />
                  </span>
                  Loading audio...
                </>
              ) : playing ? (
                <>
                  <PauseIcon className="mr-2" /> Pause
                </>
              ) : (
                <>
                  <PlayIcon className="mr-2" /> Play
                </>
              )}
            </Button>
          ) : null}
        </section>

        <section className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <SectionLabel>
                {kind === "track" ? "Now playing" : "Track list"}
              </SectionLabel>
              <h2 className="type-h3 mt-1">
                {playlist.tracks.length}{" "}
                {playlist.tracks.length === 1 ? "track" : "tracks"}
              </h2>
            </div>
          </div>
          {playlist.tracks.length ? (
            <div className="space-y-1">
              {playlist.tracks.map((track, index) => (
                <div
                  key={`${track.id}-${index}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${index === currentIndex && playing ? "Pause" : "Play"} ${track.title}`}
                  onClick={() => startAt(index)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    startAt(index);
                  }}
                  className="cursor-pointer"
                >
                  <TrackRow
                    index={index + 1}
                    title={track.title}
                    artist={track.artist}
                    duration={formatDuration(track.durationSec)}
                    texture={track.texture}
                    artUrl={track.artUrl}
                    playing={index === currentIndex && playing}
                    selected={index === currentIndex}
                    playable={false}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="type-large">This playlist is empty.</p>
              <p className="type-muted mt-2">
                The person who shared it hasn&apos;t added any playable tracks.
              </p>
            </div>
          )}
        </section>
      </main>

      {current ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-3 py-3 shadow-e4 backdrop-blur-xl sm:px-6">
          <div className="mx-auto flex max-w-6xl items-center gap-3 sm:gap-5">
            <Artwork
              src={current.artUrl}
              texture={current.texture}
              alt=""
              className="h-11 w-11 shrink-0 rounded-xl"
            />
            <div className="hidden min-w-0 w-40 sm:block lg:w-56">
              <p className="type-small truncate">{current.title}</p>
              <p className="type-muted mt-1 truncate">{current.artist}</p>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
              <PlayerButton
                variant="ghost"
                size="sm"
                onClick={() => move(-1)}
                disabled={playlist.tracks.length < 2}
                aria-label="Previous track"
              >
                <TrackPreviousIcon />
              </PlayerButton>
              <PlayerButton
                variant="primary"
                size="lg"
                loading={loading}
                onClick={() => startAt(currentIndex)}
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </PlayerButton>
              <PlayerButton
                variant="ghost"
                size="sm"
                onClick={() => move(1)}
                disabled={playlist.tracks.length < 2}
                aria-label="Next track"
              >
                <TrackNextIcon />
              </PlayerButton>
              <DataText className="hidden shrink-0 text-sm text-muted-foreground sm:block">
                {formatDuration(boundedProgress, { zeroIsKnown: true })}
              </DataText>
              <Slider
                aria-label="Playback position"
                min={0}
                max={Math.max(1, durationSec)}
                step={1}
                value={[boundedProgress]}
                onValueChange={([seconds]) => {
                  const next = seconds ?? 0;
                  setProgressSec(next);
                  playerRef.current?.seekTo(next, "seconds");
                }}
                className="min-w-12 flex-1"
              />
              <DataText className="hidden shrink-0 text-sm text-muted-foreground sm:block">
                {formatDuration(durationSec)}
              </DataText>
            </div>
          </div>
        </div>
      ) : null}

      {current ? (
        <div aria-hidden className="fixed h-0 w-0 overflow-hidden">
          <HiddenYouTubePlayer
            playerRef={playerRef}
            url={current.url}
            playing={playing}
            volume={1}
            onReady={() => setLoading(false)}
            onStart={() => setLoading(false)}
            onProgress={({ playedSeconds }) =>
              setProgressSec(Math.floor(playedSeconds))
            }
            onEnded={() => {
              if (playlist.tracks.length < 2) {
                setPlaying(false);
                setProgressSec(0);
                return;
              }
              move(1);
            }}
          />
        </div>
      ) : null}
      <Toaster />
    </div>
  );
}
