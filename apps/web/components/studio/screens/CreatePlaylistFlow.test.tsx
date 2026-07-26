import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

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

function addTag(input: HTMLElement, raw: string) {
  fireEvent.change(input, { target: { value: raw } });
  fireEvent.keyDown(input, { key: "Enter" });
}

async function searchAndAdd(query: string, title: string) {
  fireEvent.change(screen.getByLabelText("Search tracks to add"), {
    target: { value: query },
  });
  fireEvent.click(await screen.findByRole("button", { name: `Add ${title}` }));
}

/** Pulls the `/textures/NAME.png` name out of every element's inline
 *  `background-image` at or under `el`, in DOM order — how the tests
 *  confirm the review step's cover art is a mosaic (2+ entries) rather
 *  than the single-texture fallback (1 entry), without relying on CSS
 *  actually computing anything under jsdom. Checks `el` itself too: a
 *  single-texture render puts the style on the root Texture is handed
 *  directly, not on a descendant. */
function renderedTextures(el: HTMLElement): string[] {
  const nodes = [
    el,
    ...Array.from(el.querySelectorAll<HTMLElement>("[style]")),
  ];
  return nodes
    .map(
      (node) => node.style.backgroundImage.match(/textures\/([\w-]+)\.png/)?.[1]
    )
    .filter((x): x is string => Boolean(x));
}

/** The review step's cover art box — `.w-20.h-20` is unique to it (the
 *  texture swatch grid and track rows use different sizes). */
function coverArt(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>(".w-20.h-20");
  if (!el) throw new Error("review cover art not found");
  return el;
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

  it("carries the draft forward and back across all three steps", async () => {
    renderFlow();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Rainy Tapes" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Tape loops for rain." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cover: marble" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" })); // -> step 2

    await searchAndAdd("Cobalt", "Cobalt Dreams");
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
      screen
        .getByRole("button", { name: "Cover: marble" })
        .getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("lets a track be removed again from the draft", async () => {
    renderFlow();
    goToStep2();

    await searchAndAdd("Cobalt", "Cobalt Dreams");
    expect(screen.getByLabelText("1 track added")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Remove Cobalt Dreams" })
    ).toBeTruthy();

    // remove it back out via the same (now toggled) search-result button
    const remove = screen.getByRole("button", {
      name: "Remove Cobalt Dreams",
    });
    await waitFor(() => expect(remove).not.toBeDisabled());
    fireEvent.click(remove);
    expect(screen.getByLabelText("0 tracks added")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Add Cobalt Dreams" })
    ).toBeTruthy();
  });

  it("writes nothing to the store before the review step confirms", async () => {
    renderFlow();
    expect(storeCount()).toBe(String(BASELINE_COUNT));

    goToStep2("Rainy Tapes");
    expect(storeCount()).toBe(String(BASELINE_COUNT));

    await searchAndAdd("Cobalt", "Cobalt Dreams");
    expect(storeCount()).toBe(String(BASELINE_COUNT));

    goToStep3();
    expect(storeCount()).toBe(String(BASELINE_COUNT));

    // only the review step's own confirm button writes
    fireEvent.click(screen.getByRole("button", { name: "Create playlist" }));
    expect(storeCount()).toBe(String(BASELINE_COUNT + 1));
  });

  it("confirms with the chosen texture and tracks, and hands the new collection to onCreated", async () => {
    const onCreated = renderFlow();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Rainy Tapes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cover: marble" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" })); // -> step 2

    await searchAndAdd("Cobalt", "Cobalt Dreams");
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

  describe("tags", () => {
    it("turns Enter into a chip, trimmed and lowercased", () => {
      renderFlow();
      const input = screen.getByLabelText("Tags");
      addTag(input, "  Lofi  ");

      expect(screen.getByText("lofi")).toBeTruthy();
      expect((input as HTMLInputElement).value).toBe("");
    });

    it("ignores a blank tag and rejects a duplicate (case-insensitive)", () => {
      renderFlow();
      const input = screen.getByLabelText("Tags");

      addTag(input, "   ");
      expect(
        screen.queryAllByRole("button", { name: /^Remove / })
      ).toHaveLength(0);

      addTag(input, "chill");
      addTag(input, "Chill");
      expect(
        screen.queryAllByRole("button", { name: /^Remove / })
      ).toHaveLength(1);
      expect(screen.getByText("chill")).toBeTruthy();
    });

    it("removes the right chip from its own x, leaving the others", () => {
      renderFlow();
      const input = screen.getByLabelText("Tags");
      addTag(input, "night");
      addTag(input, "focus");
      addTag(input, "chill");

      fireEvent.click(screen.getByRole("button", { name: "Remove focus" }));

      expect(screen.queryByText("focus")).toBeNull();
      expect(screen.getByText("night")).toBeTruthy();
      expect(screen.getByText("chill")).toBeTruthy();
    });

    it("pops the last chip on Backspace when the field is empty", () => {
      renderFlow();
      const input = screen.getByLabelText("Tags");
      addTag(input, "lofi");
      addTag(input, "night");

      fireEvent.keyDown(input, { key: "Backspace" });

      expect(screen.queryByText("night")).toBeNull();
      expect(screen.getByText("lofi")).toBeTruthy();
    });

    it("leaves an in-progress chip alone on Backspace — only an empty field pops one", () => {
      renderFlow();
      const input = screen.getByLabelText("Tags");
      addTag(input, "lofi");
      fireEvent.change(input, { target: { value: "nig" } });

      fireEvent.keyDown(input, { key: "Backspace" });

      expect(screen.getByText("lofi")).toBeTruthy();
      expect((input as HTMLInputElement).value).toBe("nig");
    });

    it("reaches createCollection as an array, in the order they were added", () => {
      const onCreated = renderFlow();
      fireEvent.change(screen.getByLabelText("Name"), {
        target: { value: "Rainy Tapes" },
      });
      const input = screen.getByLabelText("Tags");
      addTag(input, "lofi");
      addTag(input, "night");

      goToStep2("Rainy Tapes"); // step 1 -> step 2 (name already set above)
      goToStep3(); // step 2 -> step 3
      fireEvent.click(screen.getByRole("button", { name: "Create playlist" }));

      expect(onCreated.mock.calls[0][0].tags).toEqual(["lofi", "night"]);
    });
  });

  describe("mosaic cover", () => {
    it("keeps Mosaic disabled with a hint until the draft has a track", () => {
      renderFlow();
      const mosaic = screen.getByRole("button", { name: "Mosaic" });
      expect(mosaic.hasAttribute("disabled")).toBe(true);
      expect(
        screen.getByText("Add tracks in the next step to build a mosaic cover.")
      ).toBeTruthy();
    });

    it("enables Mosaic once a track exists, and confirming persists cover: mosaic", async () => {
      const onCreated = renderFlow();
      goToStep2("Rainy Tapes");
      await searchAndAdd("Cobalt", "Cobalt Dreams");
      fireEvent.click(screen.getByRole("button", { name: "Back" })); // -> step 1

      const mosaic = screen.getByRole("button", { name: "Mosaic" });
      expect(mosaic.hasAttribute("disabled")).toBe(false);
      fireEvent.click(mosaic);
      expect(mosaic.getAttribute("aria-pressed")).toBe("true");

      fireEvent.click(screen.getByRole("button", { name: "Next" })); // -> step 2
      goToStep3(); // -> step 3
      fireEvent.click(screen.getByRole("button", { name: "Create playlist" }));

      expect(onCreated).toHaveBeenCalledTimes(1);
      expect(onCreated.mock.calls[0][0].cover).toBe("mosaic");
    });

    it("reflects a track added after mosaic was chosen — review shows both, in order", async () => {
      renderFlow();
      goToStep2("Rainy Tapes");
      await searchAndAdd("Cobalt", "Cobalt Dreams"); // t2, tx-k-marble
      fireEvent.click(screen.getByRole("button", { name: "Back" })); // -> step 1

      fireEvent.click(screen.getByRole("button", { name: "Mosaic" }));
      fireEvent.click(screen.getByRole("button", { name: "Next" })); // -> step 2

      await searchAndAdd("Midnight", "Midnight Snowfall"); // t1, tx-k2-vinyl

      goToStep3();

      expect(renderedTextures(coverArt(document.body))).toEqual([
        "tx-k-marble",
        "tx-k2-vinyl",
      ]);
    });
  });
});
