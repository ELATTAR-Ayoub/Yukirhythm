import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("lets the last conflicting tailwind class win", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("ignores falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});
