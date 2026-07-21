import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import Artwork from "./Artwork";
import Texture from "@/components/studio/Texture";

// RTL's rerender() is wrapped in act(), which flushes pending useEffects
// synchronously before returning — so a plain "does the DOM show the image
// after rerender" assertion can't tell an effect-based reset from a
// render-time one; both converge to the same final DOM before the test can
// look. Spying on Texture's render calls exposes the intermediate commit
// instead: an effect-based reset still paints <Texture> once, mid-swap,
// before the effect corrects it on a second pass within the same act().
vi.mock("@/components/studio/Texture", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/studio/Texture")>();
  return { ...actual, default: vi.fn(actual.default) };
});

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

  it("never paints the texture on the same commit as a new src", () => {
    // The disc faces stay mounted across track changes, so a stale `failed`
    // would flash the texture on every track after one bad thumbnail. If the
    // reset happens in an effect, React still renders <Texture> once for the
    // new src before the effect fires and corrects it on a second pass.
    const textureSpy = vi.mocked(Texture);
    const { rerender } = render(
      <Artwork src="https://cdn/gone.jpg" texture="tx-k-silk" alt="A" />
    );
    fireEvent.error(screen.getByRole("img", { name: "A" }));
    textureSpy.mockClear();

    rerender(<Artwork src="https://cdn/good.jpg" texture="tx-k-silk" alt="B" />);
    expect(textureSpy).not.toHaveBeenCalled();
  });
});
