import { describe, it, expect } from "vitest";
import { TEXTURE_NAMES } from "@/components/studio/Texture";
import { TAXONOMY, resolveLabel, exploreTiles } from "./taxonomy";

describe("TAXONOMY", () => {
  it("has unique ids", () => {
    const ids = TAXONOMY.map((l) => l.labelId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers the eight explore tiles the search screen renders", () => {
    expect(exploreTiles()).toHaveLength(8);
  });

  it("gives every label a real design-system texture", () => {
    for (const l of TAXONOMY) expect(TEXTURE_NAMES).toContain(l.texture);
  });
});

describe("resolveLabel", () => {
  it("maps provider spellings onto one canonical id", () => {
    expect(resolveLabel("Lo-Fi")).toBe("lofi");
    expect(resolveLabel("lo fi")).toBe("lofi");
    expect(resolveLabel("lofi hip hop")).toBe("lofi");
  });

  it("is case and whitespace insensitive", () => {
    expect(resolveLabel("  AMBIENT  ")).toBe("ambient");
  });

  it("returns null for anything outside the vocabulary", () => {
    expect(resolveLabel("polka")).toBeNull();
  });
});
