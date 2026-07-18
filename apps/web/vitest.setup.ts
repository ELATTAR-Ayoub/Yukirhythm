import "@testing-library/jest-dom/vitest";

// jsdom has no ResizeObserver; Radix primitives (e.g. Slider) use it to
// measure thumbs. A no-op stub is enough for tests that don't assert layout.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
