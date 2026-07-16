import { describe, it, expect, vi } from "vitest";
import { ensureUserDoc } from "@/lib/user/ensureUserDoc";

const userData = (uid: string) => ({
  ID: uid,
  avatar: "",
  userName: "n",
  email: "e",
  marketingEmails: false,
  collections: [],
  lovedSongs: [],
  lovedCollections: [],
  followers: [],
  following: [],
});

describe("ensureUserDoc", () => {
  it("creates the doc when it does not exist", async () => {
    const getDoc = vi.fn().mockResolvedValue({ exists: () => false });
    const setDoc = vi.fn().mockResolvedValue(undefined);
    const result = await ensureUserDoc(
      { getDoc, setDoc, ref: {} as any },
      "uid-1",
      userData("uid-1")
    );
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(result.created).toBe(true);
  });

  it("does not create when the doc already exists", async () => {
    const existing = { userData: userData("uid-1") };
    const getDoc = vi
      .fn()
      .mockResolvedValue({ exists: () => true, data: () => existing });
    const setDoc = vi.fn();
    const result = await ensureUserDoc(
      { getDoc, setDoc, ref: {} as any },
      "uid-1",
      userData("uid-1")
    );
    expect(setDoc).not.toHaveBeenCalled();
    expect(result.created).toBe(false);
    expect(result.data).toEqual(existing.userData);
  });
});
