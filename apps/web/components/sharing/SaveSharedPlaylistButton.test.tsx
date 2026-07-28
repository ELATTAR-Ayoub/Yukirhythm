import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicPlaylist } from "@/lib/sharing/public";

const { createCollectionAsync, studio, toast } = vi.hoisted(() => ({
  createCollectionAsync: vi.fn(),
  studio: {
    user: null as { id: string; name: string } | null,
  },
  toast: {
    loading: vi.fn(() => "save-toast"),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/studio/screens/MockStudioProvider", () => ({
  useMockStudio: () => ({
    user: studio.user,
    createCollectionAsync,
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/share/playlist/shared-1",
}));

vi.mock("sonner", () => ({ toast }));

import SaveSharedPlaylistButton from "./SaveSharedPlaylistButton";

const playlist: PublicPlaylist = {
  id: "shared-1",
  title: "Night Drive",
  description: "A public playlist.",
  ownerName: "Yuki",
  tags: ["night", "driving"],
  cover: "image",
  artUrl: "https://images.example/cover.jpg",
  artUrls: ["https://images.example/cover.jpg"],
  texture: "tx-k-marble",
  tracks: [
    {
      id: "one",
      title: "First Track",
      artist: "One Artist",
      artUrl: "https://images.example/one.jpg",
      texture: "tx-k-marble",
      durationSec: 200,
      url: "https://www.youtube.com/watch?v=one",
    },
    {
      id: "two",
      title: "Second Track",
      artist: "Two Artist",
      artUrl: "https://images.example/two.jpg",
      texture: "tx-k-ripple",
      durationSec: 180,
      url: "https://www.youtube.com/watch?v=two",
    },
  ],
};

describe("SaveSharedPlaylistButton", () => {
  beforeEach(() => {
    studio.user = null;
    createCollectionAsync.mockReset();
    toast.loading.mockClear();
    toast.success.mockClear();
    toast.error.mockClear();
  });

  it("asks a guest to sign in and preserves the shared-page return path", () => {
    render(<SaveSharedPlaylistButton playlist={playlist} />);

    fireEvent.click(screen.getByRole("button", { name: "Save playlist" }));

    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Sign in to continue"
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/auth?returnTo=%2Fshare%2Fplaylist%2Fshared-1"
    );
    expect(createCollectionAsync).not.toHaveBeenCalled();
  });

  it("shows progress until the copied playlist is actually saved", async () => {
    studio.user = { id: "visitor", name: "Visitor" };
    let finish!: (value: { id: string }) => void;
    createCollectionAsync.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    render(<SaveSharedPlaylistButton playlist={playlist} />);

    fireEvent.click(screen.getByRole("button", { name: "Save playlist" }));

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(toast.loading).toHaveBeenCalledWith(
      "Saving playlist to your library..."
    );
    expect(createCollectionAsync).toHaveBeenCalledWith({
      title: "Night Drive",
      desc: "A public playlist.",
      tags: ["night", "driving"],
      kind: "music",
      texture: "tx-k-marble",
      cover: "image",
      artUrl: "https://images.example/cover.jpg",
      trackIds: ["one", "two"],
    });

    finish({ id: "copied" });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled()
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Playlist saved to your library",
      { id: "save-toast" }
    );
  });
});
