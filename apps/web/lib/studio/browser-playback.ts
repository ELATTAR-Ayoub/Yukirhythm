export type BrowserPlaybackState = {
  trackId: string | null;
  queue: string[];
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
    return raw ? (JSON.parse(raw) as BrowserPlaybackState) : null;
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
