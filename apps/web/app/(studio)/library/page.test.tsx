import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import { CREATE, playlistHref } from "@/components/studio/shell/routes";
import { LIKED_SONGS } from "@/components/studio/screens/mock-data";
import LibraryScreen from "./page";

const { push, replace } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

function renderLibrary() {
  return render(
    <MockStudioProvider>
      <LibraryScreen />
    </MockStudioProvider>
  );
}

describe("LibraryScreen", () => {
  beforeEach(() => {
    push.mockClear();
    replace.mockClear();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/library");
  });

  it("shows Liked Songs first and filters by type chip", () => {
    renderLibrary();

    const rows = screen.getAllByRole("link", { name: /open collection/i });
    expect(rows[0].textContent).toContain("Liked Songs");

    fireEvent.click(screen.getByRole("button", { name: "Podcasts" }));
    expect(screen.getByText("Pixel Podcasts")).toBeTruthy();
    expect(screen.queryByText("Cobalt After Hours")).toBeNull();
  });

  it("links each collection row to its playlist route instead of opening a drawer", () => {
    renderLibrary();

    const liked = screen.getByRole("link", {
      name: /open collection liked songs/i,
    });
    expect(liked.getAttribute("href")).toBe(playlistHref(LIKED_SONGS.id));

    fireEvent.click(liked);
    // A real <a> handles its own navigation — clicking it must not also
    // reach for the router, and no drawer body should mount over the page.
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByText("Every track you've hearted.")).toBeNull();
  });

  it("navigates to the routed create page from the header button and the dashed tile", () => {
    renderLibrary();

    fireEvent.click(screen.getByLabelText("Create playlist"));
    expect(push).toHaveBeenCalledWith(CREATE);

    push.mockClear();
    fireEvent.click(screen.getByText("Create playlist"));
    expect(push).toHaveBeenCalledWith(CREATE);
  });

  it("opens Spotify import from the tile below create playlist", () => {
    renderLibrary();

    const createTile = screen.getByText("Create playlist");
    const importTile = screen.getByText("Import Spotify playlist");
    expect(
      createTile.compareDocumentPosition(importTile) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    fireEvent.click(importTile);
    expect(
      screen.getByRole("dialog", { name: "Import Spotify playlist" })
    ).toBeVisible();
    expect(screen.getByText(/no Spotify audio is copied/i)).toBeVisible();
  });

  it("opens Spotify import when the desktop rail routes to its query", () => {
    window.history.replaceState({}, "", "/library?spotifyImport=1");

    renderLibrary();

    expect(
      screen.getByRole("dialog", { name: "Import Spotify playlist" })
    ).toBeVisible();
  });
});
