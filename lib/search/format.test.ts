import { describe, it, expect } from "vitest";
import { validateSearchRequest, formatVideos } from "@/lib/search/format";

describe("validateSearchRequest", () => {
  it("rejects empty query", () => {
    expect(validateSearchRequest({ string: "  ", quantity: 10 }).ok).toBe(false);
  });
  it("accepts a valid query and clamps quantity", () => {
    const r = validateSearchRequest({ string: "lofi", quantity: 999 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.quantity).toBeLessThanOrEqual(50);
      expect(r.value.string).toBe("lofi");
    }
  });
  it("defaults quantity when missing", () => {
    const r = validateSearchRequest({ string: "lofi" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.quantity).toBeGreaterThan(0);
  });
});

describe("formatVideos", () => {
  it("maps raw results to Audio and skips incomplete entries", () => {
    const raw = [
      { type: "video", ID: "1", URL: "u1", title: "t1", thumbnails: [{ url: "a" }, { url: "b" }], owner: { name: "o", ID: "oid", canonicalURL: "c", thumbnails: [{ url: "p" }] }, duration: { number: 100 } },
      { type: "video", ID: "", URL: "", title: "" },
      { type: "channel", ID: "2" },
    ];
    const out = formatVideos(raw as any, 10);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ ID: "1", title: "t1", audioLengthSec: 100 });
  });
});
