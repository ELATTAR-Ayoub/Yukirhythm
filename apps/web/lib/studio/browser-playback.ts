import type { MockTrack } from "@/components/studio/screens/mock-data";

export type BrowserPlaybackState = {
  trackId: string | null;
  queue: string[];
  /** Complete browser-local queue snapshots avoid one catalogue request per
   * queue item when restoring a playlist after reload. */
  queueTracks?: MockTrack[];
  queueIndex: number;
  positionSec: number;
  isPlaying: boolean;
  volume: number;
  sourceType?: "collection" | "library";
  sourceId?: string | null;
  shuffleMode?: boolean;
};

const key = (uid: string) => `yukirhythm:playback:v1:${uid}`;

export function readBrowserPlayback(uid: string): BrowserPlaybackState | null {
  try {
    const raw = localStorage.getItem(key(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BrowserPlaybackState> | null;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.queue) ||
      !parsed.queue.every((id) => typeof id === "string")
    )
      return null;
    return {
      ...parsed,
      trackId: typeof parsed.trackId === "string" ? parsed.trackId : null,
      queue: parsed.queue.slice(0, 2000),
      queueTracks: Array.isArray(parsed.queueTracks)
        ? parsed.queueTracks.filter(
            (t) =>
              t &&
              typeof t.id === "string" &&
              typeof t.title === "string" &&
              Number.isFinite(t.durationSec)
          )
        : undefined,
      queueIndex: Number.isFinite(parsed.queueIndex)
        ? Math.floor(parsed.queueIndex!)
        : -1,
      positionSec: Number.isFinite(parsed.positionSec)
        ? Math.max(0, parsed.positionSec!)
        : 0,
      volume: Number.isFinite(parsed.volume)
        ? Math.min(1, Math.max(0, parsed.volume!))
        : 1,
      isPlaying: false,
    };
  } catch {
    return null;
  }
}

export function writeBrowserPlayback(
  uid: string,
  state: BrowserPlaybackState
): void {
  try {
    localStorage.setItem(key(uid), JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }
}
