import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider, { useMockStudio } from "./MockStudioProvider";
import { MOCK_TRACKS } from "./mock-data";
import FeedShelf from "./FeedShelf";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));

function NowPlayingProbe() {
  const { nowPlaying } = useMockStudio();
  return <div data-testid="now-playing">{nowPlaying?.title ?? "none"}</div>;
}

describe("FeedShelf", () => {
  it("keeps the named shelf visible with explicit feedback while loading", () => {
    render(
      <MockStudioProvider>
        <FeedShelf label="For you" title="You might like" tracks={[]} loading />
      </MockStudioProvider>
    );
    expect(
      screen.getByRole("region", { name: "You might like loading" })
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("You might like")).toBeTruthy();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  it("shows a quiet line when the feed settles empty", () => {
    render(
      <MockStudioProvider>
        <FeedShelf
          label="For you"
          title="You might like"
          tracks={[]}
          loading={false}
        />
      </MockStudioProvider>
    );
    expect(screen.getByText("You might like")).toBeTruthy();
    expect(screen.getByText(/nothing here yet/i)).toBeTruthy();
  });

  it("renders playable cards once loaded", () => {
    render(
      <MockStudioProvider>
        <NowPlayingProbe />
        <FeedShelf
          label="Fresh drops"
          title="New releases"
          tracks={MOCK_TRACKS.slice(0, 2)}
          loading={false}
        />
      </MockStudioProvider>
    );
    fireEvent.click(
      screen.getByRole("button", { name: `Play ${MOCK_TRACKS[0].title}` })
    );
    expect(screen.getByTestId("now-playing").textContent).toBe(
      MOCK_TRACKS[0].title
    );
    expect(
      screen.getByRole("button", {
        name: `More for ${MOCK_TRACKS[0].title}`,
      })
    ).toBeInTheDocument();
  });

  it("shows a named refresh control with progress feedback", () => {
    const refresh = vi.fn();
    const { rerender } = render(
      <MockStudioProvider>
        <FeedShelf
          label="Fresh drops"
          title="New releases"
          tracks={MOCK_TRACKS.slice(0, 2)}
          loading={false}
          onRefresh={refresh}
        />
      </MockStudioProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(refresh).toHaveBeenCalledTimes(1);

    rerender(
      <MockStudioProvider>
        <FeedShelf
          label="Fresh drops"
          title="New releases"
          tracks={MOCK_TRACKS.slice(0, 2)}
          loading={false}
          onRefresh={refresh}
          refreshing
        />
      </MockStudioProvider>
    );
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Refresh" })).toHaveAttribute(
      "aria-busy",
      "true"
    );
  });
});
