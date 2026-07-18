import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Hero from "@/sections/Hero";
import { usePlayerStore } from "@/store/player";
import { makeAuthValue } from "@/test/mocks";

// Hero renders <Controls>, which renders <ListDrawer>, which calls useAuth().
// That chain transitively imports config/firebase.ts, which calls
// initializeApp() at module scope and throws in tests.
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => makeAuthValue(),
}));

// Hero and ListDrawer both render <Toaster /> from components/ui/sonner.tsx,
// which imports { Toaster } from "sonner" — stub both exports.
vi.mock("sonner", () => ({ toast: vi.fn(), Toaster: () => null }));

// Controls renders ReactPlayer directly.
vi.mock("react-player", () => ({
  default: () => <div data-testid="react-player" />,
}));

// Controls always mounts with local `duration` state at 0, so the real Radix
// Slider's max={duration} is 0 and its thumb-position math produces NaN.
// jsdom's stylesheet parser throws on that invalid CSS value (a jsdom-only
// quirk — see controls.test.tsx), so mock the Slider out here too.
vi.mock("@/components/ui/slider", () => ({
  Slider: () => <div data-testid="mock-slider" />,
}));

describe("Hero", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    usePlayerStore.setState({
      audioState: [],
      currentAudio: 0,
      audioLoading: false,
      audioPlaying: false,
      audioVolume: 0.4,
    });
  });

  it("mounts and renders the search input", () => {
    render(<Hero />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders the search form's submit button and the mocked player", () => {
    render(<Hero />);
    // The search button is icon-only (no accessible name), so assert on the
    // input's enclosing <form> having a submit button, rather than by name.
    const input = screen.getByRole("textbox");
    const form = input.closest("form");
    expect(form).not.toBeNull();
    expect(
      form?.querySelector('button[type="submit"], button:not([type])')
    ).not.toBeNull();
    // Controls (pulled in via Hero) mounts ReactPlayer only once a track is
    // loaded — with an empty queue the player subtree stays unmounted.
    expect(screen.queryByTestId("react-player")).not.toBeInTheDocument();
  });
});
