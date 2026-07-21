import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider, {
  useMockStudio,
} from "@/components/studio/screens/MockStudioProvider";
import { LIKED_SONGS, getCollectionTracks } from "@/components/studio/screens/mock-data";
import { HOME } from "@/components/studio/shell/routes";
import QueueScreen from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));

function Seed({ track, source }: { track: string; source: typeof LIKED_SONGS }) {
  const { play } = useMockStudio();
  const found = getCollectionTracks(source).find((t) => t.id === track)!;
  return <button onClick={() => play(found, source)}>seed</button>;
}

describe("QueueScreen", () => {
  it("renders the synthetic Up next queue on a cold session, nothing ever played", () => {
    // Regression guard: an earlier bug made the queue unreachable before
    // anything had played. useQueueCollection()'s fallback must carry this
    // route the same way it carries the rail and the drawer.
    render(
      <MockStudioProvider>
        <QueueScreen />
      </MockStudioProvider>
    );

    expect(screen.getByRole("heading", { name: "Up next" })).toBeTruthy();
    expect(screen.getByLabelText("Play collection")).toBeTruthy();
    // First track of the library queue.
    expect(screen.getByText("Midnight Snowfall")).toBeTruthy();
  });

  it("renders the collection playback actually came from once something plays", () => {
    render(
      <MockStudioProvider>
        <Seed track="t2" source={LIKED_SONGS} />
        <QueueScreen />
      </MockStudioProvider>
    );

    fireEvent.click(screen.getByText("seed"));

    expect(
      screen.getByRole("heading", { name: LIKED_SONGS.title })
    ).toBeTruthy();
  });

  it("has a way back", () => {
    render(
      <MockStudioProvider>
        <QueueScreen />
      </MockStudioProvider>
    );

    const back = screen.getByLabelText("Back") as HTMLAnchorElement;
    expect(back.getAttribute("href")).toBe(HOME);
  });
});
