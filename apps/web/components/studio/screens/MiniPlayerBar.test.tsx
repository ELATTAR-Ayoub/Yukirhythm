import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider, { useMockStudio } from "./MockStudioProvider";
import { MOCK_TRACKS } from "./mock-data";
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
   * The bar is permanent chrome now — it used to return null with no track,
   * which is what left the app with no bottom bar on a cold session. These
   * cover the idle presentation: present, but inert.
   */
  describe("with no track playing", () => {
    it("still renders the bar, with an honest idle label and no metadata", () => {
      render(
        <MockStudioProvider>
          <MiniPlayerBar onExpand={() => {}} />
        </MockStudioProvider>
      );

      expect(screen.getByText("Nothing playing")).toBeTruthy();
      expect(screen.queryByText(MOCK_TRACKS[0].title)).toBeNull();
    });

    it("disables the playback controls and the seek", () => {
      render(
        <MockStudioProvider>
          <MiniPlayerBar onExpand={() => {}} />
        </MockStudioProvider>
      );

      // compact: prev/play/next only — no Loop or Queue in this cluster.
      for (const name of ["Previous", "Play", "Next"]) {
        expect(screen.getByLabelText(name).hasAttribute("disabled")).toBe(true);
      }
      expect(screen.getByLabelText("Seek").getAttribute("aria-disabled")).toBe(
        "true"
      );
    });

    it("shows no seek position — not a real 0:00 in a track that isn't there", () => {
      render(
        <MockStudioProvider>
          <MiniPlayerBar onExpand={() => {}} />
        </MockStudioProvider>
      );

      expect(screen.getAllByText("--:--")).toHaveLength(2);
      expect(screen.queryByText("0:00")).toBeNull();
    });

    it("offers no Expand player control — there is no player to expand into", () => {
      const onExpand = vi.fn();
      render(
        <MockStudioProvider>
          <MiniPlayerBar onExpand={onExpand} />
        </MockStudioProvider>
      );

      // Anchor on the bar actually being rendered first, or this assertion
      // would also pass if the whole component returned null — which is the
      // exact regression the idle presentation exists to prevent.
      expect(screen.getByText("Nothing playing")).toBeTruthy();
      expect(screen.queryByLabelText("Expand player")).toBeNull();
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
      expect(screen.queryByText("Nothing playing")).toBeNull();

      fireEvent.click(screen.getByLabelText("Expand player"));
      expect(onExpand).toHaveBeenCalledTimes(1);
    });

    it("re-enables the playback controls and the seek", () => {
      render(
        <MockStudioProvider>
          <PlayFirst />
          <MiniPlayerBar onExpand={() => {}} />
        </MockStudioProvider>
      );
      seed();

      for (const name of ["Previous", "Next"]) {
        expect(screen.getByLabelText(name).hasAttribute("disabled")).toBe(false);
      }
      // Playing, so the 3-face IconSwap is showing Pause rather than Play.
      expect(screen.getByLabelText("Pause").hasAttribute("disabled")).toBe(false);
      expect(screen.getByLabelText("Seek").getAttribute("aria-disabled")).toBe(
        "false"
      );
      expect(screen.queryAllByText("--:--")).toHaveLength(0);
    });
  });
});
