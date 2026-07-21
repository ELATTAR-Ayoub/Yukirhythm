import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import MockStudioProvider, { useMockStudio } from "./MockStudioProvider";
import { LIKED_SONGS_ID } from "./mock-data";
import CollectionMenu from "./CollectionMenu";

/** Surfaces the store's pinned flag so pinning is asserted as state. */
function PinProbe() {
  const { collections } = useMockStudio();
  const c = collections.find((x) => x.id === LIKED_SONGS_ID)!;
  return <span data-testid="pinned">{String(c.pinned)}</span>;
}

function Harness() {
  const { collections } = useMockStudio();
  const c = collections.find((x) => x.id === LIKED_SONGS_ID)!;
  return <CollectionMenu collection={c} />;
}

function renderMenu() {
  return render(
    <MockStudioProvider>
      <PinProbe />
      <Harness />
    </MockStudioProvider>
  );
}

/** Radix opens on pointerdown; a bare click never opens the menu in jsdom. */
const openMenu = () =>
  fireEvent.pointerDown(screen.getByLabelText(/^More for /), { button: 0 });

describe("CollectionMenu", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
    window.HTMLElement.prototype.releasePointerCapture = () => {};
    window.HTMLElement.prototype.scrollIntoView = () => {};
  });

  afterEach(() => vi.restoreAllMocks());

  it("pins and unpins the collection", () => {
    renderMenu();
    const before = screen.getByTestId("pinned").textContent;

    openMenu();
    fireEvent.click(screen.getByText(/^(Pin to top|Unpin)$/));

    expect(screen.getByTestId("pinned").textContent).not.toBe(before);
  });

  it("labels the pin item by what it will do", () => {
    renderMenu();
    openMenu();
    // Liked Songs seeds pinned, so the action offered is Unpin.
    expect(screen.getByText("Unpin")).toBeTruthy();
    expect(screen.queryByText("Pin to top")).toBeNull();
  });

  it("shows the link before sharing it", () => {
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Share"));

    const dialog = within(screen.getByRole("dialog"));
    // Inspectable, and still recoverable if the copy fails.
    expect(dialog.getByText(/\/playlist\//)).toBeTruthy();
    expect(dialog.getByText("Copy link")).toBeTruthy();
  });

  it("copies the link to the clipboard", async () => {
    // Typed parameter, not `vi.fn(() => …)`: without it the mock's call
    // tuple is empty and the argument assertion below cannot type-check.
    const writeText = vi.fn((_text: string) => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Share"));
    fireEvent.click(screen.getByText("Copy link"));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain(
      "/playlist/liked"
    );
  });

  it("offers share targets that open rather than post", () => {
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Share"));

    const dialog = within(screen.getByRole("dialog"));
    const x = dialog.getByText("X").closest("a")!;
    // An intent URL: the destination still requires the user to confirm, so
    // nothing is published by clicking here.
    expect(x.getAttribute("href")).toContain("x.com/intent");
    expect(x.getAttribute("target")).toBe("_blank");
    expect(x.getAttribute("rel")).toContain("noopener");
  });
});
