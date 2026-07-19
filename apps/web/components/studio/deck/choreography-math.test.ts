import { describe, expect, it } from "vitest";

import { nextIndex, seatRotation } from "./choreography-math";

const TAU = Math.PI * 2;

describe("nextIndex", () => {
  it("steps forward and wraps", () => {
    expect(nextIndex(0, "next", 5)).toBe(1);
    expect(nextIndex(4, "next", 5)).toBe(0);
  });

  it("steps backward and wraps", () => {
    expect(nextIndex(0, "prev", 5)).toBe(4);
    expect(nextIndex(3, "prev", 5)).toBe(2);
  });
});

describe("seatRotation", () => {
  it("adds one full extra turn from an aligned start", () => {
    expect(seatRotation(0)).toBeCloseTo(TAU);
    expect(seatRotation(TAU)).toBeCloseTo(2 * TAU);
  });

  it("always lands on a multiple of a full turn, at least one turn ahead", () => {
    for (const start of [0.3, 2.5, 7.1, 40.0]) {
      const target = seatRotation(start);
      expect(target % TAU).toBeCloseTo(0);
      expect(target - start).toBeGreaterThanOrEqual(TAU * 0.99);
      expect(target - start).toBeLessThan(TAU * 2);
    }
  });
});
