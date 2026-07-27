import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BackHeader from "./BackHeader";

const { back, push } = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back, push }),
}));

describe("BackHeader", () => {
  const originalNavigation = Object.getOwnPropertyDescriptor(
    window,
    "navigation"
  );

  beforeEach(() => {
    back.mockClear();
    push.mockClear();
    Object.defineProperty(window, "navigation", {
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalNavigation) {
      Object.defineProperty(window, "navigation", originalNavigation);
    } else {
      delete (window as typeof window & { navigation?: unknown }).navigation;
    }
  });

  it("returns to the previous page when browser history is available", () => {
    vi.spyOn(window.history, "length", "get").mockReturnValue(2);

    render(<BackHeader title="Up next" fallbackHref="/home" />);
    fireEvent.click(screen.getByRole("link", { name: "Back" }));

    expect(back).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
  });

  it("uses the route fallback on a direct load", () => {
    vi.spyOn(window.history, "length", "get").mockReturnValue(1);

    render(<BackHeader title="Up next" fallbackHref="/home" />);
    fireEvent.click(screen.getByRole("link", { name: "Back" }));

    expect(push).toHaveBeenCalledWith("/home");
    expect(back).not.toHaveBeenCalled();
  });

  it("does not leave the app when the preceding entry is cross-origin", () => {
    Object.defineProperty(window, "navigation", {
      configurable: true,
      value: {
        currentEntry: { index: 2, url: `${window.location.origin}/queue` },
        entries: () => [
          { index: 1, url: "https://example.com/outside" },
          { index: 2, url: `${window.location.origin}/queue` },
        ],
      },
    });

    render(<BackHeader title="Up next" fallbackHref="/home" />);
    fireEvent.click(screen.getByRole("link", { name: "Back" }));

    expect(push).toHaveBeenCalledWith("/home");
    expect(back).not.toHaveBeenCalled();
  });
});
