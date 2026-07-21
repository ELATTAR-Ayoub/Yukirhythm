import { describe, it, expect, vi } from "vitest";
import { useEffect } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider, { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import AuthScreen from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function SessionProbe() {
  const { user } = useMockStudio();
  return <div data-testid="session">{user ? user.userName : "guest"}</div>;
}

// Calling signOut() during render (rather than in an effect) triggers React's
// "Cannot update a component while rendering a different component" warning
// and the update is dropped — so the sign-out never actually applies before
// the test's first assertion. Deferring to useEffect avoids the render-phase
// setState and keeps the same assertion the plan calls for.
function SignOutFirst({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useMockStudio();
  useEffect(() => {
    if (user) signOut();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

describe("AuthScreen", () => {
  it("signs in with a social provider and redirects home", () => {
    render(
      <MockStudioProvider>
        <SignOutFirst>
          <AuthScreen />
          <SessionProbe />
        </SignOutFirst>
      </MockStudioProvider>
    );

    expect(screen.getByTestId("session").textContent).toBe("guest");
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(screen.getByTestId("session").textContent).toBe("Yuki Sato");
    expect(push).toHaveBeenCalledWith("/home");
  });
});
