import "@testing-library/jest-dom/vitest";

// jsdom lacks browser APIs that Radix UI primitives depend on. Without these,
// anything rendering a Slider/DropdownMenu/Dialog/Drawer throws.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== "undefined") {
  if (!("ResizeObserver" in window)) {
    (
      window as unknown as { ResizeObserver: typeof ResizeObserver }
    ).ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}
