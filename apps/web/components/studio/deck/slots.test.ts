import { describe, expect, it } from "vitest";

import { SLOTS, slotFor } from "./slots";

describe("slotFor", () => {
  it("places current at center, successor right, predecessor left", () => {
    expect(slotFor(0, 0, 5)).toBe("center");
    expect(slotFor(1, 0, 5)).toBe("right");
    expect(slotFor(4, 0, 5)).toBe("left");
    expect(slotFor(2, 0, 5)).toBe("hidden");
    expect(slotFor(3, 0, 5)).toBe("hidden");
  });

  it("wraps around the ends of the queue", () => {
    expect(slotFor(4, 4, 5)).toBe("center");
    expect(slotFor(0, 4, 5)).toBe("right");
    expect(slotFor(3, 4, 5)).toBe("left");
  });

  it("handles a two-track queue without a left slot", () => {
    expect(slotFor(0, 0, 2)).toBe("center");
    expect(slotFor(1, 0, 2)).toBe("right");
  });

  it("handles a single track and an empty queue", () => {
    expect(slotFor(0, 0, 1)).toBe("center");
    expect(slotFor(0, 0, 0)).toBe("hidden");
  });
});

describe("SLOTS", () => {
  it("defines a transform for every slot", () => {
    for (const key of ["center", "left", "right", "hidden"] as const) {
      expect(SLOTS[key].pos).toHaveLength(3);
      expect(typeof SLOTS[key].rotY).toBe("number");
      expect(SLOTS[key].scale).toBeGreaterThan(0);
    }
  });
});
