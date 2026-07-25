import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import TrackRow from "./TrackRow";

describe("TrackRow", () => {
  describe("play overlay (playable)", () => {
    it("renders the hover play button by default", () => {
      render(<TrackRow title="Cobalt Dreams" />);
      // The overlay is aria-hidden decoration (the row's own role="button"
      // wrapper is the real control), so it needs hidden: true to be found,
      // and it must not be a real tab stop — see TrackRow.tsx for the WHY.
      const button = screen.getByRole("button", { name: "Play", hidden: true });
      expect(button).toBeTruthy();
      expect(button.tabIndex).toBe(-1);
      expect(button.closest('[aria-hidden="true"]')?.getAttribute("aria-hidden")).toBe(
        "true"
      );
    });

    it("omits the hover play button when playable is false", () => {
      // This is the opt-out for callers (CollectionDetail, PlayerSearchDrawer,
      // NowPlayingRail) that already wrap the row in their own role="button"
      // element — without this, the row nests a real <button> inside another
      // interactive element.
      render(<TrackRow title="Cobalt Dreams" playable={false} />);
      expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
      // Dumping every accessible name confirms nothing else picks up the
      // bare "Play" label either — a pattern like `/^Play /` would silently
      // miss it if the opt-out regressed.
      expect(screen.queryAllByLabelText("Play")).toHaveLength(0);
    });
  });

  describe("desktop album column", () => {
    it("does not render an album column by default", () => {
      render(
        <TrackRow title="Cobalt Dreams" artist="Aoi Waves" album="Liked Songs" />
      );
      expect(screen.queryByText("Liked Songs")).toBeNull();
    });

    it("does not render an album column when desktop is true but no album was passed", () => {
      // No per-track album field exists on MockTrack, so desktop alone must
      // not conjure an empty column — only desktop + an explicit album value.
      render(<TrackRow title="Cobalt Dreams" desktop />);
      const row = screen.getByText("Cobalt Dreams").closest('[data-signal="row_play"]')!;
      expect(row.querySelector(".lg\\:block")).toBeNull();
    });

    it("renders the album column when desktop is true and album is passed", () => {
      render(
        <TrackRow
          title="Cobalt Dreams"
          artist="Aoi Waves"
          album="Liked Songs"
          desktop
        />
      );
      expect(screen.getByText("Liked Songs")).toBeTruthy();
    });

    it("hides the album column below the lg breakpoint", () => {
      render(
        <TrackRow
          title="Cobalt Dreams"
          album="Liked Songs"
          desktop
        />
      );
      const album = screen.getByText("Liked Songs");
      expect(album.closest("div")?.className).toContain("hidden");
      expect(album.closest("div")?.className).toContain("lg:block");
    });
  });

  describe("existing non-desktop rendering", () => {
    it("renders index, artist and duration unchanged", () => {
      render(
        <TrackRow
          index={3}
          title="Cobalt Dreams"
          artist="Aoi Waves"
          duration="3:08"
        />
      );
      expect(screen.getByText("Cobalt Dreams")).toBeTruthy();
      expect(screen.getByText("Aoi Waves")).toBeTruthy();
      expect(screen.getByText("03")).toBeTruthy();
      expect(screen.getByText("3:08")).toBeTruthy();
      // No album column ever appears unless desktop is explicitly opted in.
      expect(document.querySelector(".lg\\:block")).toBeNull();
    });

    it("shows the eq indicator instead of the play button while playing", () => {
      const { container } = render(
        <TrackRow title="Cobalt Dreams" playing />
      );
      // Playing rows still expose the hover play button (for pause/resume
      // discoverability) — only `playable={false}` removes it. It's
      // aria-hidden decoration now, so hidden: true is required to find it.
      expect(
        screen.getByRole("button", { name: "Play", hidden: true })
      ).toBeTruthy();
      expect(container.querySelector("svg")).toBeTruthy();
    });

    it("falls back to the texture when the artwork URL fails to load", () => {
      const { container } = render(
        <TrackRow title="Realize" artUrl="https://cdn/gone.jpg" texture="tx-k-silk" />
      );
      const img = container.querySelector("img")!;
      expect(img).toBeTruthy();
      fireEvent.error(img);
      expect(container.querySelector("img")).toBeNull();
    });
  });
});
