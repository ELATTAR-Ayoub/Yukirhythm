import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";

const { replace, authState } = vi.hoisted(() => ({
  replace: vi.fn(),
  authState: { user: null as { uid: string } | null, loading: false },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/studio/useAuth", () => ({ useAuthState: () => authState }));

import AuthScreen from "./page";

describe("AuthScreen", () => {
  beforeEach(() => {
    replace.mockClear();
    authState.user = null;
    authState.loading = false;
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
});
