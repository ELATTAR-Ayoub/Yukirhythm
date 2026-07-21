import { describe, it, expect } from "vitest";
import { isCompleted } from "./model";

describe("isCompleted", () => {
  it("treats a 20s play of a 6-hour mix as a skip", () => {
    expect(isCompleted(20, 6 * 60 * 60)).toBe(false);
  });

  it("treats a 45s play of a 6-hour mix as complete (past the 30s floor)", () => {
    expect(isCompleted(45, 6 * 60 * 60)).toBe(true);
  });

  it("uses the 50% rule for short clips", () => {
    // 20s clip -> threshold 10s
    expect(isCompleted(10, 20)).toBe(true);
    expect(isCompleted(9, 20)).toBe(false);
  });

  it("falls back to the 30s floor when duration is unknown", () => {
    expect(isCompleted(29, null)).toBe(false);
    expect(isCompleted(30, null)).toBe(true);
  });
});
