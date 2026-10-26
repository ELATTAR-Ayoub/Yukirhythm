import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cachedSingleFlight,
  clearRequestCache,
  invalidateRequestCache,
  readRequestCache,
  writeRequestCache,
} from "./request-cache";

beforeEach(clearRequestCache);
describe("request cache consistency", () => {
  it("deduplicates concurrent loads and caches their result", async () => {
    const load = vi.fn(async () => [1]);
    const values = await Promise.all([
      cachedSingleFlight("k", 1000, load),
      cachedSingleFlight("k", 1000, load),
    ]);
    expect(values).toEqual([[1], [1]]);
    await cachedSingleFlight("k", 1000, load);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it("retains falsey values", async () => {
    const load = vi.fn(async () => false);
    await cachedSingleFlight("k", 1000, load);
    await cachedSingleFlight("k", 1000, load);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it("expires entries", () => {
    writeRequestCache("k", "old", -1);
    expect(readRequestCache("k")).toBeNull();
  });
  it("does not repopulate an invalidated key with a late response", async () => {
    let finish!: (value: string) => void;
    const old = cachedSingleFlight(
      "k",
      1000,
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        })
    );
    await Promise.resolve();
    invalidateRequestCache("k");
    await cachedSingleFlight("k", 1000, async () => "new");
    finish("old");
    await old;
    expect(readRequestCache("k")).toBe("new");
  });
  it("retries after rejection or a synchronous loader failure", async () => {
    await expect(
      cachedSingleFlight("k", 1000, () => {
        throw new Error("offline");
      })
    ).rejects.toThrow("offline");
    expect(await cachedSingleFlight("k", 1000, async () => "recovered")).toBe(
      "recovered"
    );
  });
});
