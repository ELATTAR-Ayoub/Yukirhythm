import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import MockStudioProvider, {
  useMockStudio,
} from "@/components/studio/screens/MockStudioProvider";
import PlayerExtras from "./PlayerExtras";

/** Surfaces the provider's volume so tests assert state, not just markup. */
function VolumeProbe() {
  const { volume, muted } = useMockStudio();
  return <span data-testid="vol">{`${volume}|${muted}`}</span>;
}

function renderExtras() {
  return render(
    <MockStudioProvider>
      <VolumeProbe />
      <PlayerExtras />
    </MockStudioProvider>
  );
}

const vol = () => screen.getByTestId("vol").textContent;

/** jsdom implements neither of these, so fullscreen is opt-in per test. */
function stubFullscreen({ enabled = true } = {}) {
  const request = vi.fn(() => Promise.resolve());
  const exit = vi.fn(() => Promise.resolve());
  Object.defineProperty(document, "fullscreenEnabled", {
    value: enabled,
    configurable: true,
  });
  Object.defineProperty(document, "fullscreenElement", {
    value: null,
    writable: true,
    configurable: true,
  });
  document.documentElement.requestFullscreen = request;
  document.exitFullscreen = exit;
  return { request, exit };
}

describe("PlayerExtras", () => {
  afterEach(() => {
    // @ts-expect-error — removing the stubs jsdom never had
    delete document.documentElement.requestFullscreen;
    // @ts-expect-error — same
    delete document.exitFullscreen;
    vi.restoreAllMocks();
  });

  it("drives the provider's volume from the slider", () => {
    renderExtras();
    expect(vol()).toBe("1|false");

    const slider = within(
      screen.getByLabelText("Volume") as HTMLElement
    ).getByRole("slider");
    fireEvent.keyDown(slider, { key: "ArrowLeft" });

    expect(vol()).toBe("0.99|false");
  });

  it("mutes to zero and restores the level it came from", () => {
    renderExtras();
    const slider = within(
      screen.getByLabelText("Volume") as HTMLElement
    ).getByRole("slider");
    // step down to a distinctive level first
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(vol()).toBe("0.98|false");

    fireEvent.click(screen.getByLabelText("Mute"));
    expect(vol()).toBe("0|true");

    // Unmute returns to 0.98, NOT to full — the user's choice survives.
    fireEvent.click(screen.getByLabelText("Unmute"));
    expect(vol()).toBe("0.98|false");
  });

  it("stays usable with nothing playing", () => {
    // Volume is an output setting, not a property of the current track.
    renderExtras();
    expect(screen.getByLabelText("Volume")).toBeTruthy();
    expect(screen.getByLabelText("Mute")).toBeTruthy();
  });

  it("offers no fullscreen control where the API is unavailable", () => {
    // jsdom: no requestFullscreen at all.
    renderExtras();
    expect(screen.queryByLabelText("Full screen")).toBeNull();
    // Guard against a vacuous pass: the rest of the block must be present.
    expect(screen.getByLabelText("Volume")).toBeTruthy();
  });

  it("requests fullscreen when supported", () => {
    const { request } = stubFullscreen();
    renderExtras();

    fireEvent.click(screen.getByLabelText("Full screen"));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("hides the control when the API exists but is disallowed", () => {
    stubFullscreen({ enabled: false });
    renderExtras();
    expect(screen.queryByLabelText("Full screen")).toBeNull();
  });

  it("follows fullscreen changes it did not initiate", () => {
    const { exit } = stubFullscreen();
    renderExtras();
    expect(screen.getByLabelText("Full screen")).toBeTruthy();

    // Escape/F11 fire the event without any click of ours.
    Object.defineProperty(document, "fullscreenElement", {
      value: document.documentElement,
      writable: true,
      configurable: true,
    });
    fireEvent(document, new Event("fullscreenchange"));

    expect(screen.getByLabelText("Exit full screen")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Exit full screen"));
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
