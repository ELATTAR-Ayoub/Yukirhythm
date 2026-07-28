import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider from "./MockStudioProvider";
import SearchTrackResults from "./SearchTrackResults";
import type { MockTrack } from "./mock-data";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));

const tracks: MockTrack[] = Array.from({ length: 45 }, (_, index) => ({
  id: `result-${index + 1}`,
  title: `Result ${index + 1}`,
  artist: "Search Artist",
  texture: "tx-k2-vinyl",
  durationSec: 180,
}));

describe("SearchTrackResults", () => {
  it("reveals search results in pages of twenty", () => {
    render(
      <MockStudioProvider>
        <SearchTrackResults tracks={tracks} />
      </MockStudioProvider>
    );

    expect(
      screen.getAllByRole("button", { name: /^Play Result/ })
    ).toHaveLength(20);

    fireEvent.click(screen.getByRole("button", { name: "See more" }));
    expect(
      screen.getAllByRole("button", { name: /^Play Result/ })
    ).toHaveLength(40);

    fireEvent.click(screen.getByRole("button", { name: "See more" }));
    expect(
      screen.getAllByRole("button", { name: /^Play Result/ })
    ).toHaveLength(45);
    expect(screen.queryByRole("button", { name: "See more" })).toBeNull();
  });

  it("uses the normal like and track menus for every searched song", async () => {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
    window.HTMLElement.prototype.releasePointerCapture = () => {};
    window.HTMLElement.prototype.scrollIntoView = () => {};
    render(
      <MockStudioProvider>
        <SearchTrackResults tracks={tracks.slice(0, 2)} />
      </MockStudioProvider>
    );

    expect(
      screen.getByRole("button", { name: "Like Result 1" })
    ).toBeInTheDocument();
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "More for Result 1" }),
      { button: 0 }
    );

    expect(await screen.findByRole("menuitem", { name: "Like" })).toBeTruthy();
    expect(
      screen.getByRole("menuitem", { name: "Add to playlist" })
    ).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Share" })).toBeTruthy();
  });
});
