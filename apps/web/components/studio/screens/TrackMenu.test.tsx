import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import MockStudioProvider, { useMockStudio } from "./MockStudioProvider";
import { MOCK_COLLECTIONS, MOCK_TRACKS } from "./mock-data";
import TrackMenu from "./TrackMenu";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const TRACK = MOCK_TRACKS[0];
const COLLECTION = MOCK_COLLECTIONS[0];

/** Reads a collection's membership so the checklist is asserted as state. */
function MembershipProbe({ collectionId }: { collectionId: string }) {
  const { collections } = useMockStudio();
  const c = collections.find((x) => x.id === collectionId)!;
  return <span data-testid="members">{c.trackIds.join(",")}</span>;
}

function renderMenu() {
  return render(
    <MockStudioProvider>
      <MembershipProbe collectionId={COLLECTION.id} />
      <TrackMenu track={TRACK} />
    </MockStudioProvider>
  );
}

const members = () => screen.getByTestId("members").textContent!.split(",");

/** Radix opens on pointerdown; a bare click never opens the menu in jsdom. */
const openMenu = () =>
  fireEvent.pointerDown(screen.getByLabelText(`More for ${TRACK.title}`), {
    button: 0,
  });

describe("TrackMenu", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
    window.HTMLElement.prototype.releasePointerCapture = () => {};
    window.HTMLElement.prototype.scrollIntoView = () => {};
  });

  it("shares a dedicated public track page", () => {
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Share"));

    const dialog = within(screen.getByRole("dialog"));
    expect(
      dialog.getByText(new RegExp(`/share/track/${TRACK.id}`))
    ).toBeTruthy();
    expect(dialog.getByText("Copy link")).toBeTruthy();
  });

  it("does not expose queue context when sharing a track", () => {
    render(
      <MockStudioProvider>
        <TrackMenu track={TRACK} queueIndex={0} />
      </MockStudioProvider>
    );
    fireEvent.pointerDown(screen.getByLabelText(`More for ${TRACK.title}`), {
      button: 0,
    });
    fireEvent.click(screen.getByText("Share"));

    const dialog = within(screen.getByRole("dialog"));
    const urlNode = dialog.getByText(/^https?:\/\//);
    expect(urlNode.textContent).toBe(
      `${window.location.origin}/share/track/${TRACK.id}`
    );
  });

  it("opens a checklist of playlists", () => {
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Add to playlist"));

    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getAllByRole("checkbox").length).toBeGreaterThan(1);
    expect(screen.getByRole("dialog").className).toContain(
      "max-h-[calc(100dvh-2rem)]"
    );
    expect(screen.getByRole("dialog").className).toContain(
      "w-[calc(100vw-2rem)]"
    );
  });

  it("adds and removes the track from a playlist with visible pending feedback", async () => {
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Add to playlist"));

    const dialog = within(screen.getByRole("dialog"));
    const row = dialog.getByRole("checkbox", { name: COLLECTION.title });
    const startsIn = COLLECTION.trackIds.includes(TRACK.id);
    expect(row.getAttribute("aria-checked")).toBe(String(startsIn));

    fireEvent.click(row);
    expect(members().includes(TRACK.id)).toBe(!startsIn);
    expect(row.getAttribute("aria-busy")).toBe("true");

    await waitFor(() => expect(row).not.toBeDisabled());
    fireEvent.click(row);
    expect(members().includes(TRACK.id)).toBe(startsIn);
  });

  it("names the like item by what the click will do", () => {
    renderMenu();
    openMenu();
    // MOCK_TRACKS[0] is not seeded into Liked Songs, so the offer is "Like".
    expect(screen.getByText("Like")).toBeTruthy();
    fireEvent.click(screen.getByText("Like"));

    openMenu();
    expect(screen.getByText("Remove from Liked Songs")).toBeTruthy();
  });

  it("omits podcasts from the checklist", () => {
    // Podcasts hold episodes, not tracks — offering them would be a lie.
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Add to playlist"));

    const dialog = within(screen.getByRole("dialog"));
    const podcast = MOCK_COLLECTIONS.find((c) => c.kind === "podcast");
    if (podcast) {
      expect(
        dialog.queryByRole("checkbox", { name: podcast.title })
      ).toBeNull();
    }
  });

  it("offers Remove from queue only when the row is in the queue", async () => {
    // Fixture quirk: as this file's own `openMenu` helper documents, Radix
    // opens its dropdown on pointerdown, not click — a bare `fireEvent.click`
    // never opens the menu in jsdom, leaving "Like" unfindable regardless of
    // `queueIndex`. Swapped in the same pointerDown the rest of this file
    // uses; the assertion's intent (queueIndex absent -> no Remove item) is
    // unchanged.
    render(
      <MockStudioProvider>
        <TrackMenu track={MOCK_TRACKS[0]} />
      </MockStudioProvider>
    );
    fireEvent.pointerDown(
      screen.getByLabelText(`More for ${MOCK_TRACKS[0].title}`),
      { button: 0 }
    );
    expect(await screen.findByText("Like")).toBeInTheDocument();
    expect(screen.queryByText("Remove from queue")).toBeNull();
  });

  it("removes the exact queue position it was given", async () => {
    function Probe() {
      const { queue } = useMockStudio();
      return <div data-testid="queue-len">{queue.length}</div>;
    }

    render(
      <MockStudioProvider>
        <TrackMenu track={MOCK_TRACKS[0]} queueIndex={0} />
        <Probe />
      </MockStudioProvider>
    );
    const before = Number(screen.getByTestId("queue-len").textContent);

    fireEvent.pointerDown(
      screen.getByLabelText(`More for ${MOCK_TRACKS[0].title}`),
      { button: 0 }
    );
    fireEvent.click(await screen.findByText("Remove from queue"));

    expect(Number(screen.getByTestId("queue-len").textContent)).toBe(
      before - 1
    );
  });
});
