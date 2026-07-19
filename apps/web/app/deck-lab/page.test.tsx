// apps/web/app/deck-lab/page.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The WebGL scene cannot run in jsdom — stub it out.
vi.mock("@/components/studio/deck/CarouselDeckScene", () => ({
  default: () => <div data-testid="scene" />,
}));

import DeckLabPage from "./page";

describe("deck-lab page", () => {
  it("renders the first mock track", () => {
    render(<DeckLabPage />);
    expect(screen.getByText("A.D. Police Opening")).toBeInTheDocument();
    expect(screen.getByText("KISIDAKYOUDAN")).toBeInTheDocument();
  });

  it("advances to the next track on next", () => {
    render(<DeckLabPage />);
    fireEvent.click(screen.getByLabelText("Next track"));
    expect(screen.getByText("Night Cruise '86")).toBeInTheDocument();
  });

  it("goes to the last track on previous (wrap-around)", () => {
    render(<DeckLabPage />);
    fireEvent.click(screen.getByLabelText("Previous track"));
    expect(screen.getByText("Last Train Home")).toBeInTheDocument();
  });
});
