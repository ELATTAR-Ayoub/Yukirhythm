import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import { LIKED_SONGS } from "@/components/studio/screens/mock-data";
import { playlistHref } from "@/components/studio/shell/routes";
import AddMusicScreen from "./page";

const nav = vi.hoisted(() => ({ id: "liked" }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: nav.id }),
}));

describe("AddMusicScreen", () => {
  beforeEach(() => {
    nav.id = "liked";
  });

  it("renders the add-music panel for a known playlist", () => {
    render(
      <MockStudioProvider>
        <AddMusicScreen />
      </MockStudioProvider>
    );

    expect(screen.getByText(`to ${LIKED_SONGS.title}`)).toBeTruthy();
    expect(screen.getByLabelText("Search tracks to add")).toBeTruthy();
  });

  it("has a way back to the playlist it's adding to", () => {
    render(
      <MockStudioProvider>
        <AddMusicScreen />
      </MockStudioProvider>
    );

    const back = screen.getByLabelText("Back") as HTMLAnchorElement;
    expect(back.getAttribute("href")).toBe(playlistHref(LIKED_SONGS.id));
  });

  it("falls back to an empty state for an unknown id", () => {
    nav.id = "does-not-exist";
    render(
      <MockStudioProvider>
        <AddMusicScreen />
      </MockStudioProvider>
    );

    expect(screen.getByText(/Collection not found/i)).toBeTruthy();
    expect(screen.queryByLabelText("Search tracks to add")).toBeNull();
  });
});
