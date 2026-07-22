import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const { replace, backend, authState } = vi.hoisted(() => ({
  replace: vi.fn(),
  backend: { me: { playback: { get: vi.fn() } } },
  authState: { user: null as { uid: string } | null, loading: false },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/studio/useBackend", () => ({ useBackend: () => backend }));
vi.mock("@/lib/studio/useAuth", () => ({ useAuthState: () => authState }));

import RootPage from "./page";

describe("root landing gate", () => {
  beforeEach(() => {
    replace.mockClear();
    authState.user = { uid: "u1" };
    authState.loading = false;
    backend.me.playback.get.mockResolvedValue({ queue: [], trackId: null });
  });

  it("sends a signed-out visitor to home", async () => {
    authState.user = null;
    render(<RootPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home"));
  });

  it("sends a brand-new account to the queue", async () => {
    // Nothing queued and nothing ever played: the first useful thing this user
    // can do is add music to what will play.
    render(<RootPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/queue"));
  });

  it("sends a returning listener to home", async () => {
    backend.me.playback.get.mockResolvedValue({ queue: ["t1"], trackId: "t1" });
    render(<RootPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home"));
  });

  it("sends a listener with a saved track but an empty queue to home", async () => {
    backend.me.playback.get.mockResolvedValue({ queue: [], trackId: "t1" });
    render(<RootPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home"));
  });

  it("falls back to home when the playback read fails", async () => {
    // A network error must not redefine where the app opens.
    backend.me.playback.get.mockRejectedValue(new Error("offline"));
    render(<RootPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home"));
  });

  it("waits for auth to settle before deciding, rather than treating unknown as signed out", async () => {
    // If loading:true were treated as "no user", a returning listener on a
    // cold load would be sent to /home for the wrong reason (misread as
    // signed-out) before auth ever resolves, and worse, a redirect could fire
    // a second time once the real user arrives — this proves it waits.
    authState.loading = true;
    authState.user = null;
    render(<RootPage />);

    // Give any (incorrect) synchronous redirect a chance to fire.
    await new Promise((r) => setTimeout(r, 0));
    expect(replace).not.toHaveBeenCalled();

    authState.loading = false;
    authState.user = { uid: "u1" };
    backend.me.playback.get.mockResolvedValue({ queue: ["t1"], trackId: "t1" });
    render(<RootPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home"));
  });
});
