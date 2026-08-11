"use client";

import { useRef, useState } from "react";
import { ChevronDownIcon } from "@radix-ui/react-icons";

import Artwork from "@/components/studio/Artwork";
import TrackRow from "@/components/studio/TrackRow";
import { PlayerButton } from "@/components/studio/PlayerButton";
import { Button } from "@/components/ui/button";
import PlaybackBar from "@/components/studio/shell/PlaybackBar";
import { useIsDesktop } from "@/components/studio/shell/useBreakpoint";
import { formatDuration, type MockTrack } from "./mock-data";
import { useMockStudio } from "./MockStudioProvider";
import MiniPlayerBar from "./MiniPlayerBar";
import StudioMediaCard from "./StudioMediaCard";

/** Full-page player assembled from Yuki's existing playback primitives. */
export default function ImmersivePlayer({
  onCollapse,
}: {
  onCollapse: () => void;
}) {
  const { nowPlaying, queue, currentIndex, playAt, findSimilarTracks } =
    useMockStudio();
  const isDesktop = useIsDesktop();
  const [similarResult, setSimilarResult] = useState<{
    seedId: string;
    tracks: MockTrack[];
  } | null>(null);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarErrorSeed, setSimilarErrorSeed] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | null>(null);

  if (!nowPlaying) return null;
  const similar =
    similarResult?.seedId === nowPlaying.id ? similarResult.tracks : [];
  const similarError = similarErrorSeed === nowPlaying.id;
  const upcomingStart = Math.max(0, currentIndex + 1);
  const upcoming = queue.slice(upcomingStart);

  const findSimilar = async () => {
    if (similarLoading) return;
    setSimilarLoading(true);
    setSimilarErrorSeed(null);
    try {
      const tracks = await findSimilarTracks(nowPlaying.id);
      setSimilarResult({ seedId: nowPlaying.id, tracks });
    } catch {
      setSimilarErrorSeed(nowPlaying.id);
    } finally {
      setSimilarLoading(false);
    }
  };

  const parallax = (event: React.UIEvent<HTMLDivElement>) => {
    const top = event.currentTarget.scrollTop;
    if (scrollFrameRef.current !== null)
      cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(() => {
      if (backdropRef.current)
        backdropRef.current.style.transform = `translate3d(0, ${top * 0.12}px, 0)`;
      if (coverRef.current)
        coverRef.current.style.transform = `translate3d(0, ${top * 0.24}px, 0)`;
      scrollFrameRef.current = null;
    });
  };

  return (
    <div
      className="relative h-[100dvh] overflow-y-auto bg-background no-scrollbar"
      onScroll={parallax}
    >
      <PlayerButton
        variant="secondary"
        size="sm"
        aria-label="Collapse player"
        onClick={onCollapse}
        className="fixed right-5 top-5 z-[70]"
      >
        <ChevronDownIcon />
      </PlayerButton>

      <section className="relative z-10 flex min-h-[105dvh] flex-col overflow-hidden px-6 pb-36 pt-20">
        <div
          ref={backdropRef}
          className="pointer-events-none absolute inset-0 will-change-transform"
          aria-hidden
        >
          <Artwork
            src={nowPlaying.artUrl}
            texture={nowPlaying.texture}
            alt=""
            className="absolute inset-[-4rem] h-[calc(100%+8rem)] w-[calc(100%+8rem)] scale-110 opacity-60 blur-3xl saturate-125"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/15 via-background/35 to-background" />
        </div>
        <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center">
          <h1 className="max-w-4xl text-center font-display text-2xl font-bold text-paper md:text-4xl">
            {nowPlaying.title}
          </h1>
          <div
            ref={coverRef}
            className="mt-10 flex flex-1 items-center justify-center will-change-transform"
          >
            <Artwork
              src={nowPlaying.artUrl}
              texture={nowPlaying.texture}
              alt={nowPlaying.title}
              className="aspect-square w-[min(72vw,54vh,34rem)] rounded-[1.5rem] shadow-e5"
            />
          </div>
          <p className="mt-8 text-center font-ui text-lg text-paper/75">
            {nowPlaying.artist}
          </p>
        </div>
      </section>

      <div className="relative z-20 mx-auto -mt-28 grid max-w-7xl items-start gap-6 px-4 pb-36 md:grid-cols-2">
        <section
          aria-labelledby="immersive-queue"
          className="flex max-h-[62dvh] flex-col overflow-hidden rounded-[2rem] border border-border bg-card/90 p-5 shadow-e4 backdrop-blur-xl md:max-h-[42rem]"
        >
          <h2 id="immersive-queue" className="font-display text-2xl font-bold">
            Queue
          </h2>
          <div className="relative mt-4 min-h-0 flex-1">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-7 bg-gradient-to-b from-card to-transparent" />
            <div className="h-full space-y-1 overflow-y-auto pr-1 no-scrollbar">
              {upcoming.length ? (
                upcoming.map((track, offset) => {
                  const at = upcomingStart + offset;
                  return (
                    <button
                      key={`${track.id}:${at}`}
                      type="button"
                      onClick={() => playAt(at)}
                      className="block w-full text-left"
                    >
                      <TrackRow
                        title={track.title}
                        artist={track.artist}
                        duration={formatDuration(track.durationSec)}
                        texture={track.texture}
                        artUrl={track.artUrl}
                        playable={false}
                      />
                    </button>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nothing queued yet.
                </p>
              )}
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-9 bg-gradient-to-t from-card to-transparent" />
          </div>
        </section>

        <section
          aria-labelledby="immersive-similar"
          className="flex max-h-[62dvh] flex-col overflow-hidden rounded-[2rem] border border-border bg-card/90 p-5 shadow-e4 backdrop-blur-xl md:max-h-[42rem]"
        >
          <h2
            id="immersive-similar"
            className="font-display text-2xl font-bold"
          >
            Similar songs
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Preview with one click. Double-click to queue.
          </p>
          {similar.length ? (
            <div className="relative mt-4 min-h-0 flex-1">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-7 bg-gradient-to-b from-card to-transparent" />
              <div className="grid h-full grid-cols-2 gap-3 overflow-y-auto pr-1 no-scrollbar">
                {similar.map((track) => (
                  <StudioMediaCard
                    key={track.id}
                    track={track}
                    size="sm"
                    className="w-full"
                  />
                ))}
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-9 bg-gradient-to-t from-card to-transparent" />
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-border p-5 text-center">
              <p className="text-sm text-muted-foreground">
                {similarError
                  ? "Yuki couldn’t build this mix yet."
                  : `Build a mix around “${nowPlaying.title}”.`}
              </p>
              <Button
                type="button"
                className="mt-4"
                onClick={findSimilar}
                disabled={similarLoading}
                aria-busy={similarLoading}
              >
                {similarLoading
                  ? "Finding songs…"
                  : similarError
                    ? "Try again"
                    : "Find similar songs"}
              </Button>
            </div>
          )}
        </section>
      </div>

      {isDesktop ? (
        <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-[1500px]">
          <PlaybackBar onExpand={onCollapse} />
        </div>
      ) : (
        <MiniPlayerBar onExpand={onCollapse} />
      )}
    </div>
  );
}
