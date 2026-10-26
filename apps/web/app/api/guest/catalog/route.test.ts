import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import {
  setCatalogProvider,
  type CatalogProvider,
} from "@/lib/catalog/provider";
import { adminDb } from "@/lib/firebase/admin";
vi.mock("@/lib/firebase/admin", () => ({
  adminDb: vi.fn(() => {
    throw new Error("Guest must not access database");
  }),
}));
const search = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  setCatalogProvider({
    search,
    suggest: async () => ["music"],
  } as unknown as CatalogProvider);
});
describe("public guest catalog", () => {
  it("searches without account authentication or database access", async () => {
    search.mockResolvedValue({ tracks: [] });
    const res = await GET(
      new Request("http://localhost/api/guest/catalog?q=guest-test-music")
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tracks: [], artists: [] });
    expect(adminDb).not.toHaveBeenCalled();
  });
  it("validates queries and has no personal mutation surface", async () => {
    for (const query of [
      "q=",
      "op=save&q=song",
      "op=track&id=a/b",
      `q=${"a".repeat(201)}`,
    ]) {
      expect(
        (await GET(new Request(`http://localhost/api/guest/catalog?${query}`)))
          .status
      ).toBe(400);
    }
    expect(search).not.toHaveBeenCalled();
    expect(adminDb).not.toHaveBeenCalled();
  });
});
