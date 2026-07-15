import { describe, it, expect } from "vitest";
import { makeCacheKey, TtlCache } from "@/lib/search/cache";

describe("makeCacheKey", () => {
  it("is stable and normalizes case/space", () => {
    expect(makeCacheKey(" Hello ", 10)).toBe(makeCacheKey("hello", 10));
  });
  it("varies by quantity", () => {
    expect(makeCacheKey("x", 5)).not.toBe(makeCacheKey("x", 10));
  });
});

describe("TtlCache", () => {
  it("returns a stored value before expiry", () => {
    const c = new TtlCache<number>(1000);
    c.set("k", 1, 0);
    expect(c.get("k", 500)).toBe(1);
  });
  it("expires after the TTL", () => {
    const c = new TtlCache<number>(1000);
    c.set("k", 1, 0);
    expect(c.get("k", 1500)).toBeUndefined();
  });
});
