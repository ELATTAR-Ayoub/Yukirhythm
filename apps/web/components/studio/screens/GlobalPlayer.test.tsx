import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider, { useMockStudio } from "./MockStudioProvider";
import GlobalPlayer from "./GlobalPlayer";
import NowPlayingRail from "../shell/NowPlayingRail";
import { LIKED_SONGS, MOCK_TRACKS, getCollectionTracks } from "./mock-data";

// NowPlayingRail (used by the shared-queue-drawer tests below) reads the
// pathname to decide what to show in its Add-music section; a fixed value is
// enough since these tests don't exercise that section.
vi.mock("next/navigation", () => ({
  usePathname: () => "/design-system/screens/home",
}));

function PlayFirst() {
  const { play } = useMockStudio();
  return <button onClick={() => play(MOCK_TRACKS[0])}>seed</button>;
}

/**
 * A matchMedia double that actually parses the `min-width` out of the query,
 * unlike a single fixed `matches` — GlobalPlayer's useIsDesktop() (768px)
 * and PlaybackBar's own useIsWide() (1440px) issue two different queries
 * against the same global, so a uniform stub can't tell "desktop but not
 * wide" from "wide" and gives a false pass/fail depending which one it hits.
 */
function stubViewportWidth(width: number) {
  const matchMedia = vi.fn((query: string) => {
    const minWidth = Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? 0);
    return {
      matches: width >= minWidth,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  });
  vi.stubGlobal("matchMedia", matchMedia);
}

describe("GlobalPlayer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders nothing until a track plays, then expands and collapses", () => {
    render(
      <MockStudioProvider>
        <PlayFirst />
        <GlobalPlayer />
      </MockStudioProvider>
    );

    expect(screen.queryByLabelText("Expand player")).toBeNull();

    fireEvent.click(screen.getByText("seed"));
    act(() => vi.advanceTimersByTime(650));

    fireEvent.click(screen.getByLabelText("Expand player"));
    expect(screen.getByRole("dialog", { name: "Now playing" })).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Collapse player"));
    expect(screen.queryByRole("dialog", { name: "Now playing" })).toBeNull();
    expect(screen.getByLabelText("Expand player")).toBeTruthy();
  });

  it("renders MiniPlayerBar below 768px and PlaybackBar at 768px and up", () => {
    // Transport's compact prop is the real behavioural fork between the two
    // bars (MiniPlayerBar passes compact, PlaybackBar does not), so presence
    // of the Loop control — dropped under compact — is what distinguishes
    // them, not just which "Expand player" happens to be on screen (both
    // bars expose that label).
    stubViewportWidth(500); // below 768
    const { unmount } = render(
      <MockStudioProvider>
        <PlayFirst />
        <GlobalPlayer />
      </MockStudioProvider>
    );
    fireEvent.click(screen.getByText("seed"));
    act(() => vi.advanceTimersByTime(650));
    expect(screen.getByLabelText("Expand player")).toBeTruthy();
    expect(screen.queryByLabelText("Loop")).toBeNull();
    unmount();

    stubViewportWidth(1000); // 768+, but below the 1440 "wide" threshold
    render(
      <MockStudioProvider>
        <PlayFirst />
        <GlobalPlayer />
      </MockStudioProvider>
    );
    fireEvent.click(screen.getByText("seed"));
    act(() => vi.advanceTimersByTime(650));
    expect(screen.getByLabelText("Expand player")).toBeTruthy();
    expect(screen.getByLabelText("Loop")).toBeTruthy();
  });

  describe("shared queue drawer (Part A)", () => {
    it("mounts exactly one QueueDrawer, driven by both the rail's and the docked player's queue controls", () => {
      stubViewportWidth(500);
      const source = LIKED_SONGS;
      const seedTrack = getCollectionTracks(source)[0];

      function SeedFromCollection() {
        const { play } = useMockStudio();
        return (
          <button onClick={() => play(seedTrack, source)}>seed</button>
        );
      }

      render(
        <MockStudioProvider>
          <SeedFromCollection />
          <NowPlayingRail />
          <GlobalPlayer />
        </MockStudioProvider>
      );

      fireEvent.click(screen.getByText("seed"));
      act(() => vi.advanceTimersByTime(650));

      // Closed: nothing to see yet from either control.
      expect(screen.queryAllByLabelText("Close queue")).toHaveLength(0);

      // NowPlayingRail's "Open queue" control opens the one shared drawer.
      fireEvent.click(screen.getByLabelText("Open queue"));
      expect(screen.queryAllByLabelText("Close queue")).toHaveLength(1);

      fireEvent.click(screen.getByLabelText("Close queue"));
      expect(screen.queryAllByLabelText("Close queue")).toHaveLength(0);

      // The docked DevicePlayer's own transport "Queue" control (a distinct
      // aria-label from the rail's "Open queue") opens the very same drawer
      // rather than a second instance of its own.
      fireEvent.click(screen.getByLabelText("Queue"));
      expect(screen.queryAllByLabelText("Close queue")).toHaveLength(1);
    });
  });
});
