"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DiscIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  ShuffleIcon,
} from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import FadeScrollArea from "@/components/studio/FadeScrollArea";
import MediaCard from "@/components/studio/MediaCard";
import TrackRow from "@/components/studio/TrackRow";
import EmptyState from "@/components/studio/EmptyState";
import { PlayerButton } from "@/components/studio/PlayerButton";
import IconSwap from "@/components/studio/IconSwap";
import LikeButton from "./LikeButton";
import TrackMenu from "./TrackMenu";
import ViewToggle, { type TrackView } from "./ViewToggle";
import SortControl from "./SortControl";
import { TagChip } from "./TagChip";
import { sortTracks, type TrackSort } from "./library-utils";
import { useMockStudio } from "./MockStudioProvider";
import { addMusicHref } from "../shell/routes";
import {
  formatDuration,
  getCollectionTracks,
  type MockCollection,
} from "./mock-data";

/** Track count (vinyl icon) · description — desc clamps to 3 lines, See more expands. */
function CollectionDesc({ count, desc }: { count: number; desc: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [desc, expanded]);

  return (
    <div className="mt-2">
      <p ref={textRef} className={cn("type-muted", !expanded && "line-clamp-3")}>
        <span
          aria-label={`${count} tracks`}
          className="inline-flex items-baseline gap-1 mr-1.5 text-muted-foreground"
        >
          {/* Satoshi, not the LCD face — the pixel digits sat off the baseline here. */}
          <span className="font-ui font-medium tabular-nums">{count}</span>
          <DiscIcon aria-hidden className="h-3.5 w-3.5 self-center" />
        </span>
        <span aria-hidden className="mr-1.5">
          ·
        </span>
        {desc}
      </p>
      {overflows || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="type-muted text-primary hover:underline mt-0.5"
        >
          {expanded ? "See less" : "See more"}
        </button>
      ) : null}
    </div>
  );
}

/** One-line horizontal strip — scrollbar hidden (Radix viewport), drag to pan. */
function DragScrollRow({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startLeft: number } | null>(null);

  const viewport = () =>
    rootRef.current?.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]"
    ) ?? null;

  return (
    <ScrollArea
      ref={rootRef}
      className="min-w-0 flex-1 cursor-grab active:cursor-grabbing"
      onPointerDown={(e) => {
        const vp = viewport();
        if (!vp) return;
        drag.current = { startX: e.clientX, startLeft: vp.scrollLeft };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const vp = viewport();
        if (!vp || !drag.current) return;
        vp.scrollLeft =
          drag.current.startLeft - (e.clientX - drag.current.startX);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <div className="flex flex-nowrap items-center gap-1.5">{children}</div>
    </ScrollArea>
  );
}

interface CollectionDetailProps {
  collection: MockCollection;
  /** Play calls carry the collection so the queue follows what was opened. */
  playFrom?: MockCollection;
}

/**
 * The shared body of every collection surface — description, tags,
 * play/shuffle, sort + view, and the track list. The playlist and queue
 * routes, and the PlaylistDrawer/QueueDrawer components still demoed in the
 * design-system docs, differ only in the header they put above this.
 */
export default function CollectionDetail({
  collection,
  playFrom,
}: CollectionDetailProps) {
  const { play, toggle, nowPlaying, isPlaying } = useMockStudio();
  const router = useRouter();
  const [view, setView] = useState<TrackView>("rows");
  const [sort, setSort] = useState<TrackSort>("recent");

  const source = playFrom ?? collection;
  const tracks = sortTracks(getCollectionTracks(collection), sort);
  /** Is the current track one of ours? Then the big button is a pause/resume. */
  const playingHere = tracks.some((t) => t.id === nowPlaying?.id);

  /** Enter/Space activation for non-button click targets. */
  const playKeyHandler =
    (track: (typeof tracks)[number]) => (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        play(track, source);
      }
    };

  return (
    <>
      <CollectionDesc
        key={collection.id}
        count={tracks.length}
        desc={collection.desc}
      />

      <div className="flex items-center gap-3 mt-4">
        <DragScrollRow>
          {collection.tags.map((tag) => (
            <TagChip key={tag} label={tag} />
          ))}
        </DragScrollRow>
        <PlayerButton
          variant="outline"
          aria-label="Shuffle collection"
          onClick={() =>
            tracks.length &&
            play(tracks[Math.floor(Math.random() * tracks.length)], source)
          }
        >
          <ShuffleIcon />
        </PlayerButton>
        <PlayerButton
          variant="primary"
          size="xl"
          aria-label={playingHere && isPlaying ? "Pause collection" : "Play collection"}
          onClick={() => {
            // already on a track from this collection — act as pause/resume
            if (playingHere) return toggle();
            if (tracks[0]) play(tracks[0], source);
          }}
        >
          <IconSwap
            active={playingHere && isPlaying ? "pause" : "play"}
            icons={{ play: <PlayIcon />, pause: <PauseIcon /> }}
          />
        </PlayerButton>
      </div>

      <div className="flex items-center justify-between gap-3 mt-6 mb-2">
        <SortControl sort={sort} onChange={setSort} />
        <div className="flex items-center gap-2">
          <PlayerButton
            variant="outline"
            size="sm"
            aria-label="Add music"
            onClick={() => router.push(addMusicHref(collection.id))}
            data-signal="add_music_open"
          >
            <PlusIcon />
          </PlayerButton>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {tracks.length === 0 ? (
        <EmptyState
          title="Nothing in here yet"
          hint="Tracks you add will show up here."
          texture="tx-k2-static"
        />
      ) : view === "rows" ? (
        <FadeScrollArea className="space-y-1 pr-0.5">
          {tracks.map((track, i) => (
            <div key={track.id} className="flex items-center gap-1">
              <div
                role="button"
                tabIndex={0}
                aria-label={`Play ${track.title}`}
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => play(track, source)}
                onKeyDown={playKeyHandler(track)}
              >
                {/* No play overlay: this row sits inside a role="button" div,
                    and TrackRow's overlay would nest a button inside it. */}
                <TrackRow
                  index={i + 1}
                  title={track.title}
                  artist={track.artist}
                  duration={formatDuration(track.durationSec)}
                  texture={track.texture}
                  playing={nowPlaying?.id === track.id && isPlaying}
                  playable={false}
                  desktop
                  album={collection.title}
                />
              </div>
              {/* Siblings of the row, not children: the row is a role="button"
                  and nesting controls inside it would make each a dead
                  keyboard stop that only works because the click bubbles. */}
              <LikeButton trackId={track.id} trackTitle={track.title} />
              <TrackMenu track={track} collection={collection} />
            </div>
          ))}
        </FadeScrollArea>
      ) : (
        <FadeScrollArea className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pr-0.5">
          {tracks.map((track) => (
            <div
              key={track.id}
              role="button"
              tabIndex={0}
              aria-label={`Play ${track.title}`}
              className="text-left cursor-pointer"
              onClick={() => play(track, source)}
              onKeyDown={playKeyHandler(track)}
            >
              <MediaCard
                title={track.title}
                artist={track.artist}
                texture={track.texture}
                size="sm"
                playing={nowPlaying?.id === track.id && isPlaying}
                className="w-full"
              />
            </div>
          ))}
        </FadeScrollArea>
      )}
    </>
  );
}
