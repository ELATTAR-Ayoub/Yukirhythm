import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider, { useMockStudio } from "./MockStudioProvider";
import { LIKED_SONGS, LIKED_SONGS_ID } from "./mock-data";
import LikeButton from "./LikeButton";

/** Reads Liked Songs straight from the store, so the tests assert the real
 *  membership rather than the button's own markup. */
function LikedProbe() {
  const { collections } = useMockStudio();
  const liked = collections.find((c) => c.id === LIKED_SONGS_ID);
  return <span data-testid="liked">{liked!.trackIds.join(",")}</span>;
}

const liked = () => screen.getByTestId("liked").textContent!.split(",");

function renderFor(trackId: string, title = "Some Track") {
  return render(
    <MockStudioProvider>
      <LikedProbe />
      <LikeButton trackId={trackId} trackTitle={title} />
    </MockStudioProvider>
  );
}

describe("LikeButton", () => {
  // A seeded member and a non-member, so both directions start from real data.
  const seeded = LIKED_SONGS.trackIds[0];
  const notSeeded = "t99-not-in-liked";

  it("reflects existing membership of Liked Songs", () => {
    renderFor(seeded);
    expect(
      screen.getByRole("button", { name: "Like Some Track" })
    ).toHaveProperty("ariaPressed", "true");
  });

  it("is unpressed for a track that is not liked", () => {
    renderFor(notSeeded);
    expect(
      screen.getByRole("button", { name: "Like Some Track" })
    ).toHaveProperty("ariaPressed", "false");
  });

  it("adds the track to Liked Songs", () => {
    renderFor(notSeeded);
    expect(liked()).not.toContain(notSeeded);

    fireEvent.click(screen.getByRole("button", { name: "Like Some Track" }));

    expect(liked()).toContain(notSeeded);
    expect(
      screen.getByRole("button", { name: "Like Some Track" })
    ).toHaveProperty("ariaPressed", "true");
  });

  it("removes it again on a second click", () => {
    renderFor(seeded);
    expect(liked()).toContain(seeded);

    fireEvent.click(screen.getByRole("button", { name: "Like Some Track" }));
    expect(liked()).not.toContain(seeded);

    fireEvent.click(screen.getByRole("button", { name: "Like Some Track" }));
    expect(liked()).toContain(seeded);
  });

  it("names the track it acts on", () => {
    // A column of identical "Like" buttons is unusable with a screen reader.
    renderFor(notSeeded, "Midnight Snowfall");
    expect(
      screen.getByRole("button", { name: "Like Midnight Snowfall" })
    ).toBeTruthy();
  });
});
