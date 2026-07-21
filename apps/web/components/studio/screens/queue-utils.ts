import type { MockTrack } from "./mock-data";

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
