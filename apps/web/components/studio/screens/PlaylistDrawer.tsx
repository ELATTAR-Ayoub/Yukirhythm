"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  DiscIcon,
  PlayIcon,
  ShuffleIcon,
} from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import { DrawerClose, DrawerTitle } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import DataText from "@/components/studio/DataText";
import MediaCard from "@/components/studio/MediaCard";
import TrackRow from "@/components/studio/TrackRow";
import EmptyState from "@/components/studio/EmptyState";
import { PlayerButton } from "@/components/studio/PlayerButton";
import AppDrawer from "./AppDrawer";
import TrackMenu from "./TrackMenu";
import ViewToggle, { type TrackView } from "./ViewToggle";
import SortControl from "./SortControl";
import { TagChip } from "./TagChip";
import { sortTracks, type TrackSort } from "./library-utils";
import { useMockStudio } from "./MockStudioProvider";
import {
  formatDuration,
  getCollectionTracks,
  type MockCollection,
} from "./mock-data";

interface PlaylistDrawerProps {
  collection: MockCollection | null;
  onOpenChange: (open: boolean) => void;
}

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
          className="inline-flex items-center gap-1 mr-1.5 align-middle text-muted-foreground"
        >
          <DataText className="text-sm">{count}</DataText>
          <DiscIcon aria-hidden className="h-3.5 w-3.5" />
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

/** 95vh playlist detail — play, shuffle, tags, view/sort, tracks with menus. */
export default function PlaylistDrawer({
  collection,
  onOpenChange,
}: PlaylistDrawerProps) {
  const { play, nowPlaying, isPlaying } = useMockStudio();
  const [view, setView] = useState<TrackView>("rows");
  const [sort, setSort] = useState<TrackSort>("recent");

  const tracks = collection
    ? sortTracks(getCollectionTracks(collection), sort)
    : [];

  /** Enter/Space activation for non-button click targets. */
  const playKeyHandler =
    (track: (typeof tracks)[number]) => (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        play(track);
      }
    };

  return (
    <AppDrawer open={collection !== null} onOpenChange={onOpenChange} height="95vh">
      {collection ? (
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2">
            <DrawerClose asChild>
              <PlayerButton variant="ghost" size="sm" aria-label="Back">
                <ChevronLeftIcon />
              </PlayerButton>
            </DrawerClose>
            <DrawerTitle className="type-h2 truncate">
              {collection.title}
            </DrawerTitle>
          </div>

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
                play(tracks[Math.floor(Math.random() * tracks.length)])
              }
            >
              <ShuffleIcon />
            </PlayerButton>
            <PlayerButton
              variant="primary"
              size="xl"
              aria-label="Play collection"
              onClick={() => tracks[0] && play(tracks[0])}
            >
              <PlayIcon />
            </PlayerButton>
          </div>

          <div className="flex items-center justify-between gap-3 mt-6 mb-2">
            <SortControl sort={sort} onChange={setSort} />
            <ViewToggle view={view} onChange={setView} />
          </div>

          {tracks.length === 0 ? (
            <EmptyState
              title="Nothing in here yet"
              hint="Tracks you add will show up here."
              texture="tx-k2-static"
            />
          ) : view === "rows" ? (
            <div className="space-y-1">
              {tracks.map((track, i) => (
                <div key={track.id} className="flex items-center gap-1">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`Play ${track.title}`}
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => play(track)}
                    onKeyDown={playKeyHandler(track)}
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
                  <TrackMenu trackTitle={track.title} />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {tracks.map((track) => (
                <div
                  key={track.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Play ${track.title}`}
                  className="text-left cursor-pointer"
                  onClick={() => play(track)}
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
            </div>
          )}
        </div>
      ) : null}
    </AppDrawer>
  );
}
