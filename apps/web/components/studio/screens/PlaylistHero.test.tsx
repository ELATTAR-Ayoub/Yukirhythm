import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import PlaylistHero from "./PlaylistHero";
import MockStudioProvider, { useMockStudio } from "./MockStudioProvider";
import {
  LIKED_SONGS,
  MOCK_COLLECTIONS,
  getCollectionTracks,
  type MockCollection,
} from "./mock-data";

/** A different collection from the one the hero renders. */
const OTHER = MOCK_COLLECTIONS[0];

/**
 * SpinningDisc exposes no aria/data attribute for its spin state — it drives
 * the platter by writing `transform: rotate(Ndeg)` to its inner span from a
 * rAF loop. That inline transform is the component's real rendered output, so
 * it is the honest observable here; there is no cheaper signal short of
 * adding a test-only attribute to the shared component.
 */
function discAngle(container: HTMLElement): string {
  const inner = container.querySelector<HTMLElement>(".will-change-transform");
  if (!inner) throw new Error("SpinningDisc inner element not found");
  return inner.style.transform;
}

/** Starts playback of `from`'s first track when clicked. */
function Seed({ from }: { from: MockCollection }) {
  const { play, toggle } = useMockStudio();
  return (
    <>
      <button onClick={() => play(getCollectionTracks(from)[0], from)}>
        seed
      </button>
      <button onClick={() => toggle()}>toggle</button>
    </>
  );
}

function renderHero(playFrom: MockCollection) {
  const utils = render(
    <MockStudioProvider>
      <Seed from={playFrom} />
      <PlaylistHero collection={LIKED_SONGS} />
    </MockStudioProvider>
  );
  fireEvent.click(screen.getByText("seed"));
  // 650ms is MockStudioProvider's fake buffering delay before isPlaying flips.
  act(() => void vi.advanceTimersByTime(650));
  return utils;
}

/**
 * Is the platter still turning once any coast-down has finished? The disc has
 * momentum (SPIN_DOWN_TAU ~1.15s), so a paused disc keeps creeping for several
 * seconds — comparing two snapshots after a long settle is the only reading
 * that distinguishes "stopped" from "slowing down".
 */
function stillTurningAfterSettling(container: HTMLElement): boolean {
  act(() => void vi.advanceTimersByTime(12_000));
  const settled = discAngle(container);
  act(() => void vi.advanceTimersByTime(2_000));
  return discAngle(container) !== settled;
}

describe("PlaylistHero", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("spins when this collection is the one playing", () => {
    const { container } = renderHero(LIKED_SONGS);
    expect(stillTurningAfterSettling(container)).toBe(true);
  });

  it("stays still when a different collection is playing", () => {
    const { container } = renderHero(OTHER);
    // Never spun up at all, so it should not have moved off zero.
    expect(discAngle(container)).toBe("rotate(0deg)");
    expect(stillTurningAfterSettling(container)).toBe(false);
  });

  it("stays still when this collection is playing but paused", () => {
    // The case a naive `playingCollection?.id === collection.id` check gets
    // wrong: right collection, but playback is paused.
    const { container } = renderHero(LIKED_SONGS);
    fireEvent.click(screen.getByText("toggle"));
    expect(stillTurningAfterSettling(container)).toBe(false);
  });

  it("puts an image cover's real artwork on the disc, not a texture", () => {
    // The background wash (CollectionArt, rendered above the disc) also
    // draws this same URL, so a bare "at least one <img> with this src"
    // assertion would pass even with the bug present — it'd just be seeing
    // the wash. Scope to the disc itself (`.disc_shadow`, SpinningDisc's own
    // wrapper) so this only passes when the DISC carries the real artwork.
    const { container } = render(
      <MockStudioProvider>
        <PlaylistHero
          collection={{
            ...MOCK_COLLECTIONS[0],
            cover: "image",
            artUrl: "https://cdn/hero.jpg",
          }}
        />
      </MockStudioProvider>
    );
    const disc = container.querySelector(".disc_shadow");
    expect(disc).toBeTruthy();
    expect(disc!.querySelector('img[src="https://cdn/hero.jpg"]')).toBeTruthy();
  });
});
