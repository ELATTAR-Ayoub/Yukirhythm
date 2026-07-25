import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import SocialAuthButtons from "./SocialAuthButtons";
import { MockStudioContext, type MockStudioValue } from "./MockStudioProvider";

/**
 * SocialAuthButtons only reads `signIn` off the context (toast is sonner's
 * own standalone function, not context). Building all ~60 MockStudioValue
 * members for a one-member consumer is noise, so the value is a partial
 * object cast to the full type rather than a real provider's output.
 */
function renderWithSignIn(signIn: MockStudioValue["signIn"]) {
  const value = { signIn } as unknown as MockStudioValue;
  return render(
    <MockStudioContext.Provider value={value}>
      <SocialAuthButtons />
    </MockStudioContext.Provider>
  );
}

describe("SocialAuthButtons", () => {
  it("opens Google sign-in when Continue with Google is clicked", () => {
    const signIn = vi.fn();
    renderWithSignIn(signIn);

    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(signIn).toHaveBeenCalledWith("google");
  });

  it("opens Facebook sign-in when Continue with Facebook is clicked", () => {
    const signIn = vi.fn();
    renderWithSignIn(signIn);

    fireEvent.click(screen.getByRole("button", { name: /continue with facebook/i }));

    expect(signIn).toHaveBeenCalledWith("facebook");
  });
});
