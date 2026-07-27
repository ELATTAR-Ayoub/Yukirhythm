import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { replace, authState } = vi.hoisted(() => ({
  replace: vi.fn(),
  authState: { user: null as { uid: string } | null, loading: true },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/studio/useAuth", () => ({ useAuthState: () => authState }));
vi.mock("@/components/Loader", () => ({
  default: () => <div data-testid="loader" />,
}));

import AuthGate from "./AuthGate";

describe("AuthGate", () => {
  beforeEach(() => {
    replace.mockClear();
    authState.user = null;
    authState.loading = true;
  });

  it("renders the loader, not children, while auth is settling", () => {
    render(
      <AuthGate>
        <div data-testid="gated" />
      </AuthGate>
    );
    expect(screen.getByTestId("loader")).toBeTruthy();
    expect(screen.queryByTestId("gated")).toBeNull();
    // Treating "not yet known" as signed out would bounce every returning
    // user through /auth on a cold load.
    expect(replace).not.toHaveBeenCalled();
  });

  it("renders a route-aware shell fallback when one is provided", () => {
    render(
      <AuthGate fallback={<div data-testid="shell-skeleton" />}>
        <div data-testid="gated" />
      </AuthGate>
    );

    expect(screen.getByTestId("shell-skeleton")).toBeTruthy();
    expect(screen.queryByTestId("loader")).toBeNull();
    expect(screen.queryByTestId("gated")).toBeNull();
  });

  it("redirects to /auth once settled signed out, still never rendering children", () => {
    authState.loading = false;
    render(
      <AuthGate>
        <div data-testid="gated" />
      </AuthGate>
    );
    expect(replace).toHaveBeenCalledWith("/auth");
    expect(screen.queryByTestId("gated")).toBeNull();
  });

  it("renders children for a signed-in user and does not redirect", () => {
    authState.loading = false;
    authState.user = { uid: "u1" };
    render(
      <AuthGate>
        <div data-testid="gated" />
      </AuthGate>
    );
    expect(screen.getByTestId("gated")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("hands the settled user to authenticated children without another auth wait", () => {
    authState.loading = false;
    authState.user = { uid: "u1" };

    render(
      <AuthGate>
        {(authenticatedUser) => (
          <div data-testid="authenticated-user">{authenticatedUser.uid}</div>
        )}
      </AuthGate>
    );

    expect(screen.getByTestId("authenticated-user")).toHaveTextContent("u1");
  });
});
