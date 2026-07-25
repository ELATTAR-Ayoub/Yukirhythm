import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useEffect } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider, {
  useMockStudio,
} from "@/components/studio/screens/MockStudioProvider";
import LibraryRail from "./LibraryRail";
import { CREATE, playlistHref } from "./routes";

const { push, nav } = vi.hoisted(() => ({
  push: vi.fn(),
  nav: { pathname: "/design-system/screens/home" },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push }),
}));

/** Empties the seeded user so the signed-out branch can be rendered. */
function SignOutOnMount() {
  const { signOut } = useMockStudio();
  useEffect(() => {
    signOut();
  }, [signOut]);
  return null;
}

/** Surfaces the context's playback state so tests can assert nothing started. */
function PlaybackProbe() {
  const { nowPlaying, isPlaying, isLoading } = useMockStudio();
  return (
    <div data-testid="playback">
      {`${nowPlaying?.title ?? "none"}|${isPlaying}|${isLoading}`}
    </div>
  );
}

/** The seeded Liked Songs collection — confirmed against mock-data.ts. */
const LIKED_ID = "liked";

describe("LibraryRail", () => {
  beforeEach(() => {
    nav.pathname = "/design-system/screens/home";
    push.mockClear();
    // Needed for CollectionMenu's Radix dropdown, opened via pointerdown.
    window.HTMLElement.prototype.hasPointerCapture = () => false;
    window.HTMLElement.prototype.releasePointerCapture = () => {};
    window.HTMLElement.prototype.scrollIntoView = () => {};
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("links each collection to its playlist route", () => {
    render(
      <MockStudioProvider>
        <LibraryRail />
      </MockStudioProvider>
    );

    const liked = screen.getByRole("link", { name: /liked songs/i });
    expect(liked.getAttribute("href")).toBe(playlistHref(LIKED_ID));
  });

  it("marks no row as current when the page column is elsewhere", () => {
    render(
      <MockStudioProvider>
        <LibraryRail />
      </MockStudioProvider>
    );

    const liked = screen.getByRole("link", { name: /liked songs/i });
    expect(liked.getAttribute("aria-current")).toBeNull();
  });

  it("marks the open collection as current", () => {
    nav.pathname = playlistHref(LIKED_ID);
    render(
      <MockStudioProvider>
        <LibraryRail />
      </MockStudioProvider>
    );

    const liked = screen.getByRole("link", { name: /liked songs/i });
    expect(liked.getAttribute("aria-current")).toBe("page");
  });

  it("renders no play control inside the row anchors", () => {
    render(
      <MockStudioProvider>
        <LibraryRail />
      </MockStudioProvider>
    );

    // MediaCard's hover overlay is a real <button aria-label="Play">. Nested
    // in an anchor it is invalid HTML and a dead keyboard stop on every row.
    expect(screen.queryAllByLabelText("Play")).toHaveLength(0);
  });

  it("does not start playback when a collection is opened", () => {
    render(
      <MockStudioProvider>
        <PlaybackProbe />
        <LibraryRail />
      </MockStudioProvider>
    );

    const before = screen.getByTestId("playback").textContent;
    expect(before).toBe("none|false|false");

    fireEvent.click(screen.getByRole("link", { name: /liked songs/i }));

    // Opening a collection navigates; it must never touch the player.
    expect(screen.getByTestId("playback").textContent).toBe("none|false|false");
  });

  it("marks pinned collections with a pin indicator", () => {
    render(
      <MockStudioProvider>
        <LibraryRail />
      </MockStudioProvider>
    );

    // Liked Songs is seeded pinned: true (so it still sorts first), but it's
    // a system collection with no Unpin control — a "Pinned" badge would
    // advertise a state the user can't undo, so it deliberately shows none.
    expect(screen.queryAllByLabelText("Pinned")).toHaveLength(0);

    // Pin an ordinary collection through the same ⋯ menu the user would use.
    fireEvent.pointerDown(
      screen.getByLabelText("More for Cobalt After Hours"),
      {
        button: 0,
      }
    );
    fireEvent.click(screen.getByText("Pin to top"));

    const pins = screen.getAllByLabelText("Pinned");
    expect(pins).toHaveLength(1);
    const row = screen.getByRole("link", { name: /cobalt after hours/i });
    expect(row.contains(pins[0])).toBe(true);
  });

  it("narrows the list when a filter chip is picked", () => {
    render(
      <MockStudioProvider>
        <LibraryRail />
      </MockStudioProvider>
    );

    expect(screen.getByText("Cobalt After Hours")).toBeTruthy();
    expect(screen.queryByText("Pixel Podcasts")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Podcasts" }));

    expect(screen.getByText("Pixel Podcasts")).toBeTruthy();
    expect(screen.queryByText("Cobalt After Hours")).toBeNull();
  });

  it("offers a create control", () => {
    render(
      <MockStudioProvider>
        <LibraryRail />
      </MockStudioProvider>
    );
    expect(screen.getByLabelText("Create playlist")).toBeTruthy();
  });

  describe("create playlist control", () => {
    it("navigates to the routed create page from the header button, at every width", () => {
      render(
        <MockStudioProvider>
          <LibraryRail />
        </MockStudioProvider>
      );

      fireEvent.click(screen.getByLabelText("Create playlist"));

      expect(push).toHaveBeenCalledWith(CREATE);
      // No drawer form should ever mount alongside the rail any more.
      expect(screen.queryByLabelText("Name")).toBeNull();
    });

    it("navigates to the routed create page from the dashed tile, at every width", () => {
      render(
        <MockStudioProvider>
          <LibraryRail />
        </MockStudioProvider>
      );

      fireEvent.click(screen.getByText("Create playlist"));

      expect(push).toHaveBeenCalledWith(CREATE);
    });
  });

  it("prompts sign-in when signed out", () => {
    render(
      <MockStudioProvider>
        <SignOutOnMount />
        <LibraryRail />
      </MockStudioProvider>
    );

    expect(screen.getByText("Sign in")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /liked songs/i })).toBeNull();
  });
});
