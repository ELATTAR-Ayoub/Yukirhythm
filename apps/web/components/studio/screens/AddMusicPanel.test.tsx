import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import { LIKED_SONGS, MOCK_COLLECTIONS } from "@/components/studio/screens/mock-data";
import AddMusicPanel from "./AddMusicPanel";

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

describe("AddMusicPanel add/added icon", () => {
  it("shows the add face through IconSwap for a track not yet in the collection", () => {
    // c3 "Pixel Podcasts" holds t3 and t12 only — "Cobalt Dreams" (t2) is not in it.
    const notAdded = MOCK_COLLECTIONS.find((c) => c.id === "c3")!;
    render(
      <MockStudioProvider>
        <AddMusicPanel collection={notAdded} />
      </MockStudioProvider>
    );

    fireEvent.change(screen.getByLabelText("Search tracks to add"), {
      target: { value: "Cobalt" },
    });
    const button = screen.getByRole("button", { name: "Add Cobalt Dreams" });
    const faces = iconSwapFaces(button);
    expect(faces).toHaveLength(2);
    expect(faces[0].className).toContain("opacity-100");
    expect(faces[0].getAttribute("aria-hidden")).toBe("false");
    expect(faces[1].className).toContain("opacity-0");
    expect(faces[1].getAttribute("aria-hidden")).toBe("true");
  });

  it("rolls the strip to the added face for a track already in the collection", () => {
    // LIKED_SONGS already contains t2 "Cobalt Dreams".
    render(
      <MockStudioProvider>
        <AddMusicPanel collection={LIKED_SONGS} />
      </MockStudioProvider>
    );

    fireEvent.change(screen.getByLabelText("Search tracks to add"), {
      target: { value: "Cobalt" },
    });
    const button = screen.getByRole("button", {
      name: "Cobalt Dreams already added",
    });
    const faces = iconSwapFaces(button);
    expect(faces).toHaveLength(2);
    expect(faces[0].className).toContain("opacity-0");
    expect(faces[0].getAttribute("aria-hidden")).toBe("true");
    expect(faces[1].className).toContain("opacity-100");
    expect(faces[1].getAttribute("aria-hidden")).toBe("false");
  });
});

describe("AddMusicPanel play affordance", () => {
  it("renders no play button — these rows only add, they never play", () => {
    render(
      <MockStudioProvider>
        <AddMusicPanel collection={MOCK_COLLECTIONS.find((c) => c.id === "c3")!} />
      </MockStudioProvider>
    );

    fireEvent.change(screen.getByLabelText("Search tracks to add"), {
      target: { value: "Cobalt" },
    });

    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
  });
});
