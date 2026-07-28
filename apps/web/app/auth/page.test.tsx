import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";

const { replace, authState, returnTo } = vi.hoisted(() => ({
  replace: vi.fn(),
  authState: { user: null as { uid: string } | null, loading: false },
  returnTo: { value: null as string | null },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => ({
    get: (name: string) => (name === "returnTo" ? returnTo.value : null),
  }),
}));
vi.mock("@/lib/studio/useAuth", () => ({ useAuthState: () => authState }));

import AuthScreen from "./page";

describe("AuthScreen", () => {
  beforeEach(() => {
    replace.mockClear();
    authState.user = null;
    authState.loading = false;
    returnTo.value = null;
  });

  it("stays put for a signed-out visitor", () => {
    render(
      <MockStudioProvider>
        <AuthScreen />
      </MockStudioProvider>
    );
    expect(
      screen.getByRole("button", { name: /continue with google/i })
    ).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("hands an already-signed-in visitor to the root decision", () => {
    authState.user = { uid: "u1" };
    render(
      <MockStudioProvider>
        <AuthScreen />
      </MockStudioProvider>
    );
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("waits for auth to settle before redirecting", () => {
    authState.loading = true;
    render(
      <MockStudioProvider>
        <AuthScreen />
      </MockStudioProvider>
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("returns a signed-in visitor to a safe shared page", () => {
    authState.user = { uid: "u1" };
    returnTo.value = "/share/playlist/opaque";
    render(
      <MockStudioProvider>
        <AuthScreen />
      </MockStudioProvider>
    );
    expect(replace).toHaveBeenCalledWith("/share/playlist/opaque");
  });

  it("rejects an external return destination", () => {
    authState.user = { uid: "u1" };
    returnTo.value = "//evil.example";
    render(
      <MockStudioProvider>
        <AuthScreen />
      </MockStudioProvider>
    );
    expect(replace).toHaveBeenCalledWith("/");
  });
});
