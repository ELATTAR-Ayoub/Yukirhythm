import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider, { useMockStudio } from "./MockStudioProvider";
import GlobalPlayer from "./GlobalPlayer";
import { MOCK_TRACKS } from "./mock-data";

function PlayFirst() {
  const { play } = useMockStudio();
  return <button onClick={() => play(MOCK_TRACKS[0])}>seed</button>;
}

describe("GlobalPlayer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders nothing until a track plays, then expands and collapses", () => {
    render(
      <MockStudioProvider>
        <PlayFirst />
        <GlobalPlayer />
      </MockStudioProvider>
    );

    expect(screen.queryByLabelText("Expand player")).toBeNull();

    fireEvent.click(screen.getByText("seed"));
    act(() => vi.advanceTimersByTime(650));

    fireEvent.click(screen.getByLabelText("Expand player"));
    expect(screen.getByRole("dialog", { name: "Now playing" })).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Collapse player"));
    expect(screen.queryByRole("dialog", { name: "Now playing" })).toBeNull();
    expect(screen.getByLabelText("Expand player")).toBeTruthy();
  });
});
