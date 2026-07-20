import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider, { useMockStudio } from "./MockStudioProvider";
import { MOCK_COLLECTIONS } from "./mock-data";
import CreatePlaylistFlow from "./CreatePlaylistFlow";

const BASELINE_COUNT = MOCK_COLLECTIONS.length + 1; // + LIKED_SONGS

/** Reads `collections.length` from the store so a test can assert the draft
 *  wizard writes nothing until the review step's confirm. */
function CollectionsCountProbe() {
  const { collections } = useMockStudio();
  return <div aria-label="collections count">{collections.length}</div>;
}

function renderFlow(onCreated = vi.fn()) {
  render(
    <MockStudioProvider>
      <CollectionsCountProbe />
      <CreatePlaylistFlow onCreated={onCreated} />
    </MockStudioProvider>
  );
  return onCreated;
}

function storeCount(): string {
  return screen.getByLabelText("collections count").textContent ?? "";
}

function goToStep2(name = "Rainy Tapes") {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
}

function goToStep3() {
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
}

describe("CreatePlaylistFlow", () => {
  it("blocks Next on step 1 until the name is non-blank", () => {
    renderFlow();
    const next = screen.getByRole("button", { name: "Next" });
    expect(next.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Rainy Tapes" },
    });
    expect(next.hasAttribute("disabled")).toBe(false);

    // whitespace-only must not satisfy the guard either
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "   " },
    });
    expect(next.hasAttribute("disabled")).toBe(true);
  });

  it("shows a cover swatch for every texture, defaulted and selectable", () => {
    renderFlow();
    // Default cover: tx-k-silk -> "Cover: silk", pressed.
    const defaultCover = screen.getByRole("button", { name: "Cover: silk" });
    expect(defaultCover.getAttribute("aria-pressed")).toBe("true");

    const marble = screen.getByRole("button", { name: "Cover: marble" });
    expect(marble.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(marble);
    expect(marble.getAttribute("aria-pressed")).toBe("true");
    expect(defaultCover.getAttribute("aria-pressed")).toBe("false");
  });

  it("carries the draft forward and back across all three steps", () => {
    renderFlow();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Rainy Tapes" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Tape loops for rain." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cover: marble" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" })); // -> step 2

    fireEvent.change(screen.getByLabelText("Search tracks to add"), {
      target: { value: "Cobalt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Cobalt Dreams" }));
    expect(screen.getByLabelText("1 track added")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next" })); // -> step 3
    expect(screen.getByText("Rainy Tapes")).toBeTruthy();
    expect(screen.getByText("Tape loops for rain.")).toBeTruthy();
    expect(screen.getByLabelText("1 track")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back" })); // -> step 2
    expect(screen.getByLabelText("1 track added")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back" })); // -> step 1
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
      "Rainy Tapes"
    );
    expect(
      (screen.getByLabelText("Description") as HTMLInputElement).value
    ).toBe("Tape loops for rain.");
    expect(
      screen.getByRole("button", { name: "Cover: marble" }).getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("lets a track be removed again from the draft", () => {
    renderFlow();
    goToStep2();

    fireEvent.change(screen.getByLabelText("Search tracks to add"), {
      target: { value: "Cobalt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Cobalt Dreams" }));
    expect(screen.getByLabelText("1 track added")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove Cobalt Dreams" })).toBeTruthy();

    // remove it back out via the same (now toggled) search-result button
    fireEvent.click(screen.getByRole("button", { name: "Remove Cobalt Dreams" }));
    expect(screen.getByLabelText("0 tracks added")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add Cobalt Dreams" })).toBeTruthy();
  });

  it("writes nothing to the store before the review step confirms", () => {
    renderFlow();
    expect(storeCount()).toBe(String(BASELINE_COUNT));

    goToStep2("Rainy Tapes");
    expect(storeCount()).toBe(String(BASELINE_COUNT));

    fireEvent.change(screen.getByLabelText("Search tracks to add"), {
      target: { value: "Cobalt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Cobalt Dreams" }));
    expect(storeCount()).toBe(String(BASELINE_COUNT));

    goToStep3();
    expect(storeCount()).toBe(String(BASELINE_COUNT));

    // only the review step's own confirm button writes
    fireEvent.click(screen.getByRole("button", { name: "Create playlist" }));
    expect(storeCount()).toBe(String(BASELINE_COUNT + 1));
  });

  it("confirms with the chosen texture and tracks, and hands the new collection to onCreated", () => {
    const onCreated = renderFlow();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Rainy Tapes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cover: marble" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" })); // -> step 2

    fireEvent.change(screen.getByLabelText("Search tracks to add"), {
      target: { value: "Cobalt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Cobalt Dreams" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" })); // -> step 3

    fireEvent.click(screen.getByRole("button", { name: "Create playlist" }));

    expect(onCreated).toHaveBeenCalledTimes(1);
    const created = onCreated.mock.calls[0][0];
    expect(created.title).toBe("Rainy Tapes");
    expect(created.texture).toBe("tx-k-marble");
    expect(created.trackIds).toEqual(["t2"]); // Cobalt Dreams
  });

  it("allows an empty track list — skipping step 2 creates a valid playlist", () => {
    const onCreated = renderFlow();

    goToStep2("Quiet Room");
    goToStep3();
    fireEvent.click(screen.getByRole("button", { name: "Create playlist" }));

    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onCreated.mock.calls[0][0].trackIds).toEqual([]);
  });
});
