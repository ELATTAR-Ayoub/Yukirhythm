import { describe, it, expect, beforeEach, beforeAll } from "vitest";

import { adminDb } from "@/lib/firebase/admin";
import {
  clearFirestore,
  mintIdToken,
} from "@/lib/catalog/__integration__/emulator";
import type { User } from "@/lib/catalog/model";

import { GET, POST, PATCH } from "./route";

/**
 * Real Firestore + real Auth emulator. Tokens are minted by the Auth emulator
 * and verified by the real Admin SDK — no mocks anywhere.
 */

const req = (method: string, token?: string, body?: unknown) =>
  new Request("http://localhost/api/me", {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

let token: string;
let uid: string;

beforeAll(async () => {
  token = await mintIdToken(`me-${Date.now()}@example.com`);
  // the uid the emulator assigned, read back from a throwaway ensure-user
});

describe("/api/me against real Firestore", () => {
  beforeEach(() => clearFirestore());

  it("401 without a token", async () => {
    expect((await GET(req("GET"))).status).toBe(401);
    expect((await POST(req("POST"))).status).toBe(401);
    expect((await PATCH(req("PATCH"))).status).toBe(401);
  });

  it("POST creates the user with defaults and the token's uid", async () => {
    const res = await POST(
      req("POST", token, { displayName: "Yuki", email: "yuki@x.com" })
    );
    expect(res.status).toBe(201);
    const user = (await res.json()) as User;

    expect(user.displayName).toBe("Yuki");
    expect(user.privacy).toEqual({
      saveHistory: true,
      personalization: true,
      publicProfile: false,
    });
    expect(user.settings.audioQuality).toBe("auto");
    expect(user.counts.collectionCount).toBe(0);
    uid = user.userId;

    // read straight back from Firestore
    const stored = (await adminDb().collection("users").doc(uid).get()).data();
    expect((stored as User).userId).toBe(uid);
  });

  it("forces uid from the token, ignoring a spoofed body userId", async () => {
    const res = await POST(req("POST", token, { userId: "uid-VICTIM" }));
    const user = (await res.json()) as User;
    expect(user.userId).not.toBe("uid-VICTIM");
  });

  it("captures the auth provider honestly", async () => {
    const res = await POST(req("POST", token, { authProvider: "facebook" }));
    expect(((await res.json()) as User).authProvider).toBe("facebook");
  });

  it("is idempotent — a second POST returns the existing doc", async () => {
    const first = (await (await POST(req("POST", token, { displayName: "A" }))).json()) as User;
    const second = (await (await POST(req("POST", token, { displayName: "B" }))).json()) as User;
    expect(second.displayName).toBe("A");
    expect(second.createdAt).toEqual(first.createdAt);
  });

  it("PATCH persists a privacy toggle and a settings change", async () => {
    await POST(req("POST", token, {}));
    const res = await PATCH(
      req("PATCH", token, {
        privacy: { saveHistory: false },
        settings: { audioQuality: "high", language: "fr" },
      })
    );
    const user = (await res.json()) as User;
    expect(user.privacy.saveHistory).toBe(false);
    expect(user.privacy.personalization).toBe(true); // sibling untouched
    expect(user.settings.audioQuality).toBe("high");
    expect(user.settings.language).toBe("fr");
  });

  it("PATCH cannot change identity fields", async () => {
    const created = (await (await POST(req("POST", token, { email: "real@x.com" }))).json()) as User;
    const res = await PATCH(
      req("PATCH", token, { userId: "hacked", email: "evil@x.com", authProvider: "facebook" })
    );
    const user = (await res.json()) as User;
    expect(user.userId).toBe(created.userId);
    expect(user.email).toBe("real@x.com");
    expect(user.authProvider).toBe(created.authProvider);
  });
});
