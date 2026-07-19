import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useBreakpointUp, DESKTOP_MIN, WIDE_MIN } from "./useIsDesktop";

/** Minimal matchMedia double: we control `matches` and fire the listener. */
function stubMatchMedia(initial: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches: initial,
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) =>
      listeners.add(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) =>
      listeners.delete(cb),
  };
  const matchMedia = vi.fn(() => mql);
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    matchMedia,
    set(next: boolean) {
      mql.matches = next;
      listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent));
    },
    listenerCount: () => listeners.size,
  };
}

describe("useBreakpointUp", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports the real match after mount", () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useBreakpointUp(WIDE_MIN));
    expect(result.current).toBe(true);
  });

  it("is false when the query does not match", () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useBreakpointUp(WIDE_MIN));
    expect(result.current).toBe(false);
  });

  it("queries min-width in px", () => {
    const stub = stubMatchMedia(true);
    renderHook(() => useBreakpointUp(DESKTOP_MIN));
    expect(stub.matchMedia).toHaveBeenCalledWith("(min-width: 768px)");
  });

  it("updates when the viewport crosses the threshold", () => {
    const stub = stubMatchMedia(false);
    const { result } = renderHook(() => useBreakpointUp(WIDE_MIN));
    expect(result.current).toBe(false);

    act(() => stub.set(true));
    expect(result.current).toBe(true);
  });

  it("removes its listener on unmount", () => {
    const stub = stubMatchMedia(true);
    const { unmount } = renderHook(() => useBreakpointUp(WIDE_MIN));
    expect(stub.listenerCount()).toBe(1);

    unmount();
    expect(stub.listenerCount()).toBe(0);
  });

  it("returns false when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useBreakpointUp(WIDE_MIN));
    expect(result.current).toBe(false);
  });
});
