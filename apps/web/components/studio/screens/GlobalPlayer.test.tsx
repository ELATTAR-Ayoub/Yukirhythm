import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider, { useMockStudio } from "./MockStudioProvider";
import GlobalPlayer from "./GlobalPlayer";
import { MOCK_TRACKS } from "./mock-data";

// The queue control on every player surface (NowPlayingRail, DevicePlayer,
// PlaybackBar) now calls useRouter() unconditionally to route to the queue
// page; none of these tests click that control, so a no-op push is enough.
vi.mock("next/navigation", () => ({
  usePathname: () => "/design-system/screens/home",
  useRouter: () => ({ push: () => {} }),
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
});
