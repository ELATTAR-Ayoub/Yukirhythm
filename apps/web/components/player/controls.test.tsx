import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Controls from "@/components/player/controls";
import { usePlayerStore } from "@/store/player";
import { makeAuthValue } from "@/test/mocks";
import type { Audio } from "@/constants/interfaces";

// controls.tsx renders <ListDrawer /> internally, which calls useAuth(). That
// chain transitively imports config/firebase.ts, which calls initializeApp()
// at module scope and throws in tests. Mocking AuthContext short-circuits
// that without having to stub out ListDrawer itself, so this smoke test
// still exercises the real ListDrawer mount (its own smoke test lives in
// ListDrawer.test.tsx).
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => makeAuthValue(),
}));

vi.mock("react-player", () => ({
  default: () => <div data-testid="react-player" />,
}));

// The real Radix Slider divides by (max - min) to position its thumb. Controls
// always mounts with local `duration` state at 0 (it's only set once
// ReactPlayer's onDuration fires, which never happens here since ReactPlayer
// is mocked out above), so max={duration} is 0 and the position math produces
// NaN. Real browsers silently ignore the resulting invalid CSS value, but
// jsdom's stylesheet parser throws on it — a jsdom-only quirk, not an app
// bug. Mock the Slider out rather than fighting the environment for a value
// this smoke test doesn't need to assert on.
vi.mock("@/components/ui/slider", () => ({
  Slider: () => <div data-testid="mock-slider" />,
}));

// ListDrawer also renders <Toaster /> from components/ui/sonner.tsx, which
// imports { Toaster } from "sonner" — stub it too or the mock is incomplete.
vi.mock("sonner", () => ({ toast: vi.fn(), Toaster: () => null }));

const makeAudio = (id: string): Audio => ({
  ID: id,
  URL: `https://youtu.be/${id}`,
  title: `t-${id}`,
  thumbnails: [],
  owner: { name: "o", ID: "o", canonicalURL: "" },
});

describe("player controls", () => {
  beforeEach(() => {
    usePlayerStore.setState({
      audioState: [],
      currentAudio: 0,
      audioLoading: false,
      audioPlaying: false,
      audioVolume: 0.4,
    });
  });

  it("renders without crashing when the queue is empty", () => {
    render(<Controls videoId="" />);
    // No video → the player stays unmounted (avoids a bogus empty-src
    // <video>); the transport chrome still renders.
    expect(screen.queryByTestId("react-player")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });

  it("renders transport controls with a queued track", () => {
    usePlayerStore.setState({ audioState: [makeAudio("a")] });
    render(<Controls videoId="a" />);
    expect(screen.getByTestId("react-player")).toBeInTheDocument();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });

  it("shows a loading spinner icon on the play button when audio is buffering", () => {
    usePlayerStore.setState({
      audioState: [makeAudio("a")],
      audioLoading: true,
    });
    const { container } = render(<Controls videoId="a" />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});
