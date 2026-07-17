import { describe, it, expect, vi } from "vitest";

const verifyIdToken = vi.fn();
vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: () => ({ verifyIdToken }),
  adminDb: () => ({}),
}));

import { uidFromRequest } from "@/lib/firebase/verify";

const req = (headers: Record<string, string>) =>
  new Request("http://localhost/api/me", { headers });

describe("uidFromRequest", () => {
  it("returns null when the Authorization header is missing", async () => {
    expect(await uidFromRequest(req({}))).toBeNull();
  });

  it("returns null when the scheme is not Bearer", async () => {
    expect(
      await uidFromRequest(req({ Authorization: "Basic abc" }))
    ).toBeNull();
  });

  it("returns null when verification throws", async () => {
    verifyIdToken.mockRejectedValue(new Error("bad token"));
    expect(
      await uidFromRequest(req({ Authorization: "Bearer nope" }))
    ).toBeNull();
  });

  it("returns the uid from a verified token", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-123" });
    expect(await uidFromRequest(req({ Authorization: "Bearer good" }))).toBe(
      "uid-123"
    );
  });
});
