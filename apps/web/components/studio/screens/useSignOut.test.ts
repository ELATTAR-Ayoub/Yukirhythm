import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// vi.mock factories are hoisted above module-scope consts, so the spies have
// to be created inside vi.hoisted to exist by the time a factory runs.
const { signOut, push, toast } = vi.hoisted(() => ({
  signOut: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("sonner", () => ({ toast }));
vi.mock("./MockStudioProvider", () => ({ useMockStudio: () => ({ signOut }) }));

import { AUTH } from "@/components/studio/shell/routes";
import { useSignOut } from "./useSignOut";

describe("useSignOut", () => {
  beforeEach(() => {
    signOut.mockReset();
    push.mockReset();
    toast.mockReset();
  });

  it("clears the session, confirms, and lands on auth", () => {
    const { result } = renderHook(() => useSignOut());

    act(() => result.current());

    expect(signOut).toHaveBeenCalledOnce();
    expect(toast).toHaveBeenCalledWith("Signed out");
    expect(push).toHaveBeenCalledWith(AUTH);
  });
});
