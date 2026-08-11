import { describe, it, expect } from "vitest";
import { classifyListen, isCompleted } from "./model";

describe("classifyListen", () => {
  it("classifies under 30 seconds as a quick skip", () => {
    expect(classifyListen(29, 240)).toBe("quick-skip");
  });

  it("classifies 30 seconds through under half as sampled", () => {
    expect(classifyListen(30, 240)).toBe("sampled");
    expect(classifyListen(119, 240)).toBe("sampled");
  });

  it("classifies half through under 80% as completed", () => {
    expect(classifyListen(120, 240)).toBe("completed");
    expect(classifyListen(191, 240)).toBe("completed");
  });

  it("classifies at least 80% as near-complete", () => {
    expect(classifyListen(192, 240)).toBe("near-complete");
    expect(classifyListen(240, 240)).toBe("near-complete");
  });

  it("lets percentage completion take precedence for short tracks", () => {
    expect(classifyListen(10, 20)).toBe("completed");
    expect(classifyListen(16, 20)).toBe("near-complete");
  });

  it("cannot call unknown-duration media completed", () => {
    expect(classifyListen(29, null)).toBe("quick-skip");
    expect(classifyListen(30, null)).toBe("sampled");
    expect(classifyListen(600, null)).toBe("sampled");
  });
});

describe("isCompleted", () => {
  it("is true only for completed and near-complete listens", () => {
    expect(isCompleted(119, 240)).toBe(false);
    expect(isCompleted(120, 240)).toBe(true);
    expect(isCompleted(192, 240)).toBe(true);
  });
});
