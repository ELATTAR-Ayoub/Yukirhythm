import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Logo from "@/components/Logo";

describe("Logo", () => {
  it("renders a link to the home page", () => {
    render(<Logo />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/");
  });
});
