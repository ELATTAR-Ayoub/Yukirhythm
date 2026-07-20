import { describe, it, expect } from "vitest";
import { TEXTURE_NAMES } from "@/components/studio/Texture";
import { textureForId } from "./texture";

describe("textureForId", () => {
  it("returns a real design-system texture", () => {
    expect(TEXTURE_NAMES).toContain(textureForId("a5uQMwRMHcs"));
  });

  it("is stable for the same id", () => {
    expect(textureForId("a5uQMwRMHcs")).toBe(textureForId("a5uQMwRMHcs"));
  });

  it("spreads ids across more than one texture", () => {
    const seen = new Set(
      Array.from({ length: 200 }, (_, i) => textureForId(`track-${i}`))
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it("never returns undefined for an empty id", () => {
    expect(TEXTURE_NAMES).toContain(textureForId(""));
  });
});
