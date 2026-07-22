import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { LIKED_SONGS_ID } from "@/components/studio/screens/mock-data";

const { backend, authState } = vi.hoisted(() => ({
  backend: {
    me: {
      ensure: vi.fn().mockResolvedValue({}),
      get: vi.fn().mockResolvedValue({ userId: "u1", displayName: "Yuki", email: "y@x.dev" }),
      likes: vi.fn(),
      stats: vi.fn().mockRejectedValue(new Error("no")),
      recents: vi.fn().mockRejectedValue(new Error("no")),
      library: vi.fn().mockResolvedValue({ collections: [], tracks: [] }),
      setTrackState: vi.fn().mockResolvedValue({}),
      setPin: vi.fn().mockResolvedValue({}),
      playback: {
        get: vi.fn().mockResolvedValue({ queue: [], trackId: null }),
        save: vi.fn().mockResolvedValue({}),
        enqueue: vi.fn().mockResolvedValue({}),
        removeFromQueue: vi.fn().mockResolvedValue({}),
      },
    },
    collections: { list: vi.fn() },
    feed: {
      jumpBackIn: vi.fn().mockRejectedValue(new Error("no")),
      newReleases: vi.fn().mockRejectedValue(new Error("no")),
      youMightLike: vi.fn().mockRejectedValue(new Error("no")),
    },
    catalog: { track: vi.fn(), search: vi.fn() },
    events: { ingest: vi.fn() },
  },
  authState: {
    user: {
      uid: "u1", displayName: "Yuki", email: "y@x.dev", photoURL: null,
      providerData: [{ providerId: "google.com" }],
    },
  },
}));

vi.mock("@/lib/studio/useBackend", () => ({ useBackend: () => backend }));
vi.mock("@/lib/studio/useAuth", () => ({
  useAuthState: () => authState,
  signIn: vi.fn(),
  signOutUser: vi.fn(),
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));

import StudioProvider from "./StudioProvider";

function Probe() {
  const { collections, libraryLoading } = useMockStudio();
  const liked = collections.find((c) => c.id === LIKED_SONGS_ID);
  return (
    <>
      <div data-testid="loading">{String(libraryLoading)}</div>
      <div data-testid="count">{collections.length}</div>
      <div data-testid="liked">{liked ? liked.title : "missing"}</div>
      <div data-testid="liked-system">{String(liked?.system ?? false)}</div>
    </>
  );
}

describe("StudioProvider library load", () => {
  beforeEach(() => {
    backend.collections.list.mockResolvedValue([]);
    backend.me.likes.mockResolvedValue({ trackIds: [], tracks: [] });
  });

  it("gives a brand-new account a Liked Songs playlist", async () => {
    render(<StudioProvider><Probe /></StudioProvider>);
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("liked").textContent).toBe("Liked Songs");
    expect(screen.getByTestId("liked-system").textContent).toBe("true");
  });

  it("still builds the library when the likes call fails", async () => {
    // The composite index this endpoint needs is blocked in production. One
    // rejected promise used to take the ENTIRE library down with it — the
    // user saw no playlists at all, and libraryLoading never cleared.
    backend.me.likes.mockRejectedValue(new Error("FAILED_PRECONDITION: index"));
    render(<StudioProvider><Probe /></StudioProvider>);
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("liked").textContent).toBe("Liked Songs");
  });

  it("still builds the library when the collections call fails", async () => {
    backend.collections.list.mockRejectedValue(new Error("boom"));
    render(<StudioProvider><Probe /></StudioProvider>);
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("liked").textContent).toBe("Liked Songs");
  });

  it("puts a newly liked track at the front of Liked Songs without waiting for a refetch", async () => {
    // toggleLike's optimistic update must land synchronously with the click —
    // not after backend.me.setTrackState round-trips and refreshLibrary re-runs.
    function LikeProbe() {
      const { collections, toggleLike } = useMockStudio();
      const liked = collections.find((c) => c.id === LIKED_SONGS_ID);
      return (
        <>
          <button onClick={() => toggleLike("brand-new-track")}>like</button>
          <div data-testid="liked-tracks">{liked?.trackIds.join(",") ?? ""}</div>
        </>
      );
    }

    render(<StudioProvider><LikeProbe /></StudioProvider>);
    await waitFor(() =>
      expect(screen.getByTestId("liked-tracks")).toBeInTheDocument()
    );

    // backend.me.setTrackState never resolves during this test, so if the
    // track shows up it can only be from the optimistic update.
    backend.me.setTrackState.mockReturnValueOnce(new Promise(() => {}));
    fireEvent.click(screen.getByText("like"));

    expect(screen.getByTestId("liked-tracks").textContent).toBe(
      "brand-new-track"
    );
  });
});
