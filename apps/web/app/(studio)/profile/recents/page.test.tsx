import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const play = vi.fn();

vi.mock("@/components/studio/screens/MockStudioProvider", () => ({
  useMockStudio: () => ({
    user: MOCK_USER,
    collections: [LIKED_SONGS, ...MOCK_COLLECTIONS],
    play,
    nowPlaying: null,
    isPlaying: false,
    // History now comes from the provider (phase 8) rather than the fixture
    // module, so the stub has to supply it.
    recents: MOCK_HISTORY,
  }),
}));

import {
  LIKED_SONGS,
  MOCK_COLLECTIONS,
  MOCK_HISTORY,
  MOCK_USER,
  getTrack,
} from "@/components/studio/screens/mock-data";
import RecentsScreen from "./page";

describe("Recents", () => {
  beforeEach(() => play.mockReset());

  it("plays from the collection the row says it came from", () => {
    const entry = MOCK_HISTORY[0];
    const track = getTrack(entry.trackId)!;
    const source = [LIKED_SONGS, ...MOCK_COLLECTIONS].find(
      (c) => c.id === entry.collectionId
    );

    render(<RecentsScreen />);
    fireEvent.click(screen.getAllByLabelText(`Play ${track.title}`)[0]);

    // Without the source the queue silently falls back to the whole library,
    // discarding the provenance the row just displayed.
    expect(play).toHaveBeenCalledWith(track, source);
  });

  it("renders no nested play button inside the row button", () => {
    render(<RecentsScreen />);
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
  });
});
