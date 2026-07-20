import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Source-level assertions: the defect is in the emitted attribute, and the
 * component needs a WebGL context it cannot get in jsdom.
 */
const source = readFileSync(join(__dirname, "DiscDeck.tsx"), "utf8");

describe("DiscDeck signals", () => {
  it("never puts two event names in one data-signal attribute", () => {
    const attrs = source.match(/data-signal="[^"]*"/g) ?? [];
    expect(attrs.length).toBeGreaterThan(0);
    for (const attr of attrs) {
      expect(attr).not.toContain(",");
    }
  });

  it("declares each disc navigation signal separately", () => {
    expect(source).toContain('data-signal="disc_prev"');
    expect(source).toContain('data-signal="disc_next"');
  });
});
