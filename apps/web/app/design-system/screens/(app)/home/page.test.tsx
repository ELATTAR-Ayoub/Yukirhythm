import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

import MockStudioProvider, {
  useMockStudio,
} from "@/components/studio/screens/MockStudioProvider";
import { playlistHref } from "@/components/studio/shell/routes";
import HomeScreen from "./page";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/design-system/screens/home",
}));

/** Surfaces nowPlaying so tests can prove a click did (or didn't) start playback. */
function NowPlayingProbe() {
  const { nowPlaying } = useMockStudio();
  return <div data-testid="now-playing">{nowPlaying?.title ?? "none"}</div>;
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
  beforeEach(() => push.mockClear());

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
    const recents = rows.filter((r) => r.getAttribute("aria-label") !== "Open profile");
    expect(recents.length).toBeGreaterThan(0);
    for (const row of recents) {
      expect(within(row).queryAllByLabelText("Play")).toHaveLength(0);
    }
  });

  it("still plays a new release when its card is clicked", () => {
    // The New releases shelf is a play trigger, not a drawer flow — it must
    // keep working exactly as before this route conversion.
    vi.useFakeTimers();
    try {
      renderHome();

      fireEvent.click(
        screen.getByRole("button", { name: "Play Equalizer Sunday" })
      );
      act(() => vi.advanceTimersByTime(650));

      expect(screen.getByTestId("now-playing").textContent).toBe(
        "Equalizer Sunday"
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
