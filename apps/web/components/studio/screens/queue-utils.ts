import type { MockCollection, MockTrack } from "./mock-data";

/** Where an enqueued track lands relative to what's playing. */
export type EnqueueMode = "next" | "end";

/**
 * Put a track into the running queue.
 *
 * The queue is not a playlist: it is the ordered list the player is walking
 * through right now, so "add" here means splice into that list rather than
 * write a membership row anywhere. `next` lands immediately after the track
 * being played so it is the very next thing heard; `end` goes to the back.
 *
 * `currentIndex` is -1 before anything has started — there is no "after the
 * current track" then, so `next` and `end` both mean "put it in the queue",
 * and the head of the list is where it will actually be heard first.
 *
 * Pure, and shared by both providers so the mock preview and the real backend
 * order tracks identically.
 */
export function insertIntoQueue(
  queue: MockTrack[],
  track: MockTrack,
  mode: EnqueueMode,
  currentIndex: number
): MockTrack[] {
  if (mode === "end" || currentIndex < 0) return [...queue, track];
  const at = Math.min(currentIndex + 1, queue.length);
  return [...queue.slice(0, at), track, ...queue.slice(at)];
}

/**
 * Whether a `play(track, from)` call lands inside the queue that is already
 * running, versus naming a genuinely different playlist.
 *
 * `from` omitted is never "same context" — Search and Home call `play(track)`
 * with no source, and before this existed that always meant "detach and start
 * fresh." A track that happens to already sit in the running queue must not
 * silently keep the listener inside whatever playlist put it there; only a
 * `from` that names the collection currently playing counts as staying put.
 *
 * Pure and shared by both providers so a divergence here can't reintroduce
 * the bug this unit exists to fix in only one of them.
 */
export function isSameContext(
  from: MockCollection | undefined,
  playingCollection: MockCollection | null
): boolean {
  return from ? from.id === playingCollection?.id : false;
}

/**
 * Drop exactly one position from the running queue and work out where the
 * playhead lands.
 *
 * Everything after the removed slot shifts down by one, so an index above it
 * has to follow or the removal would silently change what is playing.
 * Removing the position the playhead itself is on leaves the index put — the
 * same slot now addresses the track that used to follow, which is what
 * "drop what you're hearing, move on" means. But if that position was also
 * the last one in the queue, there is nothing left for it to address: the
 * index is clamped to -1 rather than left one past the end, where a later,
 * unrelated `enqueue` could refill that exact slot and silently resurrect
 * playback — breaking `enqueue`'s own promise that queueing something never
 * starts it.
 *
 * Pure and shared by both providers for the same reason as `isSameContext`.
 */
export function removeQueueIndex(
  queue: MockTrack[],
  currentIndex: number,
  index: number
): { queue: MockTrack[]; currentIndex: number } {
  if (index < 0 || index >= queue.length) return { queue, currentIndex };
  const nextQueue = [...queue.slice(0, index), ...queue.slice(index + 1)];
  let nextIndex = index < currentIndex ? currentIndex - 1 : currentIndex;
  if (nextIndex >= nextQueue.length) nextIndex = -1;
  return { queue: nextQueue, currentIndex: nextIndex };
}

/**
 * Where a loose `play(track)` — no `from` — lands when the user's own
 * ad-hoc queue is already running (see B5: this only applies once the
 * caller has confirmed `playingCollection` is null and the queue is
 * non-empty). Already queued → jump to the existing slot, no duplicate;
 * otherwise the track joins the queue at the end and that's where playback
 * lands.
 *
 * Pure and shared by both providers, same reasoning as isSameContext.
 */
export function joinAdHocQueue(
  queue: MockTrack[],
  track: MockTrack
): { queue: MockTrack[]; index: number } {
  const at = queue.findIndex((t) => t.id === track.id);
  if (at >= 0) return { queue, index: at };
  return { queue: [...queue, track], index: queue.length };
}

/**
 * Fisher–Yates the queue with the track at `currentIndex` pinned to the
 * front — shuffle must never interrupt or reorder-away-from what's already
 * playing. `rand` is injectable (defaults to `Math.random`) so callers can
 * pin a deterministic permutation in tests.
 *
 * No special-casing for empty/single-track queues: the general algorithm
 * already degenerates correctly (nothing to shuffle, current stays put).
 *
 * Pure and shared by both providers so enabling shuffle behaves identically
 * in the mock and the real player.
 */
export function shuffleOrder(
  queue: MockTrack[],
  currentIndex: number,
  rand: () => number = Math.random
): { queue: MockTrack[]; currentIndex: number } {
  const current = currentIndex >= 0 ? queue[currentIndex] : undefined;
  const rest = queue.filter((_, i) => i !== currentIndex);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const shuffled = current ? [current, ...rest] : rest;
  return { queue: shuffled, currentIndex: current ? 0 : currentIndex };
}

/**
 * Undo a shuffle: return to the remembered pre-shuffle order, dropping any
 * id no longer present in the live queue (a track dequeued while shuffled
 * must not be resurrected — see the dequeue-while-shuffled note on
 * `toggleShuffle`). Anything in the live queue that ISN'T in the saved order
 * (a track enqueued while shuffled) is appended at the end rather than
 * silently dropped — restoring shuffle must never lose a track the user
 * queued.
 *
 * `currentIndex` is re-derived from `nowPlayingId` rather than carried over:
 * the same track can sit at a different position in either order.
 *
 * Pure and shared by both providers for the same reason as shuffleOrder.
 */
export function restoreOrder(
  saved: MockTrack[],
  liveQueue: MockTrack[],
  nowPlayingId: string | null
): { queue: MockTrack[]; currentIndex: number } {
  // Counts, rather than Sets, preserve duplicate queue positions. Removing
  // one copy while shuffled must not resurrect it on restore, and adding a
  // second copy while shuffled must not silently discard that new position.
  const remainingLive = new Map<string, number>();
  liveQueue.forEach((track) =>
    remainingLive.set(track.id, (remainingLive.get(track.id) ?? 0) + 1)
  );
  const restored = saved.filter((track) => {
    const count = remainingLive.get(track.id) ?? 0;
    if (!count) return false;
    remainingLive.set(track.id, count - 1);
    return true;
  });
  const added = liveQueue.filter((track) => {
    const count = remainingLive.get(track.id) ?? 0;
    if (!count) return false;
    remainingLive.set(track.id, count - 1);
    return true;
  });
  const queue = [...restored, ...added];
  const currentIndex = nowPlayingId
    ? queue.findIndex((t) => t.id === nowPlayingId)
    : -1;
  return { queue, currentIndex };
}
