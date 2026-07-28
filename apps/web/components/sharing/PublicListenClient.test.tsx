import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicPlaylist } from "@/lib/sharing/public";

const { hiddenPlayer, backend, push } = vi.hoisted(() => ({
  hiddenPlayer: {
    props: {} as {
      url: string;
      playing: boolean;
      onReady: () => void;
      onEnded: () => void;
    },
    seekTo: vi.fn(),
  },
  push: vi.fn(),
  backend: {
    catalog: { track: vi.fn() },
    events: { ingest: vi.fn().mockResolvedValue({ ok: true }) },
    me: {
      playback: {
        save: vi.fn().mockResolvedValue({}),
        enqueue: vi.fn().mockResolvedValue({}),
        clearQueue: vi.fn().mockResolvedValue({}),
        removeFromQueue: vi.fn().mockResolvedValue({}),
      },
      setTrackState: vi.fn(),
      setPin: vi.fn(),
    },
    collections: {
      create: vi.fn(),
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
    },
    shares: { publishPlaylist: vi.fn() },
  },
}));

vi.mock("@/lib/studio/useAuth", () => ({
  useAuthState: () => ({ user: null, loading: false }),
  signIn: vi.fn(),
  signOutUser: vi.fn(),
}));

vi.mock("@/lib/studio/useBackend", () => ({
  useBackend: () => backend,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/share/playlist/shared-1",
  useRouter: () => ({
    push,
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock("next/dynamic", () => ({
  default:
    () =>
    (props: {
      playerRef: { current: unknown };
      url: string;
      playing: boolean;
      onReady: () => void;
      onEnded: () => void;
    }) => {
      hiddenPlayer.props = props;
      props.playerRef.current = { seekTo: hiddenPlayer.seekTo };
      return null;
    },
}));

import PublicListenClient from "./PublicListenClient";

const playlist: PublicPlaylist = {
  id: "shared-1",
  title: "A very long playlist title that remains inside the page",
  description: "A public playlist.",
  ownerName: "Yuki",
  tags: ["night"],
  cover: "mosaic",
  artUrl: "https://images.example/one.jpg",
  artUrls: ["https://images.example/one.jpg", "https://images.example/two.jpg"],
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

describe("PublicListenClient", () => {
  beforeEach(() => {
    hiddenPlayer.props = {} as typeof hiddenPlayer.props;
    push.mockClear();
  });

  it("uses the normal app shell and collection components anonymously", () => {
    render(<PublicListenClient playlist={playlist} kind="playlist" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      playlist.title
    );
    expect(
      screen.getByRole("complementary", { name: "Your Library" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "Now playing" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("First Track").length).toBeGreaterThan(0);
    expect(screen.getByText("Second Track")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Like First Track" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save playlist" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add music" })).toBeNull();
  });

  it("plays the preloaded public playlist through the normal global player", async () => {
    render(<PublicListenClient playlist={playlist} kind="playlist" />);

    fireEvent.click(screen.getByRole("button", { name: "Play collection" }));

    await waitFor(() => {
      expect(hiddenPlayer.props.url).toContain("watch?v=one");
      expect(hiddenPlayer.props.playing).toBe(true);
    });
    expect(
      screen
        .getAllByRole("button", { name: "Pause" })
        .some((button) => button.hasAttribute("disabled"))
    ).toBe(true);

    act(() => hiddenPlayer.props.onReady());
    expect(
      screen
        .getAllByRole("button", { name: "Pause" })
        .some((button) => !button.hasAttribute("disabled"))
    ).toBe(true);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Play Second Track" })[0]
    );
    await waitFor(() =>
      expect(hiddenPlayer.props.url).toContain("watch?v=two")
    );
  });

  it("continues to the next track when playback ends", async () => {
    render(<PublicListenClient playlist={playlist} kind="playlist" />);
    fireEvent.click(screen.getByRole("button", { name: "Play collection" }));
    await waitFor(() =>
      expect(hiddenPlayer.props.url).toContain("watch?v=one")
    );

    act(() => hiddenPlayer.props.onEnded());
    await waitFor(() => {
      expect(hiddenPlayer.props.url).toContain("watch?v=two");
      expect(hiddenPlayer.props.playing).toBe(true);
    });
  });
});
