import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyIdToken = vi.fn();
const userGet = vi.fn();
const userSet = vi.fn();
vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: () => ({ verifyIdToken }),
  adminDb: () => ({
    collection: () => ({ doc: () => ({ get: userGet, set: userSet }) }),
  }),
}));

import { GET, POST } from "@/app/api/me/route";

const req = (headers: Record<string, string>, body?: unknown) =>
  new Request("http://localhost/api/me", {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

describe("/api/me", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    userGet.mockReset();
    userSet.mockReset();
  });

  it("401 without a token", async () => {
    const res = await GET(req({}));
    expect(res.status).toBe(401);
  });

  it("returns the caller's user on GET", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-1" });
    userGet.mockResolvedValue({
      exists: true,
      data: () => ({ userData: { ID: "uid-1", userName: "n" } }),
    });
    const res = await GET(req({ Authorization: "Bearer x" }));
    expect(res.status).toBe(200);
    expect((await res.json()).ID).toBe("uid-1");
  });

  it("POST forces uid from the token, ignoring body.ID (spoof attempt)", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-real" });
    userGet.mockResolvedValue({ exists: false });
    userSet.mockResolvedValue(undefined);
    const res = await POST(
      req({ Authorization: "Bearer x" }, { ID: "uid-VICTIM", userName: "n" })
    );
    // The doc written must be keyed/stamped with uid-real, not uid-VICTIM
    const written = userSet.mock.calls[0][0];
    expect(written.userData.ID).toBe("uid-real");
    expect((await res.json()).ID).toBe("uid-real");
  });
});
