import { afterEach, describe, expect, it, vi } from "vitest";

import { createBackendClient } from "./backend";

describe("backend catalog track batches", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("chunks large membership lists without changing track order", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const rawUrl =
        input instanceof Request
          ? input.url
          : input instanceof URL
            ? input.href
            : input;
      const url = new URL(rawUrl, "http://localhost");
      const ids = (url.searchParams.get("ids") ?? "")
        .split(",")
        .filter(Boolean);
      return Response.json({
        tracks: ids.map((trackId) => ({ trackId })),
        missingTrackIds: [],
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = createBackendClient(async () => "token");
    const ids = Array.from({ length: 205 }, (_, index) => `track-${index}`);

    const result = await client.catalog.tracksByIds(ids);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.tracks.map((track) => track.trackId)).toEqual(ids);
    expect(result.missingTrackIds).toEqual([]);
  });

  it("does not issue a request for an empty membership list", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = createBackendClient(async () => "token");

    await expect(client.catalog.tracksByIds([])).resolves.toEqual({
      tracks: [],
      missingTrackIds: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
