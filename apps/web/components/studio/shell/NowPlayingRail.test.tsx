import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider, {
  useMockStudio,
} from "@/components/studio/screens/MockStudioProvider";
import {
  LIKED_SONGS,
  getCollectionTracks,
  type MockCollection,
} from "@/components/studio/screens/mock-data";
import NowPlayingRail from "./NowPlayingRail";
import { playlistHref, SCREENS } from "./routes";

const nav = vi.hoisted(() => ({ pathname: "/design-system/screens/home" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

/** Starts playback of `track` from `source` when clicked. */
function Seed({ track, source }: { track: string; source: MockCollection }) {
  const { play } = useMockStudio();
  const found = getCollectionTracks(source).find((t) => t.id === track)!;
  return <button onClick={() => play(found, source)}>seed</button>;
}

/** Surfaces nowPlaying so tests can assert a click actually changed it. */
function NowPlayingProbe() {
  const { nowPlaying } = useMockStudio();
  return <div data-testid="now-playing">{nowPlaying?.title ?? "none"}</div>;
}

/** Surfaces the shared queueOpen flag — the drawer itself now lives in
 *  GlobalPlayer (Part A), so a NowPlayingRail-only render has no drawer body
 *  to assert on; this is the closest observable proxy for "did the control
 *  ask the shared drawer to open". */
function QueueOpenProbe() {
  const { queueOpen } = useMockStudio();
  return <div data-testid="queue-open">{String(queueOpen)}</div>;
}

describe("NowPlayingRail", () => {
  beforeEach(() => {
    nav.pathname = "/design-system/screens/home";
  });

  describe("add music section", () => {
    it("shows an honest hint when the path is not a playlist route", () => {
      nav.pathname = "/design-system/screens/home";
      render(
        <MockStudioProvider>
          <NowPlayingRail />
        </MockStudioProvider>
      );

      expect(
        screen.getByText("Open a playlist to add tracks to it.")
      ).toBeTruthy();
      expect(screen.queryByLabelText("Search tracks to add")).toBeNull();
    });

    it("shows the add-music search field when the path is a playlist route", () => {
      nav.pathname = playlistHref(LIKED_SONGS.id);
      render(
        <MockStudioProvider>
          <NowPlayingRail />
        </MockStudioProvider>
      );

      expect(screen.getByLabelText("Search tracks to add")).toBeTruthy();
      expect(
        screen.queryByText("Open a playlist to add tracks to it.")
      ).toBeNull();
    });

    it("falls back to the hint when the playlist id in the path is unknown", () => {
      nav.pathname = `${SCREENS}/playlist/not-a-real-id`;
      render(
        <MockStudioProvider>
          <NowPlayingRail />
        </MockStudioProvider>
      );

      expect(
        screen.getByText("Open a playlist to add tracks to it.")
      ).toBeTruthy();
    });
  });

  describe("up next section", () => {
    it("renders upcoming tracks when a queue exists", () => {
      const source = LIKED_SONGS; // trackIds: t2, t5, t7, t10, t8
      render(
        <MockStudioProvider>
          <Seed track="t2" source={source} />
          <NowPlayingRail />
        </MockStudioProvider>
      );

      fireEvent.click(screen.getByText("seed"));

      // t2 ("Cobalt Dreams") is now playing; the remaining four tracks in
      // the collection — t5, t7, t10, t8 — are what should preview as
      // upcoming. The currently playing track must not repeat as a row.
      expect(screen.getByText("Topographic Heart")).toBeTruthy();
      expect(screen.getByText("Glitch Sakura")).toBeTruthy();
      expect(screen.getByText("ASCII Rain")).toBeTruthy();
      expect(screen.getByText("Horizon Line")).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "Play Cobalt Dreams" })
      ).toBeNull();
    });

    it("shows an empty state when nothing follows the current track", () => {
      const source = LIKED_SONGS; // trackIds: t2, t5, t7, t10, t8 — t8 is last
      render(
        <MockStudioProvider>
          <Seed track="t8" source={source} />
          <NowPlayingRail />
        </MockStudioProvider>
      );

      fireEvent.click(screen.getByText("seed"));

      expect(screen.getByText("Queue is empty")).toBeTruthy();
      expect(screen.queryByText("Topographic Heart")).toBeNull();
    });

    it("previews the head of the library queue before anything has played", () => {
      // Cold session: no playback, so playingCollection is null and
      // useQueueCollection synthesises "Up next" over the whole library
      // (MOCK_TRACKS, t1..t12). This is the first thing a user ever sees.
      render(
        <MockStudioProvider>
          <NowPlayingProbe />
          <NowPlayingRail />
        </MockStudioProvider>
      );

      expect(screen.getByTestId("now-playing").textContent).toBe("none");

      // The first five of the library queue, t1..t5.
      expect(screen.getByText("Midnight Snowfall")).toBeTruthy();
      expect(screen.getByText("Cobalt Dreams")).toBeTruthy();
      expect(screen.getByText("Static Bloom")).toBeTruthy();
      expect(screen.getByText("Paper Lanterns")).toBeTruthy();
      expect(screen.getByText("Topographic Heart")).toBeTruthy();
      // t6 is the 6th track — the cap must stop the preview before it.
      expect(screen.queryByText("Ripple Theory")).toBeNull();
      expect(screen.queryByText("Queue is empty")).toBeNull();
    });

    it("opens the shared queue drawer state from the Open queue control", () => {
      // The queue drawer itself is lifted into the provider and mounted once
      // by GlobalPlayer (Part A) — a NowPlayingRail-only render has no drawer
      // body to assert on, so this checks the shared queueOpen flag instead.
      render(
        <MockStudioProvider>
          <Seed track="t2" source={LIKED_SONGS} />
          <QueueOpenProbe />
          <NowPlayingRail />
        </MockStudioProvider>
      );

      fireEvent.click(screen.getByText("seed"));
      expect(screen.getByTestId("queue-open").textContent).toBe("false");

      fireEvent.click(screen.getByLabelText("Open queue"));

      expect(screen.getByTestId("queue-open").textContent).toBe("true");
    });

    it("starts a track when its up-next row is clicked", () => {
      const source = LIKED_SONGS; // trackIds: t2, t5, t7, t10, t8
      render(
        <MockStudioProvider>
          <Seed track="t2" source={source} />
          <NowPlayingProbe />
          <NowPlayingRail />
        </MockStudioProvider>
      );

      fireEvent.click(screen.getByText("seed"));
      expect(screen.getByTestId("now-playing").textContent).toBe(
        "Cobalt Dreams"
      );

      fireEvent.click(screen.getByRole("button", { name: "Play Topographic Heart" }));

      expect(screen.getByTestId("now-playing").textContent).toBe(
        "Topographic Heart"
      );
    });
  });
});
