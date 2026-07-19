import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";
import PlayerSearchDrawer from "./PlayerSearchDrawer";

describe("PlayerSearchDrawer", () => {
  it("does not nest a play button inside each result's role=button wrapper", () => {
    // TrackRow's hover overlay is a real <button aria-label="Play">. Nested
    // inside the result's own role="button" div it's invalid HTML and a
    // dead, near-unlabelled keyboard stop — opted out via playable={false}.
    render(
      <MockStudioProvider>
        <PlayerSearchDrawer
          open
          onOpenChange={() => {}}
          initialQuery="Cobalt"
        />
      </MockStudioProvider>
    );

    expect(screen.queryAllByLabelText("Play")).toHaveLength(0);
    // The wrapper's own accessible name must still be present.
    expect(
      screen.getByRole("button", { name: "Play Cobalt Dreams" })
    ).toBeTruthy();
  });
});
