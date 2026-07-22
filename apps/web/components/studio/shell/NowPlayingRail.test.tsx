import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import MockStudioProvider, {
  useMockStudio,
} from "@/components/studio/screens/MockStudioProvider";
import {
  LIKED_SONGS,
  MOCK_COLLECTIONS,
  getCollectionTracks,
  type MockCollection,
} from "@/components/studio/screens/mock-data";
import { IDLE_LABEL } from "@/components/studio/screens/player-idle";
import NowPlayingRail from "./NowPlayingRail";
import { QUEUE } from "./routes";

const { push, nav } = vi.hoisted(() => ({
  push: vi.fn(),
  nav: { pathname: "/design-system/screens/home" },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push }),
}));

/** Starts playback of `track` from `source` when clicked. */
function Seed({ track, source }: { track: string; source: MockCollection }) {
  const { play } = useMockStudio();
  const found = getCollectionTracks(source).find((t) => t.id === track)!;
  return <button onClick={() => play(found, source)}>seed</button>;
}

/** Surfaces a collection's size, to prove queueing never wrote into it. */
function CollectionProbe({ id }: { id: string }) {
  const { collections } = useMockStudio();
  const found = collections.find((c) => c.id === id);
  return (
    <div data-testid="collection-size">{found?.trackIds.length ?? -1}</div>
  );
}

/** Surfaces nowPlaying so tests can assert a click actually changed it. */
function NowPlayingProbe() {
  const { nowPlaying } = useMockStudio();
  return <div data-testid="now-playing">{nowPlaying?.title ?? "none"}</div>;
}

describe("NowPlayingRail", () => {
  beforeEach(() => {
    nav.pathname = "/design-system/screens/home";
    push.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the docked player pinned outside the scrollable up-next/add-music section", () => {
    // jsdom has no layout engine, so scroll position/bounding-rect can't be
    // asserted here (see the live-measured proof in the task report instead).
    // What jsdom CAN honestly assert is the structural fix: the player must
    // not be a descendant of the element that scrolls, or scrolling that
    // element would carry the player along with it — the exact bug this
    // guards against.
    const { container } = render(
      <MockStudioProvider>
        <NowPlayingRail />
      </MockStudioProvider>
    );

    const scrollRegion = container.querySelector(".overflow-y-auto");
    expect(scrollRegion).toBeTruthy();

    // The rail renders the player chassis whether or not a track is loaded,
    // so anchor on its idle copy rather than the old "nothing here" line.
    const playerText = screen.getByText(IDLE_LABEL);
    expect(scrollRegion!.contains(playerText)).toBe(false);

    expect(scrollRegion!.contains(screen.getByText("Up next"))).toBe(true);
    expect(scrollRegion!.contains(screen.getByText("Add to queue"))).toBe(true);
  });

  describe("add to queue section", () => {
    it("offers a live field on a route with no playlist open", () => {
      // The rail belongs to playback, not to the library: queueing must not
      // depend on what page happens to be open.
      nav.pathname = "/home";
      render(
        <MockStudioProvider>
          <NowPlayingRail />
        </MockStudioProvider>
      );

      const field = screen.getByLabelText<HTMLInputElement>(
        "Search tracks to queue"
      );
      expect(field.disabled).toBe(false);
    });

    it("adds the picked track to the running queue, not to any playlist", async () => {
      // Playing t8 — the last track of Liked Songs — so Up next is empty and
      // anything appearing there can only have come from this field.
      const source = LIKED_SONGS; // t2, t5, t7, t10, t8
      render(
        <MockStudioProvider>
          <Seed track="t8" source={source} />
          <CollectionProbe id={source.id} />
          <NowPlayingRail />
        </MockStudioProvider>
      );

      fireEvent.click(screen.getByText("seed"));
      expect(screen.getByText("Nothing queued yet.")).toBeTruthy();
      const before = screen.getByTestId("collection-size").textContent;

      // t1 "Midnight Snowfall" is not in Liked Songs, so it is neither
      // already queued nor already in the collection.
      fireEvent.change(screen.getByLabelText("Search tracks to queue"), {
        target: { value: "Midnight" },
      });
      fireEvent.click(
        await screen.findByRole("button", {
          name: "Add Midnight Snowfall to queue",
        })
      );

      // It landed in the queue preview...
      const upNext = within(screen.getByRole("region", { name: "Up next" }));
      expect(upNext.getByText("Midnight Snowfall")).toBeTruthy();
      // ...and the collection playback started from is untouched.
      expect(screen.getByTestId("collection-size").textContent).toBe(before);
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

      expect(screen.getByText("Nothing queued yet.")).toBeTruthy();
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
      expect(screen.queryByText("Nothing queued yet.")).toBeNull();
    });

    it("navigates to the routed queue page from the Open queue control, at every width", () => {
      render(
        <MockStudioProvider>
          <NowPlayingRail />
        </MockStudioProvider>
      );

      fireEvent.click(screen.getByLabelText("Open queue"));

      expect(push).toHaveBeenCalledWith(QUEUE);
    });

    it("does not nest a play button inside the row's role=button wrapper", () => {
      // TrackRow's hover overlay is a real <button aria-label="Play">.
      // Nested inside the row's role="button" wrapper it's invalid HTML and
      // a dead, near-unlabelled keyboard stop — opted out via playable={false}.
      render(
        <MockStudioProvider>
          <NowPlayingRail />
        </MockStudioProvider>
      );

      // Scoped to the queue preview, not the whole rail: the docked player's
      // own transport legitimately carries aria-label="Play", so a rail-wide
      // count would fail for a reason that has nothing to do with the rows.
      const upNext = within(screen.getByRole("region", { name: "Up next" }));
      expect(upNext.queryAllByLabelText("Play")).toHaveLength(0);
      // The wrapper's own accessible name must still be present.
      expect(
        upNext.getByRole("button", { name: "Play Midnight Snowfall" })
      ).toBeTruthy();
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

describe("up next reads the queue by position", () => {
  /** Enqueues the same track twice so duplicate handling is exercised. */
  function SeedDuplicate() {
    const { play, enqueue } = useMockStudio();
    const [a, b] = getCollectionTracks(MOCK_COLLECTIONS[0]);
    return (
      <button
        onClick={() => {
          play(a, MOCK_COLLECTIONS[0]);
          enqueue(b);
          enqueue(b);
        }}
      >
        seed-dup
      </button>
    );
  }

  /** Surfaces the queue length so a click can be proven non-destructive. */
  function QueueProbe() {
    const { queue } = useMockStudio();
    return <div data-testid="queue-len">{queue.length}</div>;
  }

  /**
   * Moves the playhead straight to a queue position via the context's own
   * `playAt`, independent of whatever `UpNextSection` renders. This is the
   * reliable way to land `nowPlaying` on the *last* copy of a duplicated
   * track: it targets the provider's `currentIndex` directly, so the
   * assertion exercises exactly the currentIndex-vs-findIndex divergence
   * described in Bug 1, rather than depending on how a row's own click
   * handler happens to be wired.
   */
  function AdvancePlayhead({ to }: { to: number }) {
    const { playAt } = useMockStudio();
    return <button onClick={() => playAt(to)}>advance-playhead</button>;
  }

  it("renders both copies of a track queued twice", () => {
    // Keyed by track id, React collapsed and reshuffled these rows — the
    // "adds and removes music whenever it wants" report.
    render(
      <MockStudioProvider>
        <SeedDuplicate />
        <NowPlayingRail />
      </MockStudioProvider>
    );
    fireEvent.click(screen.getByText("seed-dup"));

    const [, b] = getCollectionTracks(MOCK_COLLECTIONS[0]);
    expect(screen.getAllByLabelText(`Play ${b.title}`).length).toBeGreaterThanOrEqual(2);
  });

  it("keeps every enqueued track when an up-next row is clicked", () => {
    render(
      <MockStudioProvider>
        <SeedDuplicate />
        <NowPlayingRail />
        <QueueProbe />
      </MockStudioProvider>
    );
    fireEvent.click(screen.getByText("seed-dup"));
    const before = screen.getByTestId("queue-len").textContent;

    fireEvent.click(screen.getAllByLabelText(/^Play /)[0]);

    expect(screen.getByTestId("queue-len").textContent).toBe(before);
  });

  it("previews what follows the playhead, not what precedes it", () => {
    // Adjusted from the spec's literal version: with SeedDuplicate alone, `a`
    // (the now-playing track) is never duplicated, so a plain
    // findIndex(nowPlaying.id) always lands on the right slot for it and
    // this assertion would pass identically before and after the fix — it
    // never actually exercises Bug 1. Bug 1 only diverges from the truth
    // when the *playing* track itself has an earlier duplicate elsewhere in
    // the queue, so this drives the playhead (via `playAt`, not a row click —
    // see AdvancePlayhead) onto the LAST copy of the duplicated track `b`.
    //
    // Queue after seeding is [t1, t4, t10, t5, t4, t4] (b = t4); index 5 is
    // the final slot, so nothing should preview as upcoming. A
    // findIndex-by-id derivation instead resolves nowPlaying's FIRST
    // occurrence of t4 (index 1) and would wrongly show t10/t5/t4 —
    // already-played tracks — as "up next".
    render(
      <MockStudioProvider>
        <SeedDuplicate />
        <AdvancePlayhead to={5} />
        <NowPlayingRail />
      </MockStudioProvider>
    );
    fireEvent.click(screen.getByText("seed-dup"));
    fireEvent.click(screen.getByText("advance-playhead"));

    const upNext = within(screen.getByRole("region", { name: "Up next" }));
    expect(upNext.getByText("Nothing queued yet.")).toBeTruthy();
    expect(upNext.queryByText("ASCII Rain")).toBeNull();
    expect(upNext.queryByText("Topographic Heart")).toBeNull();
  });
});
