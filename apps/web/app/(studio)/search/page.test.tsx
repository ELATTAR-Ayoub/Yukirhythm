import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

import MockStudioProvider, {
  useMockStudio,
} from "@/components/studio/screens/MockStudioProvider";
import { playlistHref } from "@/components/studio/shell/routes";
import SearchScreen from "./page";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/design-system/screens/search",
}));

/** Surfaces nowPlaying so tests can prove a click did (or didn't) start playback. */
function NowPlayingProbe() {
  const { nowPlaying } = useMockStudio();
  return <div data-testid="now-playing">{nowPlaying?.title ?? "none"}</div>;
}

/** Types a query, submits it, and lets the mock's 550ms latency settle. */
function searchFor(query: string) {
  fireEvent.change(screen.getByLabelText("Search"), {
    target: { value: query },
  });
  fireEvent.submit(screen.getByRole("search", { name: "Track search" }));
  act(() => vi.advanceTimersByTime(550));
}

function renderSearch() {
  return render(
    <MockStudioProvider>
      <NowPlayingProbe />
      <SearchScreen />
    </MockStudioProvider>
  );
}

describe("SearchScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    push.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("links each collection hit to its playlist route", () => {
    renderSearch();
    // "lofi" is a tag on Late Study Lo-Fi (c1).
    searchFor("lofi");

    const hit = screen.getByRole("link", { name: "Open Late Study Lo-Fi" });
    expect(hit.getAttribute("href")).toBe(playlistHref("c1"));
  });

  it("opens a collection hit by navigating, not by opening a drawer", () => {
    renderSearch();
    searchFor("lofi");

    fireEvent.click(
      screen.getByRole("link", { name: "Open Late Study Lo-Fi" })
    );

    // A real <a> handles its own navigation, so the router is not called and
    // no drawer body mounts. PlaylistDrawer rendered CollectionDetail, whose
    // collection play control is the cheapest unambiguous proof it is absent.
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Play collection")).toBeNull();
    expect(screen.getByTestId("now-playing").textContent).toBe("none");
  });

  it("renders no play overlay inside the collection-hit anchors", () => {
    // MediaCard's hover overlay is a real <button aria-label="Play"> — a bare
    // label, NOT "Play {title}". Nested in an anchor it is invalid HTML and a
    // dead keyboard stop, so these opt out via playable={false}. Scoped to the
    // hit anchors so unrelated overlays elsewhere can't mask a regression.
    renderSearch();
    searchFor("lofi");

    const hit = screen.getByRole("link", { name: "Open Late Study Lo-Fi" });
    expect(within(hit).queryAllByLabelText("Play")).toHaveLength(0);
  });

  it("still plays a track result when its row is clicked", () => {
    // Track results are a play trigger, not a drawer flow — unchanged.
    renderSearch();
    searchFor("Cobalt Dreams");

    fireEvent.click(screen.getByRole("button", { name: "Play Cobalt Dreams" }));
    act(() => vi.advanceTimersByTime(650));

    expect(screen.getByTestId("now-playing").textContent).toBe("Cobalt Dreams");
  });

  it("does not search while typing — only on submit", () => {
    renderSearch();
    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "lofi" },
    });
    act(() => vi.advanceTimersByTime(1000));

    // Still idle: the shelves are on screen and no results section exists.
    expect(screen.getByText("You might like")).toBeTruthy();
    expect(screen.queryByText("Tracks")).toBeNull();
  });

  it("returns to the idle shelves when the field is cleared", () => {
    renderSearch();
    searchFor("lofi");
    expect(screen.queryByText("You might like")).toBeNull();

    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "" },
    });
    expect(screen.getByText("You might like")).toBeTruthy();
  });

  it("orders the idle sections: You might like, New releases, Browse by mood", () => {
    renderSearch();
    const titles = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    const start = titles.indexOf("You might like");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(titles[start + 1]).toBe("New releases");
    expect(titles[start + 2]).toBe("Browse by mood");
  });

  it("skeletons both shelves while the feeds load", () => {
    render(
      <MockStudioProvider feeds={{ loading: true }}>
        <SearchScreen />
      </MockStudioProvider>
    );
    expect(document.querySelectorAll("section[aria-busy]").length).toBe(2);
    // Browse by mood is not feed-backed and stays put.
    expect(screen.getByText("Browse by mood")).toBeTruthy();
  });

  it("shows a quiet line for a feed that settles empty", () => {
    render(
      <MockStudioProvider feeds={{ youMightLike: [] }}>
        <SearchScreen />
      </MockStudioProvider>
    );
    expect(screen.getByText(/nothing here yet/i)).toBeTruthy();
  });

  it("searches immediately when a mood tile is clicked", () => {
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "Lo-fi" }));
    act(() => vi.advanceTimersByTime(550));
    expect(screen.queryByText("You might like")).toBeNull();
  });
});
