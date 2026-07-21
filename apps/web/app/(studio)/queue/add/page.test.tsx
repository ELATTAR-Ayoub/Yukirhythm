import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import MockStudioProvider, {
  useMockStudio,
} from "@/components/studio/screens/MockStudioProvider";
import {
  MOCK_COLLECTIONS,
  MOCK_TRACKS,
  getCollectionTracks,
} from "@/components/studio/screens/mock-data";
import { QUEUE } from "@/components/studio/shell/routes";
import QueueAddScreen from "./page";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/queue/add",
  useRouter: () => ({ push }),
}));

/** Surfaces the queue and a collection's size so the test can prove where a
 *  track landed — and, just as importantly, where it did not. */
function Probe() {
  const { queue, collections } = useMockStudio();
  const first = collections.find((c) => c.id === MOCK_COLLECTIONS[0].id);
  return (
    <>
      <div data-testid="queue">{queue.map((t) => t.id).join(",")}</div>
      <div data-testid="c0-size">{first?.trackIds.length ?? -1}</div>
    </>
  );
}

/** Narrows the running queue to one collection's tracks, the same way
 *  playback normally would, so the third test can prove a track lands in the
 *  queue rather than starting out already there — the provider's cold-start
 *  queue is the *entire* mock library, so every MOCK_TRACKS entry reads
 *  "already queued" until something narrower has played. */
function Seed({ source }: { source: (typeof MOCK_COLLECTIONS)[number] }) {
  const { play } = useMockStudio();
  const first = getCollectionTracks(source)[0];
  return (
    <button onClick={() => play(first, source)}>seed</button>
  );
}

describe("queue add screen", () => {
  beforeEach(() => push.mockClear());

  it("offers a back route to the queue and a search field", () => {
    render(
      <MockStudioProvider>
        <QueueAddScreen />
      </MockStudioProvider>
    );
    expect(screen.getByLabelText("Back")).toHaveAttribute("href", QUEUE);
    expect(screen.getByLabelText("Search tracks to queue")).toBeInTheDocument();
  });

  it("never renders the collection-not-found state", () => {
    // The whole point of this route: the queue has no id to look up, so the
    // add flow must not go looking for one.
    render(
      <MockStudioProvider>
        <QueueAddScreen />
      </MockStudioProvider>
    );
    expect(screen.queryByText("Collection not found")).toBeNull();
  });

  it("adds a searched track to the running queue and to no playlist", async () => {
    // Seeded from c3 ("Pixel Podcasts", tracks t3+t12 only) so the queue
    // starts narrower than the full library — target (t1) is genuinely
    // absent from it, unlike the provider's cold-start queue.
    const seedSource = MOCK_COLLECTIONS[2];
    const target = MOCK_TRACKS[0];
    const sizeBefore = MOCK_COLLECTIONS[0].trackIds.length;

    render(
      <MockStudioProvider>
        <Seed source={seedSource} />
        <QueueAddScreen />
        <Probe />
      </MockStudioProvider>
    );

    fireEvent.click(screen.getByText("seed"));

    fireEvent.change(screen.getByLabelText("Search tracks to queue"), {
      target: { value: target.title },
    });

    const add = await screen.findByLabelText(
      `Add ${target.title} to queue`,
      {},
      { timeout: 3000 }
    );
    fireEvent.click(add);

    await waitFor(() => {
      expect(screen.getByTestId("queue").textContent).toContain(target.id);
    });
    expect(screen.getByTestId("c0-size").textContent).toBe(String(sizeBefore));
  });
});
