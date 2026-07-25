import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider, {
  useMockStudio,
} from "@/components/studio/screens/MockStudioProvider";
import {
  LIKED_SONGS,
  getCollectionTracks,
} from "@/components/studio/screens/mock-data";
import { HOME } from "@/components/studio/shell/routes";
import QueueScreen from "./page";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function Seed({
  track,
  source,
}: {
  track: string;
  source: typeof LIKED_SONGS;
}) {
  const { play } = useMockStudio();
  const found = getCollectionTracks(source).find((t) => t.id === track)!;
  return <button onClick={() => play(found, source)}>seed</button>;
}

describe("QueueScreen", () => {
  beforeEach(() => push.mockClear());

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

  it("sends the add button to the queue's own add route, never /playlist/queue/add", () => {
    render(
      <MockStudioProvider>
        <QueueScreen />
      </MockStudioProvider>
    );
    fireEvent.click(screen.getByLabelText("Add music"));
    expect(push).toHaveBeenCalledWith("/queue/add");
    expect(push).not.toHaveBeenCalledWith("/playlist/queue/add");
  });
});
