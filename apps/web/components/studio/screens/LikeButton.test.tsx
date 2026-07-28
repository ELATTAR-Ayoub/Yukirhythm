import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider, { useMockStudio } from "./MockStudioProvider";
import { LIKED_SONGS, LIKED_SONGS_ID } from "./mock-data";
import LikeButton from "./LikeButton";

vi.mock("next/navigation", () => ({
  usePathname: () => "/share/track/public-track",
}));

/** Reads Liked Songs straight from the store, so the tests assert the real
 *  membership rather than the button's own markup. */
function LikedProbe() {
  const { collections } = useMockStudio();
  const liked = collections.find((c) => c.id === LIKED_SONGS_ID);
  return <span data-testid="liked">{liked!.trackIds.join(",")}</span>;
}

const liked = () => screen.getByTestId("liked").textContent!.split(",");

function GuestHarness({ trackId }: { trackId: string }) {
  const { signOut } = useMockStudio();
  return (
    <>
      <button onClick={signOut}>Become guest</button>
      <LikeButton trackId={trackId} trackTitle="Public Track" />
    </>
  );
}

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

  it("without onAlreadyLiked, a second click still unlikes (pinning current behavior)", () => {
    render(
      <MockStudioProvider>
        <LikedProbe />
        <LikeButton trackId={seeded} trackTitle="Some Track" />
      </MockStudioProvider>
    );
    expect(liked()).toContain(seeded);

    fireEvent.click(screen.getByRole("button", { name: "Like Some Track" }));

    expect(liked()).not.toContain(seeded);
  });

  it("with onAlreadyLiked, clicking an already-liked track calls it instead of unliking", () => {
    const onAlreadyLiked = vi.fn();
    render(
      <MockStudioProvider>
        <LikedProbe />
        <LikeButton
          trackId={seeded}
          trackTitle="Some Track"
          onAlreadyLiked={onAlreadyLiked}
        />
      </MockStudioProvider>
    );
    expect(liked()).toContain(seeded);

    fireEvent.click(screen.getByRole("button", { name: "Like Some Track" }));

    expect(onAlreadyLiked).toHaveBeenCalledTimes(1);
    expect(liked()).toContain(seeded);
    expect(
      screen.getByRole("button", { name: "Like Some Track" })
    ).toHaveProperty("ariaPressed", "true");
  });

  it("with onAlreadyLiked, a not-yet-liked track still likes normally and skips the callback", () => {
    const onAlreadyLiked = vi.fn();
    render(
      <MockStudioProvider>
        <LikedProbe />
        <LikeButton
          trackId={notSeeded}
          trackTitle="Some Track"
          onAlreadyLiked={onAlreadyLiked}
        />
      </MockStudioProvider>
    );
    expect(liked()).not.toContain(notSeeded);

    fireEvent.click(screen.getByRole("button", { name: "Like Some Track" }));

    expect(onAlreadyLiked).not.toHaveBeenCalled();
    expect(liked()).toContain(notSeeded);
    expect(
      screen.getByRole("button", { name: "Like Some Track" })
    ).toHaveProperty("ariaPressed", "true");
  });

  it("sends a guest through sign-in and back to the shared track", () => {
    render(
      <MockStudioProvider>
        <LikedProbe />
        <GuestHarness trackId={notSeeded} />
      </MockStudioProvider>
    );
    fireEvent.click(screen.getByText("Become guest"));
    fireEvent.click(screen.getByRole("button", { name: "Like Public Track" }));

    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Sign in to continue"
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/auth?returnTo=%2Fshare%2Ftrack%2Fpublic-track"
    );
    expect(liked()).not.toContain(notSeeded);
  });
});
