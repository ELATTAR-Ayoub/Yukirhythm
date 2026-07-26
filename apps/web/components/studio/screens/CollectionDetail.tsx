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
  type MockTrack,
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
      <p
        ref={textRef}
        className={cn("type-muted", !expanded && "line-clamp-3")}
      >
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
  /** Where the "+" goes. Defaults to this collection's add-music route. The
   *  queue passes its own, because the queue has no id to build one from. */
  addHref?: string;
  /** Render these rows instead of resolving `collection.trackIds`. The queue
   *  passes its live `queue` array: its tracks are already whole objects, and
   *  round-tripping them through the id registry drops any that miss. */
  tracks?: MockTrack[];
  /**
   * Play by position rather than by track. Supplied by the queue, where a row
   * addresses a queue slot — `play()` would resolve a duplicated track to its
   * first copy, so clicking the second row would start the first.
   */
  onPlayAt?: (index: number) => void;
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
  addHref,
  tracks: tracksProp,
  onPlayAt,
}: CollectionDetailProps) {
  const {
    play,
    toggle,
    nowPlaying,
    isPlaying,
    currentIndex,
    playingCollection,
    shuffled,
    toggleShuffle,
    playShuffled,
  } = useMockStudio();
  const router = useRouter();
  const [view, setView] = useState<TrackView>("rows");
  const [sort, setSort] = useState<TrackSort>("recent");

  const source = playFrom ?? collection;
  // Sorting is suppressed for a positional list: a sorted row index no longer
  // addresses the underlying slot, and the queue's order IS the content.
  const rows = tracksProp ?? getCollectionTracks(collection);
  const tracks = onPlayAt ? rows : sortTracks(rows, sort);
  /** Is the current track one of ours? Then the big button is a pause/resume. */
  const playingHere = tracks.some((t) => t.id === nowPlaying?.id);

  /** Enter/Space activation for non-button click targets. */
  const playKeyHandler =
    (track: (typeof tracks)[number], at: number) =>
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (onPlayAt) onPlayAt(at);
        else play(track, source);
      }
    };

  const activate = (track: (typeof tracks)[number], at: number) =>
    onPlayAt ? onPlayAt(at) : play(track, source);

  // An id match lights up every copy of a duplicated track. In the
  // positional (queue) case the row that is actually playing is the one at
  // the provider's currentIndex — ordinary playlists have no such position,
  // so they keep comparing by id.
  const isRowPlaying = (track: MockTrack, at: number) =>
    isPlaying && (onPlayAt ? currentIndex === at : nowPlaying?.id === track.id);

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
          variant={playingHere && shuffled ? "primary" : "outline"}
          active={playingHere && shuffled}
          aria-label="Shuffle collection"
          onClick={() => {
            if (!tracks.length) return;
            // The queue route is already the live queue, and a playlist that
            // is already playing must shuffle that same live order (including
            // anything added to it). A different playlist starts directly in
            // a shuffled order and remembers it for every subsequent Next.
            if (onPlayAt && currentIndex < 0) {
              playShuffled(tracks, playingCollection ?? undefined);
              return;
            }
            if (
              onPlayAt ||
              (playingHere && playingCollection?.id === source.id)
            ) {
              toggleShuffle();
              return;
            }
            playShuffled(tracks, source);
          }}
        >
          <ShuffleIcon />
        </PlayerButton>
        <PlayerButton
          variant="primary"
          size="xl"
          aria-label={
            playingHere && isPlaying ? "Pause collection" : "Play collection"
          }
          onClick={() => {
            // already on a track from this collection — act as pause/resume
            if (playingHere) return toggle();
            // Through `activate`, not `play`, for the same reason as the rows
            // and shuffle above: on the queue route `play()` re-resolves every
            // track from the catalogue and drops any whose fetch fails, so the
            // one control most likely to be pressed was also the one that
            // could silently lose queued tracks.
            if (tracks[0]) activate(tracks[0], 0);
          }}
        >
          <IconSwap
            active={playingHere && isPlaying ? "pause" : "play"}
            icons={{ play: <PlayIcon />, pause: <PauseIcon /> }}
          />
        </PlayerButton>
      </div>

      <div className="flex items-center justify-between gap-3 mt-6 mb-2">
        {onPlayAt ? <span /> : <SortControl sort={sort} onChange={setSort} />}
        <div className="flex items-center gap-2">
          <PlayerButton
            variant="outline"
            size="sm"
            aria-label="Add music"
            onClick={() => router.push(addHref ?? addMusicHref(collection.id))}
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
        // pr-1 and gap-2 are what put a row's like button on the same column
        // as the Add music control above it, and give the like/⋯ pair the same
        // 8px separation the Add music/view-toggle pair has. The two rows
        // can't also share a right edge — the view toggle is wider than the ⋯
        // button — and matching the leading control is what reads.
        <FadeScrollArea className="space-y-1 pr-1">
          {tracks.map((track, i) => (
            <div key={`${track.id}:${i}`} className="flex items-center gap-2">
              <div
                role="button"
                tabIndex={0}
                aria-label={`Play ${track.title}`}
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => activate(track, i)}
                onKeyDown={playKeyHandler(track, i)}
              >
                {/* No play overlay: this row sits inside a role="button" div,
                    and TrackRow's overlay would nest a button inside it. */}
                <TrackRow
                  index={i + 1}
                  title={track.title}
                  artist={track.artist}
                  duration={formatDuration(track.durationSec)}
                  texture={track.texture}
                  artUrl={track.artUrl}
                  playing={isRowPlaying(track, i)}
                  playable={false}
                  desktop
                  album={collection.title}
                />
              </div>
              {/* Siblings of the row, not children: the row is a role="button"
                  and nesting controls inside it would make each a dead
                  keyboard stop that only works because the click bubbles. */}
              <LikeButton trackId={track.id} trackTitle={track.title} />
              <TrackMenu
                track={track}
                collection={collection}
                queueIndex={onPlayAt ? i : undefined}
              />
            </div>
          ))}
        </FadeScrollArea>
      ) : (
        <FadeScrollArea className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pr-0.5">
          {tracks.map((track, i) => (
            <div
              key={`${track.id}:${i}`}
              role="button"
              tabIndex={0}
              aria-label={`Play ${track.title}`}
              className="text-left cursor-pointer"
              onClick={() => activate(track, i)}
              onKeyDown={playKeyHandler(track, i)}
            >
              <MediaCard
                title={track.title}
                artist={track.artist}
                texture={track.texture}
                artUrl={track.artUrl}
                size="sm"
                playing={isRowPlaying(track, i)}
                className="w-full"
              />
            </div>
          ))}
        </FadeScrollArea>
      )}
    </>
  );
}
