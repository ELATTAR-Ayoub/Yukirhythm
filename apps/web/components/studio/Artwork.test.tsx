import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import Artwork from "./Artwork";

describe("Artwork", () => {
  it("renders the image when a src is given", () => {
    render(<Artwork src="https://cdn/a.jpg" texture="tx-k-silk" alt="Realize" />);
    const img = screen.getByRole("img", { name: "Realize" });
    expect(img).toHaveAttribute("src", "https://cdn/a.jpg");
  });

  it("renders the texture when no src is given", () => {
    const { container } = render(
      <Artwork src="" texture="tx-k-silk" alt="Realize" />
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.firstChild).toBeTruthy();
  });

  it("falls back to the texture when the image fails to load", () => {
    // A 404 from the thumbnail CDN must not leave a blank square — that is
    // strictly worse than the generated texture it replaced.
    const { container } = render(
      <Artwork src="https://cdn/gone.jpg" texture="tx-k-silk" alt="Realize" />
    );
    fireEvent.error(screen.getByRole("img", { name: "Realize" }));
    expect(container.querySelector("img")).toBeNull();
  });

  it("retries when the src changes after a failure", () => {
    // Without resetting on src change, one broken thumbnail would poison the
    // element for every later track that reuses it (the disc faces do).
    const { container, rerender } = render(
      <Artwork src="https://cdn/gone.jpg" texture="tx-k-silk" alt="A" />
    );
    fireEvent.error(screen.getByRole("img", { name: "A" }));
    expect(container.querySelector("img")).toBeNull();

    rerender(<Artwork src="https://cdn/good.jpg" texture="tx-k-silk" alt="B" />);
    expect(screen.getByRole("img", { name: "B" })).toHaveAttribute(
      "src",
      "https://cdn/good.jpg"
    );
  });

  it("marks decorative artwork aria-hidden with an empty alt", () => {
    render(<Artwork src="https://cdn/a.jpg" texture="tx-k-silk" alt="" />);
    expect(screen.queryByRole("img")).toBeNull();
  });
});
