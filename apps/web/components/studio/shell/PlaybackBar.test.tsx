import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider, {
  useMockStudio,
} from "@/components/studio/screens/MockStudioProvider";
import { MOCK_TRACKS } from "@/components/studio/screens/mock-data";
import PlaybackBar from "./PlaybackBar";

function PlayFirst() {
  const { play } = useMockStudio();
  return <button onClick={() => play(MOCK_TRACKS[0])}>seed</button>;
}

/**
 * Minimal matchMedia double mirroring useBreakpoint.test.ts. PlaybackBar
 * only ever queries one width (useIsWide, min-width: 1440px), so a single
 * fixed `matches` value is enough — no listener bookkeeping needed here.
 */
function stubMatchMedia(matches: boolean) {
  const mql = {
    matches,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  vi.stubGlobal("matchMedia", vi.fn(() => mql));
}

describe("PlaybackBar", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders nothing when no track is playing", () => {
    stubMatchMedia(false);
    const { container } = render(
      <MockStudioProvider>
        <PlaybackBar onExpand={() => {}} />
      </MockStudioProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("below 1440px shows an Expand player control that invokes onExpand", () => {
    stubMatchMedia(false);
    const onExpand = vi.fn();
    render(
      <MockStudioProvider>
        <PlayFirst />
        <PlaybackBar onExpand={onExpand} />
      </MockStudioProvider>
    );
    fireEvent.click(screen.getByText("seed"));
    act(() => vi.advanceTimersByTime(650));

    fireEvent.click(screen.getByLabelText("Expand player"));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it("at 1440px+ has no Expand player control", () => {
    stubMatchMedia(true);
    render(
      <MockStudioProvider>
        <PlayFirst />
        <PlaybackBar onExpand={() => {}} />
      </MockStudioProvider>
    );
    fireEvent.click(screen.getByText("seed"));
    act(() => vi.advanceTimersByTime(650));

    expect(screen.queryByLabelText("Expand player")).toBeNull();
    // The track identity must still be on screen even without the control.
    expect(screen.getByText(MOCK_TRACKS[0].title)).toBeTruthy();
  });

  it("seek slider reflects and drives progressSec", () => {
    stubMatchMedia(false);
    render(
      <MockStudioProvider>
        <PlayFirst />
        <PlaybackBar onExpand={() => {}} />
      </MockStudioProvider>
    );
    fireEvent.click(screen.getByText("seed"));
    act(() => vi.advanceTimersByTime(650));
    act(() => vi.advanceTimersByTime(10_000)); // 1s ticker -> progressSec = 10

    // The accessible aria-label lands on the Radix slider Root, but
    // aria-valuenow lives on its Thumb (role="slider") — target that.
    const slider = screen.getByRole("slider");
    expect(slider.getAttribute("aria-valuenow")).toBe("10");

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(slider.getAttribute("aria-valuenow")).toBe("11");
  });

  it("opens the shared queue drawer from the transport's queue control", () => {
    stubMatchMedia(false);
    function QueueOpenProbe() {
      const { queueOpen } = useMockStudio();
      return <div data-testid="queue-open">{String(queueOpen)}</div>;
    }
    render(
      <MockStudioProvider>
        <PlayFirst />
        <QueueOpenProbe />
        <PlaybackBar onExpand={() => {}} />
      </MockStudioProvider>
    );
    fireEvent.click(screen.getByText("seed"));
    act(() => vi.advanceTimersByTime(650));

    expect(screen.getByTestId("queue-open").textContent).toBe("false");
    fireEvent.click(screen.getByLabelText("Queue"));
    expect(screen.getByTestId("queue-open").textContent).toBe("true");
  });
});
