import { afterEach, expect, it, vi } from "vitest";
import { ApiError, createBackendClient } from "./backend";
afterEach(() => vi.unstubAllGlobals());
it("attaches the current token and disables HTTP caching", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(Response.json({ trackIds: [], tracks: [] }));
  vi.stubGlobal("fetch", fetcher);
  await createBackendClient(async () => "token").me.likes();
  const options = fetcher.mock.calls[0][1];
  expect(options.headers.get("Authorization")).toBe("Bearer token");
  expect(options.cache).toBe("no-store");
});
it("reports malformed error responses without masking their HTTP status", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("null", { status: 503, statusText: "Unavailable" })
      )
  );
  await expect(
    createBackendClient(async () => null).me.likes()
  ).rejects.toMatchObject({ status: 503, message: "Unavailable" });
});
it("rejects malformed success responses and accepts 204", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response("bad"))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetcher);
  const backend = createBackendClient(async () => null);
  await expect(backend.me.likes()).rejects.toBeInstanceOf(ApiError);
  expect(await backend.collections.remove("id")).toBeNull();
});
