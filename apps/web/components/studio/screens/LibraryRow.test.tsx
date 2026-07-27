import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { ImportSpotifyPlaylistTile, LibraryRowCard } from "./LibraryRow";
import { LIKED_SONGS, MOCK_COLLECTIONS } from "./mock-data";

describe("LibraryRowCard", () => {
  it("shows the Pinned badge for an ordinary pinned collection", () => {
    const pinned = { ...MOCK_COLLECTIONS[0], pinned: true };
    render(<LibraryRowCard collection={pinned} />);
    expect(screen.getByLabelText("Pinned")).toBeInTheDocument();
  });

  it("does not show a Pinned badge for a system collection", () => {
    // Liked Songs sets pinned: true so filterLibrary's ranking and any
    // pinned-first logic still work, but it can't be unpinned (CollectionMenu
    // hides the pin/unpin item for system collections) — a "Pinned" badge
    // would advertise a state the user has no control over.
    const liked = { ...LIKED_SONGS, system: true, pinned: true };
    render(<LibraryRowCard collection={liked} />);
    expect(screen.queryByLabelText("Pinned")).toBeNull();
  });
});

describe("ImportSpotifyPlaylistTile", () => {
  it("uses the Spotify brand icon", () => {
    render(<ImportSpotifyPlaylistTile onClick={() => {}} />);

    const button = screen.getByRole("button", {
      name: /import spotify playlist/i,
    });
    expect(button.querySelector('svg[data-brand="spotify"]')).not.toBeNull();
  });
});
