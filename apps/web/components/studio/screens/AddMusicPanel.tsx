"use client";

import { useEffect, useState } from "react";
import {
  CheckIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from "@radix-ui/react-icons";

import { Input } from "@/components/ui/input";
import TrackRow from "@/components/studio/TrackRow";
import EmptyState from "@/components/studio/EmptyState";
import { SkeletonRow } from "@/components/studio/Skeletons";
import { PlayerButton } from "@/components/studio/PlayerButton";
import IconSwap from "@/components/studio/IconSwap";
import { useMockStudio } from "./MockStudioProvider";
import {
  formatDuration,
  type MockCollection,
  type MockTrack,
} from "./mock-data";

interface AddMusicPanelProps {
  /**
   * Playlist to add to. Omit to add to the running queue instead — the rail's
   * "Up next" is the queue, and queueing a track must not require a playlist
   * to be open, nor write anything to one.
   */
  collection?: MockCollection;
  /** The drawer focuses the field on open; the docked rail must not. */
  autoFocus?: boolean;
}

/** Long enough to stop firing a request per keystroke, short enough that the
 *  results still feel attached to the typing. */
const DEBOUNCE_MS = 250;

/**
 * Search-and-add body. Suggestions render inline rather than in a floating
 * popover — on a phone a popup over a sheet is unreachable, and in the rail a
 * popover would escape the column.
 */
export default function AddMusicPanel({
  collection,
  autoFocus = false,
}: AddMusicPanelProps) {
  const { addTrackToCollection, enqueue, searchTracks, queue, user } =
    useMockStudio();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<MockTrack[]>([]);
  const [searching, setSearching] = useState(false);

  // Debounced against the provider's one-shot search: the real one is a
  // network call to the catalogue, so this cannot be the synchronous fixture
  // lookup it used to be.
  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let live = true;
    const timer = setTimeout(async () => {
      const found = await searchTracks(query);
      if (!live) return;
      setResults(found);
      setSearching(false);
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, searchTracks]);

  const toQueue = collection === undefined;
  const isAdded = (trackId: string) =>
    toQueue
      ? queue.some((t) => t.id === trackId)
      : collection.trackIds.includes(trackId);

  const addedLabel = (title: string) =>
    toQueue ? `${title} already queued` : `${title} already added`;
  const addLabel = (title: string) =>
    toQueue ? `Add ${title} to queue` : `Add ${title}`;

  const add = (trackId: string, track: MockTrack) => {
    if (toQueue) enqueue(track);
    else addTrackToCollection(collection.id, trackId);
  };

  return (
    <>
      <div className="relative mb-6">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          autoFocus={autoFocus}
          // Signed out the field can't answer, and a box that swallows typing
          // is worse than one that plainly isn't ready yet.
          disabled={!user}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tracks, artists, tags…"
          aria-label={
            toQueue ? "Search tracks to queue" : "Search tracks to add"
          }
          className="pl-9"
          data-signal="add_music_search"
        />
      </div>

      {!user ? (
        // The catalogue search is authenticated: signed out it answers 401,
        // which would otherwise surface as "no matches" — a wrong answer to a
        // question that was never asked.
        <EmptyState
          title="Sign in to search"
          hint="Your queue and library live with your account."
          texture="tx-k2-static"
        />
      ) : !q.trim() ? (
        <EmptyState
          title={toQueue ? "Search to queue" : "Search to add"}
          hint="Find a track by title, artist or tag."
          texture="tx-k2-static"
        />
      ) : searching ? (
        // Not an EmptyState: "no matches" and "still looking" are different
        // answers, and showing the former while a request is in flight reads
        // as a result the search never gave. A skeleton is a promise that
        // content is coming — only this state can honestly make that promise,
        // so the other three states below stay EmptyState blocks.
        <div className="space-y-1" role="status" aria-label="Searching">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          title="No matches"
          hint="Try a different title, artist or tag."
          texture="tx-k2-static"
        />
      ) : (
        <div className="space-y-1">
          {results.map((track, i) => {
            const added = isAdded(track.id);
            return (
              <div key={track.id} className="flex items-center gap-1">
                <div className="flex-1 min-w-0">
                  {/* No play affordance: this row's only action is adding, and
                      the overlay button had no handler behind it. */}
                  <TrackRow
                    index={i + 1}
                    title={track.title}
                    artist={track.artist}
                    duration={formatDuration(track.durationSec)}
                    texture={track.texture}
                    artUrl={track.artUrl}
                    playable={false}
                  />
                </div>
                <PlayerButton
                  variant={added ? "primary" : "outline"}
                  size="sm"
                  disabled={added}
                  aria-label={
                    added ? addedLabel(track.title) : addLabel(track.title)
                  }
                  onClick={() => add(track.id, track)}
                  data-signal="add_music_confirm"
                >
                  <IconSwap
                    active={added ? "added" : "add"}
                    icons={{ add: <PlusIcon />, added: <CheckIcon /> }}
                  />
                </PlayerButton>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
