import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MockStudioProvider, { useMockStudio } from "./MockStudioProvider";
import {
  MOCK_COLLECTIONS,
  MOCK_TRACKS,
  getCollectionTracks,
} from "./mock-data";
import Transport from "./Transport";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));

function QueueControls() {
  const { play, seek } = useMockStudio();
  const source = MOCK_COLLECTIONS[0];
  const tracks = getCollectionTracks(source);
  const solo = { ...source, id: "solo", trackIds: [MOCK_TRACKS[0].id] };

  return (
    <>
      <button type="button" onClick={() => play(MOCK_TRACKS[0], solo)}>
        play solo
      </button>
      <button type="button" onClick={() => play(tracks.at(-1)!, source)}>
        play tail
      </button>
      <button type="button" onClick={() => seek(5)}>
        seek five
      </button>
    </>
  );
}

describe("Transport queue availability", () => {
  it("disables unavailable directions but keeps looping Next enabled at a tail", () => {
    render(
      <MockStudioProvider>
        <QueueControls />
        <Transport compact />
      </MockStudioProvider>
    );

    fireEvent.click(screen.getByText("play solo"));
    expect((screen.getByLabelText("Previous") as HTMLButtonElement).disabled).toBe(
      true
    );
    expect((screen.getByLabelText("Next") as HTMLButtonElement).disabled).toBe(
      true
    );

    fireEvent.click(screen.getByText("seek five"));
    expect((screen.getByLabelText("Previous") as HTMLButtonElement).disabled).toBe(
      false
    );

    fireEvent.click(screen.getByText("play tail"));
    expect((screen.getByLabelText("Previous") as HTMLButtonElement).disabled).toBe(
      false
    );
    expect((screen.getByLabelText("Next") as HTMLButtonElement).disabled).toBe(
      false
    );
  });
});
