import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import {
  LIKED_SONGS,
  MOCK_COLLECTIONS,
} from "@/components/studio/screens/mock-data";
import AddMusicPanel from "./AddMusicPanel";

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

describe("AddMusicPanel add/added icon", () => {
  it("shows the add face through IconSwap for a track not yet in the collection", async () => {
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
    // Results arrive from the provider's search, which is debounced and async
    // even in the mock — a synchronous get would race the first keystroke.
    const button = await screen.findByRole("button", {
      name: "Add Cobalt Dreams",
    });
    const faces = iconSwapFaces(button);
    expect(faces).toHaveLength(2);
    expect(faces[0].className).toContain("opacity-100");
    expect(faces[0].getAttribute("aria-hidden")).toBe("false");
    expect(faces[1].className).toContain("opacity-0");
    expect(faces[1].getAttribute("aria-hidden")).toBe("true");
  });

  it("rolls the strip to the added face for a track already in the collection", async () => {
    // LIKED_SONGS already contains t2 "Cobalt Dreams".
    render(
      <MockStudioProvider>
        <AddMusicPanel collection={LIKED_SONGS} />
      </MockStudioProvider>
    );

    fireEvent.change(screen.getByLabelText("Search tracks to add"), {
      target: { value: "Cobalt" },
    });
    const button = await screen.findByRole("button", {
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
  it("renders no play button — these rows only add, they never play", async () => {
    render(
      <MockStudioProvider>
        <AddMusicPanel
          collection={MOCK_COLLECTIONS.find((c) => c.id === "c3")!}
        />
      </MockStudioProvider>
    );

    fireEvent.change(screen.getByLabelText("Search tracks to add"), {
      target: { value: "Cobalt" },
    });

    // Wait for results first: asserting absence before the search resolves
    // would pass against an empty list and prove nothing.
    await screen.findByRole("button", { name: "Add Cobalt Dreams" });
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
  });
});

describe("AddMusicPanel searching state", () => {
  it("shows skeleton rows while a search is in flight", async () => {
    // "No matches" during a request in flight is an answer to a question that
    // was never asked; a skeleton is a promise that content is coming.
    render(
      <MockStudioProvider>
        <AddMusicPanel />
      </MockStudioProvider>
    );

    fireEvent.change(screen.getByLabelText("Search tracks to queue"), {
      target: { value: "mid" },
    });

    const list = await screen.findByLabelText("Searching");
    expect(list).toBeInTheDocument();
    expect(screen.queryByText("No matches")).toBeNull();
  });
});

describe("AddMusicPanel mobile keyboard", () => {
  it("uses the Search key and dismisses the keyboard on submit", () => {
    render(
      <MockStudioProvider>
        <AddMusicPanel />
      </MockStudioProvider>
    );
    const input = screen.getByLabelText(
      "Search tracks to queue"
    ) as HTMLInputElement;
    expect(input.type).toBe("search");
    expect(input.getAttribute("enterkeyhint")).toBe("search");
    input.focus();

    fireEvent.submit(
      screen.getByRole("search", { name: "Queue music search" })
    );

    expect(document.activeElement).not.toBe(input);
  });
});
