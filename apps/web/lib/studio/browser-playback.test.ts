import { beforeEach, expect, it } from "vitest";
import { readBrowserPlayback } from "./browser-playback";
beforeEach(() => localStorage.clear());
it("rejects malformed queues without crashing restoration", () => {
  localStorage.setItem(
    "yukirhythm:playback:v1:u",
    JSON.stringify({ queue: "broken" })
  );
  expect(readBrowserPlayback("u")).toBeNull();
});
it("normalizes stored playback and always restores paused", () => {
  localStorage.setItem(
    "yukirhythm:playback:v1:u",
    JSON.stringify({
      queue: [],
      queueIndex: 0.5,
      positionSec: -5,
      volume: 3,
      isPlaying: true,
    })
  );
  expect(readBrowserPlayback("u")).toMatchObject({
    positionSec: 0,
    volume: 1,
    isPlaying: false,
  });
});
