import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import MockStudioProvider, { useMockStudio } from "./MockStudioProvider";
import { LIKED_SONGS, LIKED_SONGS_ID, MOCK_COLLECTIONS } from "./mock-data";
import CollectionMenu from "./CollectionMenu";

/** Surfaces the store's pinned flag so pinning is asserted as state. */
function PinProbe({ collectionId }: { collectionId: string }) {
  const { collections } = useMockStudio();
  const c = collections.find((x) => x.id === collectionId)!;
  return <span data-testid="pinned">{String(c.pinned)}</span>;
}

function Harness({ collectionId }: { collectionId: string }) {
  const { collections } = useMockStudio();
  const c = collections.find((x) => x.id === collectionId)!;
  return <CollectionMenu collection={c} />;
}

/** Liked Songs — used by the share tests below, which only care about the
 *  share surface and don't touch pinning. */
function renderMenu() {
  return render(
    <MockStudioProvider>
      <PinProbe collectionId={LIKED_SONGS_ID} />
      <Harness collectionId={LIKED_SONGS_ID} />
    </MockStudioProvider>
  );
}

/** An ordinary, non-system collection — used by the pin tests below, since
 *  Liked Songs no longer offers pin/unpin at all (it is permanent). */
function renderPinMenu() {
  const id = MOCK_COLLECTIONS[0].id;
  return render(
    <MockStudioProvider>
      <PinProbe collectionId={id} />
      <Harness collectionId={id} />
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
    // Was exercised against Liked Songs; Liked Songs no longer offers pin/
    // unpin at all now that it's permanent (see the "system collection"
    // test below), so this now targets an ordinary collection instead — the
    // toggle behaviour itself is unchanged.
    renderPinMenu();
    const before = screen.getByTestId("pinned").textContent;

    openMenu();
    fireEvent.click(screen.getByText(/^(Pin to top|Unpin)$/));

    expect(screen.getByTestId("pinned").textContent).not.toBe(before);
  });

  it("labels the pin item by what it will do", () => {
    // Was exercised against Liked Songs (seeded pinned, so "Unpin" was
    // offered); moved to an ordinary collection for the same reason as above.
    renderPinMenu();
    openMenu();
    expect(screen.getByText("Pin to top")).toBeTruthy();
    expect(screen.queryByText("Unpin")).toBeNull();
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

  it("offers no pin or unpin for a system collection", async () => {
    // Liked Songs is permanent: there is no state in which unpinning it is a
    // thing the user can mean.
    render(
      <MockStudioProvider>
        <CollectionMenu collection={{ ...LIKED_SONGS, system: true }} />
      </MockStudioProvider>
    );
    fireEvent.pointerDown(screen.getByLabelText(`More for ${LIKED_SONGS.title}`), {
      button: 0,
    });
    expect(await screen.findByText("Share")).toBeInTheDocument();
    expect(screen.queryByText("Unpin")).toBeNull();
    expect(screen.queryByText("Pin to top")).toBeNull();
  });

  it("still offers pin for an ordinary collection", async () => {
    render(
      <MockStudioProvider>
        <CollectionMenu collection={MOCK_COLLECTIONS[0]} />
      </MockStudioProvider>
    );
    fireEvent.pointerDown(
      screen.getByLabelText(`More for ${MOCK_COLLECTIONS[0].title}`),
      { button: 0 }
    );
    expect(await screen.findByText("Pin to top")).toBeInTheDocument();
  });
});
