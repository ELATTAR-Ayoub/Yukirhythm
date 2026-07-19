import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import MediaCard from "./MediaCard";

/**
 * IconSwap renders both icon faces as siblings (class `col-start-1`), the
 * active one at opacity-100 and the other at opacity-0 + aria-hidden. A
 * hard ternary swap would instead render a single icon with neither class,
 * so asserting exactly two faces — one visible, one hidden — is what
 * distinguishes the real component from a lookalike.
 */
function iconSwapFaces(button: HTMLElement): HTMLElement[] {
  return Array.from(button.querySelectorAll<HTMLElement>("span")).filter(
    (el) => el.className.includes("col-start-1")
  );
}

describe("MediaCard play overlay", () => {
  it("renders the hover play control through IconSwap when not playing", () => {
    render(<MediaCard title="Cobalt Dreams" artist="Aoi Waves" />);

    const button = screen.getByRole("button", { name: "Play" });
    const faces = iconSwapFaces(button);
    expect(faces).toHaveLength(2);
    expect(faces[0].className).toContain("opacity-100");
    expect(faces[0].getAttribute("aria-hidden")).toBe("false");
    expect(faces[1].className).toContain("opacity-0");
    expect(faces[1].getAttribute("aria-hidden")).toBe("true");
  });

  it("rolls the strip to the pause face when playing is true", () => {
    render(<MediaCard title="Cobalt Dreams" artist="Aoi Waves" playing />);

    const button = screen.getByRole("button", { name: "Pause" });
    const faces = iconSwapFaces(button);
    expect(faces).toHaveLength(2);
    expect(faces[0].className).toContain("opacity-0");
    expect(faces[0].getAttribute("aria-hidden")).toBe("true");
    expect(faces[1].className).toContain("opacity-100");
    expect(faces[1].getAttribute("aria-hidden")).toBe("false");
  });

  it("opts out of the overlay entirely when playable is false", () => {
    render(
      <MediaCard title="Cobalt Dreams" artist="Aoi Waves" playable={false} />
    );
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
  });
});
