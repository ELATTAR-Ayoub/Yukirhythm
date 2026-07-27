import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider, { useMockStudio } from "./MockStudioProvider";
import { MOCK_TRACKS, formatDuration } from "./mock-data";
import MiniPlayerBar from "./MiniPlayerBar";

function PlayFirst() {
  const { play } = useMockStudio();
  return <button onClick={() => play(MOCK_TRACKS[0])}>seed</button>;
}

/** Starts playback and clears MockStudioProvider's 650ms fake buffering. */
function seed() {
  fireEvent.click(screen.getByText("seed"));
  act(() => void vi.advanceTimersByTime(650));
}

describe("MiniPlayerBar", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /**
   * Deliberately absent when idle, unlike the desktop PlaybackBar: on a
   * phone this bar is `fixed`, so hiding it costs nothing but the padding
   * `main` reserves, and a dead 70px band would compete with the tab bar
   * for the scarcest space on screen.
   *
   * Asserting on an empty container rather than on absent labels: the whole
   * point is that NOTHING renders, and a label-absence check would also
   * pass for a bar that rendered with different copy.
   */
  describe("with no track playing", () => {
    it("renders nothing at all", () => {
      const { container } = render(
        <MockStudioProvider>
          <MiniPlayerBar onExpand={() => {}} />
        </MockStudioProvider>
      );

      expect(container).toBeEmptyDOMElement();
    });

    it("puts no player controls on screen for a track that isn't there", () => {
      const onExpand = vi.fn();
      render(
        <MockStudioProvider>
          <MiniPlayerBar onExpand={onExpand} />
        </MockStudioProvider>
      );

      for (const name of [
        "Expand player",
        "Previous",
        "Play",
        "Next",
        "Seek",
      ]) {
        expect(screen.queryByLabelText(name)).toBeNull();
      }
      expect(onExpand).not.toHaveBeenCalled();
    });
  });

  describe("with a track playing", () => {
    it("shows the track's identity and an Expand player control that fires", () => {
      const onExpand = vi.fn();
      render(
        <MockStudioProvider>
          <PlayFirst />
          <MiniPlayerBar onExpand={onExpand} />
        </MockStudioProvider>
      );
      seed();

      expect(screen.getByText(MOCK_TRACKS[0].title)).toBeTruthy();
      expect(screen.getByText(MOCK_TRACKS[0].artist)).toBeTruthy();

      fireEvent.click(screen.getByLabelText("Expand player"));
      expect(onExpand).toHaveBeenCalledTimes(1);
    });

    it("has live playback controls and a seek carrying the real duration", () => {
      render(
        <MockStudioProvider>
          <PlayFirst />
          <MiniPlayerBar onExpand={() => {}} />
        </MockStudioProvider>
      );
      seed();

      // This seed starts at queue position zero: there is no earlier track,
      // while Next can still advance through the rest of the queue.
      expect(screen.getByLabelText("Previous")).toBeDisabled();
      expect(screen.getByLabelText("Next")).not.toBeDisabled();
      // Playing, so the 3-face IconSwap is showing Pause rather than Play.
      expect(screen.getByLabelText("Pause").hasAttribute("disabled")).toBe(
        false
      );
      expect(screen.getByLabelText("Seek").getAttribute("aria-disabled")).toBe(
        "false"
      );
      // The seek is bound to this track, not left at some placeholder range.
      expect(screen.getByRole("slider").getAttribute("aria-valuemax")).toBe(
        String(MOCK_TRACKS[0].durationSec)
      );
      expect(
        screen.getByText(formatDuration(MOCK_TRACKS[0].durationSec))
      ).toBeTruthy();
    });
  });
});
