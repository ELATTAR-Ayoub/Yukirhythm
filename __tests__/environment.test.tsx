import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("test environment", () => {
  it("renders React into jsdom and matchers work", () => {
    render(<button>Play</button>);
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });
});
