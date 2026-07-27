import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import RailShelf from "./RailShelf";

/**
 * Minimal matchMedia double mirroring useBreakpoint.test.ts / PlaybackBar.test.tsx.
 * RailShelf only ever queries one width (useIsDesktop, min-width: 768px), so a
 * single fixed `matches` value is enough — no listener bookkeeping needed here.
 */
function stubMatchMedia(matches: boolean) {
  const mql = {
    matches,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mql)
  );
}

describe("RailShelf", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the horizontal drag-scroller by default on desktop", () => {
    stubMatchMedia(true);
    const { container } = render(
      <RailShelf label="Fresh drops" title="New releases">
        <div>card</div>
      </RailShelf>
    );
    // DragScroller's own marker class.
    expect(container.querySelector(".no-scrollbar")).toBeTruthy();
    expect(container.querySelector(".grid")).toBeNull();
  });

  it("grids on desktop when grid is requested", () => {
    stubMatchMedia(true);
    const { container } = render(
      <RailShelf label="Fresh drops" title="New releases" grid>
        <div>card</div>
      </RailShelf>
    );
    expect(container.querySelector(".grid")).toBeTruthy();
    expect(container.querySelector(".no-scrollbar")).toBeNull();
  });

  it("keeps the scroller on a narrow viewport even when grid is requested", () => {
    // Mobile must never change — grid only ever adds a wider-screen shape.
    stubMatchMedia(false);
    const { container } = render(
      <RailShelf label="Fresh drops" title="New releases" grid>
        <div>card</div>
      </RailShelf>
    );
    expect(container.querySelector(".no-scrollbar")).toBeTruthy();
    expect(container.querySelector(".grid")).toBeNull();
  });

  it("still renders the loading skeleton regardless of grid", () => {
    stubMatchMedia(true);
    const { container } = render(
      <RailShelf label="Fresh drops" title="New releases" grid loading />
    );
    expect(container.querySelector("[aria-busy]")).toBeTruthy();
    expect(screen.getByText("New releases")).toBeTruthy();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(container.querySelector(".grid")).toBeNull();
  });

  it("renders its children in both shapes", () => {
    stubMatchMedia(true);
    const { rerender } = render(
      <RailShelf label="Fresh drops" title="New releases">
        <div>Track A</div>
      </RailShelf>
    );
    expect(screen.getByText("Track A")).toBeTruthy();

    rerender(
      <RailShelf label="Fresh drops" title="New releases" grid>
        <div>Track A</div>
      </RailShelf>
    );
    expect(screen.getByText("Track A")).toBeTruthy();
  });
});
