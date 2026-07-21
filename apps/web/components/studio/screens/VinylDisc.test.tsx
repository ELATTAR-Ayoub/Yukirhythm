import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import VinylDisc from "./VinylDisc";

function renderDisc(expanded: boolean) {
  return render(
    <div className="relative overflow-hidden">
      <VinylDisc
        texture="tx-k-silk"
        trackKey="t1"
        direction={null}
        spinning={false}
        expanded={expanded}
        onToggle={() => {}}
      >
        <span>Mint Circuit</span>
        <span>Glitch Sakura</span>
      </VinylDisc>
    </div>
  );
}

/** The scrim/copy layer, found the way the component distinguishes it. */
function overlayOf(container: HTMLElement) {
  return Array.from(container.querySelectorAll("span")).find((el) =>
    el.className.includes("pb-24")
  );
}

describe("VinylDisc overlay copy", () => {
  it("keeps the copy outside the disc button", () => {
    // The disc scales to 1.2 when expanded. While the copy lived inside that
    // button it inherited the scale: the type grew with the artwork and its
    // left edge was clipped by the card, so the artist rendered as a fragment
    // and the title lost its first characters.
    const { container } = renderDisc(true);
    const button = screen.getByRole("button", { name: "Shrink artwork" });
    const overlay = overlayOf(container);

    expect(overlay).toBeTruthy();
    expect(button.contains(overlay!)).toBe(false);
  });

  it("never takes pointer events, so the disc stays tappable", () => {
    // As a sibling the overlay lies over the disc; if it accepted pointer
    // events it would swallow the tap that shrinks the artwork again.
    const { container } = renderDisc(true);
    expect(overlayOf(container)!.className).toContain("pointer-events-none");
  });

  it("renders the copy in both states", () => {
    renderDisc(false);
    expect(screen.getByText("Glitch Sakura")).toBeTruthy();
  });

  it("scales the disc only when expanded", () => {
    renderDisc(true);
    expect(
      screen.getByRole("button", { name: "Shrink artwork" }).className
    ).toContain("scale-[1.2]");

    renderDisc(false);
    expect(
      screen.getByRole("button", { name: "Expand artwork" }).className
    ).toContain("scale-100");
  });
});

describe("VinylDisc artwork", () => {
  it("renders the track's artwork on the disc face", () => {
    const { container } = render(
      <VinylDisc
        texture="tx-k-silk"
        artUrl="https://cdn/realize.jpg"
        trackKey="abc123"
        direction={null}
        spinning={false}
        expanded={false}
        onToggle={() => {}}
      />
    );
    const img = container.querySelector('img[src="https://cdn/realize.jpg"]');
    expect(img).toBeTruthy();
  });

  it("swaps artwork with the texture when the track changes", () => {
    // The two disc layers persist across a swap by design. Artwork has to ride
    // on the layer or the new track would wear the old track's photo.
    const { container, rerender } = render(
      <VinylDisc
        texture="tx-k-silk"
        artUrl="https://cdn/one.jpg"
        trackKey="one"
        direction={null}
        spinning={false}
        expanded={false}
        onToggle={() => {}}
      />
    );
    rerender(
      <VinylDisc
        texture="tx-k2-vinyl"
        artUrl="https://cdn/two.jpg"
        trackKey="two"
        direction={null}
        spinning={false}
        expanded={false}
        onToggle={() => {}}
      />
    );
    expect(container.querySelector('img[src="https://cdn/two.jpg"]')).toBeTruthy();
    expect(container.querySelector('img[src="https://cdn/one.jpg"]')).toBeNull();
  });
});
