import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import MockStudioProvider, { useMockStudio } from "./MockStudioProvider";
import { MOCK_TRACKS } from "./mock-data";
import Transport from "./Transport";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));

function PlayFirst() {
  const { play } = useMockStudio();
  return (
    <button type="button" onClick={() => play(MOCK_TRACKS[0])}>
      seed
    </button>
  );
}

describe("Transport leading slot", () => {
  it("renders the Loop control by default", () => {
    render(
      <MockStudioProvider>
        <Transport />
      </MockStudioProvider>
    );
    expect(screen.getByLabelText("Loop")).toBeTruthy();
    expect(screen.queryByLabelText(/^Like/)).toBeNull();
  });

  it('renders a Like toggle for the loaded track with leading="like"', () => {
    render(
      <MockStudioProvider>
        <PlayFirst />
        <Transport leading="like" />
      </MockStudioProvider>
    );
    fireEvent.click(screen.getByText("seed"));

    expect(screen.queryByLabelText("Loop")).toBeNull();
    const like = screen.getByLabelText(`Like ${MOCK_TRACKS[0].title}`);
    expect(like.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(like);
    expect(like.getAttribute("aria-pressed")).toBe("true");
  });

  it("holds the slot with an inert Like placeholder when nothing is loaded", () => {
    render(
      <MockStudioProvider>
        <Transport leading="like" />
      </MockStudioProvider>
    );
    const like = screen.getByLabelText("Like") as HTMLButtonElement;
    expect(like.disabled).toBe(true);
  });

  it("keeps the leading slot out of the compact cluster", () => {
    render(
      <MockStudioProvider>
        <Transport compact leading="like" />
      </MockStudioProvider>
    );
    expect(screen.queryByLabelText(/Like/)).toBeNull();
  });

  it("opens Add to playlist instead of unliking when the loaded track is already liked", () => {
    render(
      <MockStudioProvider>
        <PlayFirst />
        <Transport leading="like" />
      </MockStudioProvider>
    );
    fireEvent.click(screen.getByText("seed"));

    const like = screen.getByLabelText(`Like ${MOCK_TRACKS[0].title}`);
    // Like it first so the second click hits the already-liked branch.
    fireEvent.click(like);
    expect(like.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(like);

    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("Add to playlist")).toBeTruthy();
    expect(like.getAttribute("aria-pressed")).toBe("true");
  });
});
