import { expect, it } from "vitest";
import { readJsonObject } from "./request-body";
it.each(["null", "[]", "123", "true", "not-json"])(
  "normalizes malformed object bodies: %s",
  async (body) => {
    expect(
      await readJsonObject(
        new Request("http://localhost", { method: "POST", body })
      )
    ).toEqual({});
  }
);
it("keeps valid object fields", async () => {
  expect(
    await readJsonObject(
      new Request("http://localhost", {
        method: "POST",
        body: '{"isLiked":true}',
      })
    )
  ).toEqual({ isLiked: true });
});
