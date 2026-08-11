import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

import MockStudioProvider, {
  useMockStudio,
} from "@/components/studio/screens/MockStudioProvider";
import { playlistHref } from "@/components/studio/shell/routes";
import HomeScreen from "./page";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
const feedApi = vi.hoisted(() => ({
  newReleases: vi.fn(),
  youMightLike: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/design-system/screens/home",
}));

vi.mock("@/lib/studio/useBackend", () => ({
  useBackend: () => ({ feed: feedApi }),
}));

/** Surfaces nowPlaying so tests can prove a click did (or didn't) start playback. */
function NowPlayingProbe() {
  const { nowPlaying, previewTrack } = useMockStudio();
  return (
    <>
      <div data-testid="now-playing">{nowPlaying?.title ?? "none"}</div>
      <div data-testid="previewing">{previewTrack?.title ?? "none"}</div>
    </>
  );
}

function renderHome() {
  return render(
    <MockStudioProvider>
      <NowPlayingProbe />
      <HomeScreen />
    </MockStudioProvider>
  );
}

describe("HomeScreen", () => {
  beforeEach(() => {
    push.mockClear();
    window.localStorage.clear();
  });

  it("links each recently-played collection to its playlist route", () => {
    renderHome();

    // "Cobalt After Hours" (c2) is the most recent entry in MOCK_HISTORY.
    const row = screen.getByRole("link", { name: "Open Cobalt After Hours" });
    expect(row.getAttribute("href")).toBe(playlistHref("c2"));
  });

  it("opens a recent collection by navigating, not by opening a drawer", () => {
    renderHome();

    const row = screen.getByRole("link", { name: "Open Cobalt After Hours" });
    fireEvent.click(row);

    // A real <a> handles its own navigation, so the router is not called and
    // no drawer body mounts. PlaylistDrawer rendered CollectionDetail, whose
    // collection play control is the cheapest unambiguous proof it is absent.
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Play collection")).toBeNull();
    // Nor may opening a collection start playback.
    expect(screen.getByTestId("now-playing").textContent).toBe("none");
  });

  it("renders no play overlay inside the recent-collection anchors", () => {
    // MediaCard's hover overlay is a real <button aria-label="Play"> — a bare
    // label, NOT "Play {title}". Nested in an anchor it is invalid HTML and a
    // dead keyboard stop on every card, so these opt out via playable={false}.
    // Scoped per-anchor rather than page-wide: the New releases shelf below
    // legitimately keeps its own overlays, so a global count would not isolate
    // this regression.
    renderHome();

    const rows = screen.getAllByRole("link", { name: /^Open / });
    const recents = rows.filter(
      (r) => r.getAttribute("aria-label") !== "Open profile"
    );
    expect(recents.length).toBeGreaterThan(0);
    for (const row of recents) {
      expect(within(row).queryAllByLabelText("Play")).toHaveLength(0);
    }
  });

  it("previews a new release without replacing full playback", () => {
    // The New releases shelf is a play trigger, not a drawer flow — it must
    // keep working exactly as before this route conversion.
    vi.useFakeTimers();
    try {
      renderHome();

      fireEvent.click(
        screen.getByRole("button", {
          name: "Preview Equalizer Sunday for 10 seconds",
        })
      );
      act(() => vi.advanceTimersByTime(650));

      expect(screen.getByTestId("previewing").textContent).toBe(
        "Equalizer Sunday"
      );
      expect(screen.getByTestId("now-playing").textContent).toBe("none");
    } finally {
      vi.useRealTimers();
    }
  });

  it("includes Liked Songs in Jump back in and both independently refreshable feeds", () => {
    renderHome();

    expect(screen.getByRole("link", { name: "Open Liked Songs" })).toBeTruthy();
    expect(screen.getByText("New releases")).toBeTruthy();
    expect(screen.getByText("You might like")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Refresh" })).toHaveLength(2);
  });

  it("keeps all three shelf headers visible while their cards load", () => {
    render(
      <MockStudioProvider
        feeds={{ loading: true, newReleases: [], youMightLike: [] }}
      >
        <HomeScreen />
      </MockStudioProvider>
    );

    expect(
      screen.getByRole("region", { name: "Jump back in loading" })
    ).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("region", { name: "New releases loading" })
    ).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("region", { name: "You might like loading" })
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Recently played")).toBeTruthy();
    expect(screen.getByText("Fresh drops")).toBeTruthy();
    expect(screen.getByText("For you")).toBeTruthy();
  });

  it("renders one completed shelf while the other is still loading", () => {
    render(
      <MockStudioProvider
        feeds={{
          newReleasesLoading: false,
          youMightLikeLoading: true,
          youMightLike: [],
        }}
      >
        <HomeScreen />
      </MockStudioProvider>
    );

    expect(
      screen.getByRole("button", {
        name: "Preview Equalizer Sunday for 10 seconds",
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "You might like loading" })
    ).toHaveAttribute("aria-busy", "true");
    expect(
      screen.queryByRole("region", { name: "New releases loading" })
    ).toBeNull();
  });

  it("renders completed feeds while Jump back in is still loading", () => {
    render(
      <MockStudioProvider
        feeds={{
          jumpBackInLoading: true,
          newReleasesLoading: false,
          youMightLikeLoading: false,
        }}
      >
        <HomeScreen />
      </MockStudioProvider>
    );

    expect(
      screen.getByRole("region", { name: "Jump back in loading" })
    ).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("button", {
        name: "Preview Equalizer Sunday for 10 seconds",
      })
    ).toBeTruthy();
    expect(
      screen.queryByRole("region", { name: "New releases loading" })
    ).toBeNull();
    expect(
      screen.queryByRole("region", { name: "You might like loading" })
    ).toBeNull();
  });
});
