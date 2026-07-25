import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

import MockStudioProvider, {
  useMockStudio,
} from "@/components/studio/screens/MockStudioProvider";
import { MOCK_TRACKS } from "@/components/studio/screens/mock-data";
import { QUEUE } from "./routes";
import PlaybackBar from "./PlaybackBar";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

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
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mql)
  );
}

describe("PlaybackBar", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    push.mockClear();
  });

  /**
   * The bar is permanent chrome now — it used to return null with no track,
   * which is what left the app with no bottom bar on a cold session. These
   * cover the idle presentation instead: present, but inert.
   */
  describe("with no track playing", () => {
    it("still renders the bar, with an honest idle label and no metadata", () => {
      stubMatchMedia(false);
      render(
        <MockStudioProvider>
          <PlaybackBar onExpand={() => {}} />
        </MockStudioProvider>
      );

      expect(screen.getByText("Nothing playing")).toBeTruthy();
      // No track's title leaks into the idle bar.
      expect(screen.queryByText(MOCK_TRACKS[0].title)).toBeNull();
    });

    it("disables every playback control and the seek", () => {
      stubMatchMedia(false);
      render(
        <MockStudioProvider>
          <PlaybackBar onExpand={() => {}} />
        </MockStudioProvider>
      );

      for (const name of ["Previous", "Play", "Next", "Loop"]) {
        expect(screen.getByLabelText(name).hasAttribute("disabled")).toBe(true);
      }
      // Radix marks a disabled Slider on the root, not via the disabled attr.
      expect(screen.getByLabelText("Seek").getAttribute("aria-disabled")).toBe(
        "true"
      );
    });

    it("shows no seek position — not a real 0:00 in a track that isn't there", () => {
      stubMatchMedia(false);
      render(
        <MockStudioProvider>
          <PlaybackBar onExpand={() => {}} />
        </MockStudioProvider>
      );

      expect(screen.getAllByText("--:--")).toHaveLength(2);
      expect(screen.queryByText("0:00")).toBeNull();
    });

    it("offers no Expand player control — there is no player to expand into", () => {
      stubMatchMedia(false); // below 1440, where a playing bar DOES offer one
      render(
        <MockStudioProvider>
          <PlaybackBar onExpand={() => {}} />
        </MockStudioProvider>
      );

      // Anchor on the bar actually being rendered first, or this assertion
      // would also pass if the whole component returned null — which is the
      // exact regression the idle presentation exists to prevent.
      expect(screen.getByText("Nothing playing")).toBeTruthy();
      expect(screen.queryByLabelText("Expand player")).toBeNull();
    });
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
    // The bar now carries a volume slider too, and thumbs have no accessible
    // name of their own, so reach this one through its labelled root rather
    // than by role alone.
    const slider = within(
      screen.getByLabelText("Seek") as HTMLElement
    ).getByRole("slider");
    expect(slider.getAttribute("aria-valuenow")).toBe("10");

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(slider.getAttribute("aria-valuenow")).toBe("11");
  });

  it("keeps the Loop control in the bottom bar", () => {
    stubMatchMedia(false);
    render(
      <MockStudioProvider>
        <PlaybackBar onExpand={() => {}} />
      </MockStudioProvider>
    );
    expect(screen.getByLabelText("Loop")).toBeTruthy();
  });

  it("navigates to the routed queue page from the transport's queue control", () => {
    stubMatchMedia(false);
    render(
      <MockStudioProvider>
        <PlayFirst />
        <PlaybackBar onExpand={() => {}} />
      </MockStudioProvider>
    );
    fireEvent.click(screen.getByText("seed"));
    act(() => vi.advanceTimersByTime(650));

    fireEvent.click(screen.getByLabelText("Queue"));

    expect(push).toHaveBeenCalledWith(QUEUE);
  });
});
