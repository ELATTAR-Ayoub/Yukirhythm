import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const { replace, authState } = vi.hoisted(() => ({
  replace: vi.fn(),
  authState: { user: null as { uid: string } | null, loading: false },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/studio/useAuth", () => ({ useAuthState: () => authState }));

import RootPage from "./page";

describe("root landing gate", () => {
  beforeEach(() => {
    replace.mockClear();
    localStorage.clear();
    authState.user = { uid: "u1" };
    authState.loading = false;
  });

  it("sends a signed-out visitor to the login page", async () => {
    authState.user = null;
    render(<RootPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/auth"));
  });

  it("sends a brand-new account to search", async () => {
    // Nothing queued and nothing ever played: Search is where the feeds and
    // the search field give a cold account something to actually do.
    render(<RootPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/search"));
  });

  it("sends a returning listener to home", async () => {
    localStorage.setItem(
      "yukirhythm:playback:v1:u1",
      JSON.stringify({ queue: ["t1"], trackId: "t1" })
    );
    render(<RootPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home"));
  });

  it("sends a listener with a saved track but an empty queue to home", async () => {
    localStorage.setItem(
      "yukirhythm:playback:v1:u1",
      JSON.stringify({ queue: [], trackId: "t1" })
    );
    render(<RootPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home"));
  });

  it("treats corrupt browser playback as a cold account", async () => {
    localStorage.setItem("yukirhythm:playback:v1:u1", "not-json");
    render(<RootPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/search"));
  });

  it("waits for auth to settle before deciding, rather than treating unknown as signed out", async () => {
    // If loading:true were treated as "no user", a returning listener on a
    // cold load would be sent to /auth (the login page) for the wrong reason
    // (misread as signed-out) before auth ever resolves, and worse, a
    // redirect could fire a second time once the real user arrives — this
    // proves it waits.
    authState.loading = true;
    authState.user = null;
    render(<RootPage />);

    // Give any (incorrect) synchronous redirect a chance to fire.
    await new Promise((r) => setTimeout(r, 0));
    expect(replace).not.toHaveBeenCalled();

    authState.loading = false;
    authState.user = { uid: "u1" };
    localStorage.setItem(
      "yukirhythm:playback:v1:u1",
      JSON.stringify({ queue: ["t1"], trackId: "t1" })
    );
    render(<RootPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home"));
  });
});
