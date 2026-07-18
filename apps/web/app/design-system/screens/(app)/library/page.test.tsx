import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import LibraryScreen from "./page";

function renderLibrary() {
  return render(
    <MockStudioProvider>
      <LibraryScreen />
    </MockStudioProvider>
  );
}

describe("LibraryScreen", () => {
  it("shows Liked Songs first and filters by type chip", () => {
    renderLibrary();

    const rows = screen.getAllByRole("button", { name: /open collection/i });
    expect(rows[0].textContent).toContain("Liked Songs");

    fireEvent.click(screen.getByRole("button", { name: "Podcasts" }));
    expect(screen.getByText("Pixel Podcasts")).toBeTruthy();
    expect(screen.queryByText("Cobalt After Hours")).toBeNull();
  });

  it("opens the playlist drawer when a collection is tapped", () => {
    renderLibrary();

    fireEvent.click(
      screen.getByRole("button", { name: /open collection liked songs/i })
    );
    expect(screen.getByText("Every track you've hearted.")).toBeTruthy();
  });
});
