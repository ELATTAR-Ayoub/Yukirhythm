import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import {
  LIKED_SONGS,
  MOCK_COLLECTIONS,
  MOCK_TRACKS,
} from "@/components/studio/screens/mock-data";
import { addMusicHref } from "@/components/studio/shell/routes";
import CollectionDetail from "./CollectionDetail";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

/**
 * IconSwap renders both icon faces as siblings (class `col-start-1`), the
 * active one at opacity-100 and the other at opacity-0 + aria-hidden. A
 * hard ternary swap would instead render a single icon with neither class,
 * so asserting exactly two faces — one visible, one hidden — is what
 * distinguishes the real component from a lookalike.
 */
function iconSwapFaces(button: HTMLElement): HTMLElement[] {
  return Array.from(button.querySelectorAll<HTMLElement>("span")).filter(
    (el) => el.className.includes("col-start-1")
  );
}

describe("CollectionDetail", () => {
  beforeEach(() => push.mockClear());
  afterEach(() => vi.unstubAllGlobals());

  it("does not nest a play button inside each row's role=button wrapper", () => {
    // TrackRow's hover overlay is a real <button aria-label="Play">. Nested
    // inside the row's own role="button" div it's invalid HTML and a dead,
    // near-unlabelled keyboard stop — opted out via playable={false}.
    render(
      <MockStudioProvider>
        <CollectionDetail collection={LIKED_SONGS} />
      </MockStudioProvider>
    );

    expect(screen.queryAllByLabelText("Play")).toHaveLength(0);
    // The wrapper's own accessible name must still be present for every row.
    expect(
      screen.getByRole("button", { name: "Play Cobalt Dreams" })
    ).toBeTruthy();
  });

  it("shows the collection's own title as the album for every row (desktop variant)", () => {
    render(
      <MockStudioProvider>
        <CollectionDetail collection={LIKED_SONGS} />
      </MockStudioProvider>
    );

    // LIKED_SONGS has 5 tracks; every row's album column should read the
    // collection's title, not a fabricated per-track value (MockTrack has
    // no album field).
    expect(screen.getAllByText("Liked Songs").length).toBeGreaterThanOrEqual(5);
  });

  describe("play/pause icon", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("renders the collection play/pause control through IconSwap, not a hard swap", () => {
      render(
        <MockStudioProvider>
          <CollectionDetail collection={LIKED_SONGS} />
        </MockStudioProvider>
      );

      const button = screen.getByRole("button", { name: "Play collection" });
      const faces = iconSwapFaces(button);
      expect(faces).toHaveLength(2);
      expect(faces[0].className).toContain("opacity-100");
      expect(faces[0].getAttribute("aria-hidden")).toBe("false");
      expect(faces[1].className).toContain("opacity-0");
      expect(faces[1].getAttribute("aria-hidden")).toBe("true");
    });

    it("rolls the strip to the pause face once playback starts on this collection", () => {
      render(
        <MockStudioProvider>
          <CollectionDetail collection={LIKED_SONGS} />
        </MockStudioProvider>
      );

      fireEvent.click(screen.getByRole("button", { name: "Play Cobalt Dreams" }));
      act(() => vi.advanceTimersByTime(650));

      const button = screen.getByRole("button", { name: "Pause collection" });
      const faces = iconSwapFaces(button);
      expect(faces).toHaveLength(2);
      // play (index 0) is now off-center and hidden; pause (index 1) landed.
      expect(faces[0].className).toContain("opacity-0");
      expect(faces[0].getAttribute("aria-hidden")).toBe("true");
      expect(faces[1].className).toContain("opacity-100");
      expect(faces[1].getAttribute("aria-hidden")).toBe("false");
    });
  });

  describe("add music control", () => {
    it("navigates to the routed add-music page, at every width", () => {
      render(
        <MockStudioProvider>
          <CollectionDetail collection={LIKED_SONGS} />
        </MockStudioProvider>
      );

      fireEvent.click(screen.getByLabelText("Add music"));

      expect(push).toHaveBeenCalledWith(addMusicHref(LIKED_SONGS.id));
      // No drawer form should ever mount alongside this control any more.
      expect(screen.queryByLabelText("Search tracks to add")).toBeNull();
    });

    it("routes the add button to addHref when one is given", () => {
      // The queue passes its own destination; without this the button builds
      // /playlist/queue/add from the synthetic id and dead-ends.
      render(
        <MockStudioProvider>
          <CollectionDetail collection={MOCK_COLLECTIONS[0]} addHref="/queue/add" />
        </MockStudioProvider>
      );
      fireEvent.click(screen.getByLabelText("Add music"));
      expect(push).toHaveBeenCalledWith("/queue/add");
    });
  });

  describe("positional tracks (queue)", () => {
    it("reports the clicked position when given a tracks override and onPlayAt", () => {
      // Without a position, play() resolves a duplicated track by findIndex and
      // starts the FIRST copy — clicking the second row would play the first.
      const onPlayAt = vi.fn();
      const dup = MOCK_TRACKS[0];

      render(
        <MockStudioProvider>
          <CollectionDetail
            collection={MOCK_COLLECTIONS[0]}
            tracks={[dup, MOCK_TRACKS[1], dup]}
            onPlayAt={onPlayAt}
          />
        </MockStudioProvider>
      );

      fireEvent.click(screen.getAllByLabelText(`Play ${dup.title}`)[1]);
      expect(onPlayAt).toHaveBeenCalledWith(2);
    });

    it("renders every copy of a duplicated track", () => {
      const dup = MOCK_TRACKS[0];
      render(
        <MockStudioProvider>
          <CollectionDetail
            collection={MOCK_COLLECTIONS[0]}
            tracks={[dup, MOCK_TRACKS[1], dup]}
            onPlayAt={() => {}}
          />
        </MockStudioProvider>
      );
      expect(screen.getAllByLabelText(`Play ${dup.title}`)).toHaveLength(2);
    });
  });
});
