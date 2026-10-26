import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const { auth, subscribe, popup, logout } = vi.hoisted(() => ({
  auth: { currentUser: null },
  subscribe: vi.fn(),
  popup: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("@/config/firebase", () => ({ auth }));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  FacebookAuthProvider: class {},
  onAuthStateChanged: subscribe,
  signInWithPopup: popup,
  signOut: logout,
}));
import { signInAsGuest, signOutUser, useAuthState } from "./useAuth";
import { activeGuestId } from "./guest-session";
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  subscribe.mockReturnValue(vi.fn());
  logout.mockResolvedValue(undefined);
});
describe("guest authentication", () => {
  it("starts and restores a guest without waiting for Firebase or creating an account", () => {
    const { result, unmount } = renderHook(useAuthState);
    expect(result.current.loading).toBe(true);
    act(() => signInAsGuest());
    expect(result.current.user?.displayName).toBe("Guest");
    expect(result.current.loading).toBe(false);
    const uid = result.current.user?.uid;
    unmount();
    const restored = renderHook(useAuthState);
    expect(restored.result.current.user?.uid).toBe(uid);
    expect(popup).not.toHaveBeenCalled();
  });
  it("does not reset the identity when unrelated browser data changes", () => {
    signInAsGuest();
    const { result } = renderHook(useAuthState);
    const identity = result.current.user;
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", { key: "yukirhythm:guest-data:v1:test" })
      )
    );
    expect(result.current.user).toBe(identity);
    act(() => subscribe.mock.calls[0][1](null));
    expect(result.current.user).toBe(identity);
  });
  it("signs out while retaining the device identity for the next guest visit", async () => {
    signInAsGuest();
    const uid = activeGuestId();
    const { result } = renderHook(useAuthState);
    await act(async () => {
      await signOutUser();
    });
    expect(result.current.user).toBeNull();
    expect(activeGuestId()).toBeNull();
    act(() => signInAsGuest());
    expect(result.current.user?.uid).toBe(uid);
  });
  it("rejects guest sign-in when storage is unavailable", () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    expect(() => signInAsGuest()).toThrow("blocked");
    expect(activeGuestId()).toBeNull();
    spy.mockRestore();
  });
});
