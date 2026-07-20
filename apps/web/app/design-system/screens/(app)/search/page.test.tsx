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

/** Types a query and lets MockStudioProvider's 550ms debounce settle. */
function searchFor(query: string) {
  fireEvent.change(screen.getByLabelText("Search"), {
    target: { value: query },
  });
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

    fireEvent.click(screen.getByRole("link", { name: "Open Late Study Lo-Fi" }));

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
});
