import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import { CREATE, playlistHref } from "@/components/studio/shell/routes";
import { LIKED_SONGS } from "@/components/studio/screens/mock-data";
import LibraryScreen from "./page";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function renderLibrary() {
  return render(
    <MockStudioProvider>
      <LibraryScreen />
    </MockStudioProvider>
  );
}

describe("LibraryScreen", () => {
  beforeEach(() => push.mockClear());

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
});
