import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import MediaCard from "./MediaCard";

/**
 * IconSwap renders both icon faces as siblings (class `col-start-1`), the
 * active one at opacity-100 and the other at opacity-0 + aria-hidden. A
 * hard ternary swap would instead render a single icon with neither class,
 * so asserting exactly two faces — one visible, one hidden — is what
 * distinguishes the real component from a lookalike.
 */
function iconSwapFaces(button: HTMLElement): HTMLElement[] {
  return Array.from(button.querySelectorAll<HTMLElement>("span")).filter((el) =>
    el.className.includes("col-start-1")
  );
}

describe("MediaCard play overlay", () => {
  afterEach(() => vi.useRealTimers());

  it("delays a single click but turns a double click into one queue action", () => {
    vi.useFakeTimers();
    const preview = vi.fn();
    const enqueue = vi.fn();
    render(
      <MediaCard
        title="Cobalt Dreams"
        onPreview={preview}
        onAddToQueue={enqueue}
      />
    );
    const card = screen.getByRole("button", {
      name: "Preview Cobalt Dreams for 10 seconds",
    });
    fireEvent.click(card, { detail: 1 });
    fireEvent.click(card, { detail: 2 });
    vi.advanceTimersByTime(250);
    expect(preview).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("renders the hover play control through IconSwap when not playing", () => {
    render(<MediaCard title="Cobalt Dreams" artist="Aoi Waves" />);

    // The overlay is aria-hidden decoration now (the card's own role="button"
    // wrapper is the real control), so it must be queried explicitly via
    // hidden: true — it no longer shows up in the default a11y tree query.
    const button = screen.getByRole("button", { name: "Play", hidden: true });
    const faces = iconSwapFaces(button);
    expect(faces).toHaveLength(2);
    expect(faces[0].className).toContain("opacity-100");
    expect(faces[0].getAttribute("aria-hidden")).toBe("false");
    expect(faces[1].className).toContain("opacity-0");
    expect(faces[1].getAttribute("aria-hidden")).toBe("true");
    // Not a phantom tab stop, and pulled out of the a11y tree by an
    // aria-hidden ancestor — see MediaCard.tsx's PlayOverlay for the WHY.
    expect(button.tabIndex).toBe(-1);
    expect(
      button.closest('[aria-hidden="true"]')?.getAttribute("aria-hidden")
    ).toBe("true");
  });

  it("rolls the strip to the pause face when playing is true", () => {
    render(<MediaCard title="Cobalt Dreams" artist="Aoi Waves" playing />);

    const button = screen.getByRole("button", { name: "Pause", hidden: true });
    const faces = iconSwapFaces(button);
    expect(faces).toHaveLength(2);
    expect(faces[0].className).toContain("opacity-0");
    expect(faces[0].getAttribute("aria-hidden")).toBe("true");
    expect(faces[1].className).toContain("opacity-100");
    expect(faces[1].getAttribute("aria-hidden")).toBe("false");
    expect(button.tabIndex).toBe(-1);
    expect(
      button.closest('[aria-hidden="true"]')?.getAttribute("aria-hidden")
    ).toBe("true");
  });

  it("opts out of the overlay entirely when playable is false", () => {
    render(
      <MediaCard title="Cobalt Dreams" artist="Aoi Waves" playable={false} />
    );
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
  });

  it("shows a circular countdown while a ten-second preview is active", () => {
    render(
      <MediaCard
        title="Cobalt Dreams"
        artist="Aoi Waves"
        previewSecondsRemaining={6.2}
      />
    );

    expect(
      screen.getByRole("status", { name: "7 seconds left in preview" })
    ).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
  });

  it("falls back to the texture when the artwork URL fails to load", () => {
    const { container } = render(
      <MediaCard
        title="Realize"
        artUrl="https://cdn/gone.jpg"
        texture="tx-k-silk"
      />
    );
    const img = container.querySelector("img")!;
    expect(img).toBeTruthy();
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
  });
});
