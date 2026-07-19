import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import { LIKED_SONGS } from "@/components/studio/screens/mock-data";
import CollectionDetail from "./CollectionDetail";

describe("CollectionDetail", () => {
  it("does not nest a play button inside each row's role=button wrapper", () => {
    // TrackRow's hover overlay is a real <button aria-label="Play">. Nested
    // inside the row's own role="button" div it's invalid HTML and a dead,
    // near-unlabelled keyboard stop — opted out via playable={false}.
    render(
      <MockStudioProvider>
        <CollectionDetail collection={LIKED_SONGS} />
      </MockStudioProvider>
    );

    expect(screen.queryAllByLabelText("Play")).toHaveLength(0);
    // The wrapper's own accessible name must still be present for every row.
    expect(
      screen.getByRole("button", { name: "Play Cobalt Dreams" })
    ).toBeTruthy();
  });

  it("shows the collection's own title as the album for every row (desktop variant)", () => {
    render(
      <MockStudioProvider>
        <CollectionDetail collection={LIKED_SONGS} />
      </MockStudioProvider>
    );

    // LIKED_SONGS has 5 tracks; every row's album column should read the
    // collection's title, not a fabricated per-track value (MockTrack has
    // no album field).
    expect(screen.getAllByText("Liked Songs").length).toBeGreaterThanOrEqual(5);
  });
});
