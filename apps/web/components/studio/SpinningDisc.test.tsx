import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render } from "@testing-library/react";

import SpinningDisc from "./SpinningDisc";

/**
 * requestAnimationFrame double that lets a test drive the loop frame by
 * frame under full control, and — critically — count how many frames are
 * still queued. That count is the only honest way to prove a loop has
 * parked: a stationary transform is equally consistent with "parked" and
 * "running but momentarily at rest".
 */
function mockRaf() {
  let nextId = 1;
  const pending = new Map<number, FrameRequestCallback>();
  const raf = vi.fn((cb: FrameRequestCallback) => {
    const id = nextId++;
    pending.set(id, cb);
    return id;
  });
  const caf = vi.fn((id: number) => {
    pending.delete(id);
  });
  vi.stubGlobal("requestAnimationFrame", raf);
  vi.stubGlobal("cancelAnimationFrame", caf);
  return {
    raf,
    caf,
    pendingCount: () => pending.size,
    /** Invokes every callback queued right now, in one simulated frame. */
    flush(now: number) {
      const callbacks = Array.from(pending.values());
      pending.clear();
      callbacks.forEach((cb) => cb(now));
    },
  };
}

/** Controls what `performance.now()` returns, in lockstep with flush(now). */
function mockClock(start = 0) {
  let value = start;
  vi.spyOn(performance, "now").mockImplementation(() => value);
  return {
    get value() {
      return value;
    },
    set(v: number) {
      value = v;
    },
  };
}

function discEl(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>(".will-change-transform");
  if (!el) throw new Error("SpinningDisc inner element not found");
  return el;
}

function angleOf(container: HTMLElement): number {
  const match = discEl(container).style.transform.match(
    /rotate\(([\d.]+)deg\)/
  );
  return match ? Number(match[1]) : 0;
}

describe("SpinningDisc", () => {
  let clock: ReturnType<typeof mockClock>;
  let raf: ReturnType<typeof mockRaf>;

  beforeEach(() => {
    clock = mockClock(0);
    raf = mockRaf();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Advances the shared clock by `ms` and runs one simulated frame. */
  function frame(ms: number) {
    clock.set(clock.value + ms);
    act(() => raf.flush(clock.value));
  }

  it("rotates while spinning, and keeps scheduling frames", () => {
    const { container } = render(
      <SpinningDisc texture="tx-k-marble" spinning />
    );
    expect(raf.pendingCount()).toBe(1); // loop started on mount

    frame(100);
    frame(100);
    frame(100);

    expect(angleOf(container)).toBeGreaterThan(0);
    expect(raf.pendingCount()).toBe(1); // still commanded to spin, still queued
  });

  it("coasts to rest after stopping, then stops scheduling frames", () => {
    const { container, rerender } = render(
      <SpinningDisc texture="tx-k-marble" spinning />
    );
    // Build up to speed first — a coast from a standstill wouldn't exercise
    // the decay path at all.
    for (let i = 0; i < 10; i++) frame(100);
    const speedAngle = angleOf(container);
    expect(speedAngle).toBeGreaterThan(0);

    rerender(<SpinningDisc texture="tx-k-marble" spinning={false} />);

    // Drain the exponential decay (tau=1.15s) down through the 0.02deg/s
    // rest epsilon. dt is clamped to 0.1s/frame, so this needs on the order
    // of 80-100 simulated frames — cheap since each is a synchronous flush.
    let stillQueued = true;
    for (let i = 0; i < 200 && stillQueued; i++) {
      frame(100);
      stillQueued = raf.pendingCount() > 0;
    }

    expect(raf.pendingCount()).toBe(0); // genuinely parked, not just slow
    const restAngle = angleOf(container);
    expect(restAngle).toBeGreaterThan(speedAngle); // it coasted, didn't snap

    // And parked means parked: further flush attempts find nothing queued.
    const before = raf.pendingCount();
    frame(100);
    expect(raf.pendingCount()).toBe(before);
    expect(angleOf(container)).toBe(restAngle);
  });

  it("resumes a parked loop the instant spinning flips true again, from the resting angle", () => {
    const { container, rerender } = render(
      <SpinningDisc texture="tx-k-marble" spinning />
    );
    for (let i = 0; i < 10; i++) frame(100);
    rerender(<SpinningDisc texture="tx-k-marble" spinning={false} />);
    for (let i = 0; i < 200 && raf.pendingCount() > 0; i++) frame(100);
    expect(raf.pendingCount()).toBe(0);
    const restAngle = angleOf(container);

    // Flipping spinning back on with no intervening frame must, by itself,
    // wake the parked loop — this is the restart path the task calls out
    // as easy to miss.
    act(() => {
      rerender(<SpinningDisc texture="tx-k-marble" spinning />);
    });
    expect(raf.pendingCount()).toBe(1);

    frame(100);
    expect(angleOf(container)).toBeGreaterThan(restAngle); // resumed, not reset to 0
    expect(raf.pendingCount()).toBe(1); // spinning again => loop stays alive
  });

  it("short-circuits under prefers-reduced-motion: no loop is ever scheduled", () => {
    const mql = {
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => mql)
    );

    const { container, rerender } = render(
      <SpinningDisc texture="tx-k-marble" spinning />
    );
    expect(raf.pendingCount()).toBe(0);
    expect(discEl(container).style.transform).toBe("rotate(0deg)");

    rerender(<SpinningDisc texture="tx-k-marble" spinning={false} />);
    expect(raf.pendingCount()).toBe(0);
  });

  it("cancels the frame on unmount mid-coast, leaving nothing queued", () => {
    const { unmount } = render(<SpinningDisc texture="tx-k-marble" spinning />);
    frame(100);
    expect(raf.pendingCount()).toBe(1);

    unmount();

    expect(raf.caf).toHaveBeenCalled();
    expect(raf.pendingCount()).toBe(0);
  });

  it("survives rapid on/off/on toggling without ever leaving the loop dead while spinning", () => {
    const { rerender } = render(
      <SpinningDisc texture="tx-k-marble" spinning={false} />
    );
    // Mount-time tick immediately parks (spinning false, velocity starts at 0).
    frame(100);
    expect(raf.pendingCount()).toBe(0);

    act(() => rerender(<SpinningDisc texture="tx-k-marble" spinning />));
    expect(raf.pendingCount()).toBe(1);

    act(() =>
      rerender(<SpinningDisc texture="tx-k-marble" spinning={false} />)
    );
    // Still coasting — must not have parked instantly.
    expect(raf.pendingCount()).toBe(1);

    act(() => rerender(<SpinningDisc texture="tx-k-marble" spinning />));
    expect(raf.pendingCount()).toBe(1); // whenever spinning is true, loop is running
  });
});
