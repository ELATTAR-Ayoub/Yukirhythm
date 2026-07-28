import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PublicPlaylist } from "@/lib/sharing/public";

const { hiddenPlayer } = vi.hoisted(() => ({
  hiddenPlayer: {
    props: {} as {
      url: string;
      playing: boolean;
      onReady: () => void;
      onEnded: () => void;
    },
    seekTo: vi.fn(),
  },
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
  it("renders a responsive anonymous playlist with playable tracks", () => {
    render(<PublicListenClient playlist={playlist} kind="playlist" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      playlist.title
    );
    expect(screen.getByText("Playlist by Yuki")).toBeInTheDocument();
    expect(screen.getAllByText("First Track").length).toBeGreaterThan(0);
    expect(screen.getByText("Second Track")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open app" })).toHaveAttribute(
      "href",
      "/auth"
    );
  });

  it("shows loading feedback and switches the hidden player source", () => {
    render(<PublicListenClient playlist={playlist} kind="playlist" />);

    fireEvent.click(screen.getByText("Play").closest("button")!);
    expect(screen.getByText("Loading audio...")).toBeInTheDocument();
    expect(hiddenPlayer.props.playing).toBe(true);

    act(() => hiddenPlayer.props.onReady());
    expect(
      screen.getAllByRole("button", { name: "Pause" }).length
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Play Second Track" }));
    expect(hiddenPlayer.props.url).toContain("watch?v=two");
    expect(screen.getByText("Loading audio...")).toBeInTheDocument();
  });

  it("continues to the next track when playback ends", () => {
    render(<PublicListenClient playlist={playlist} kind="playlist" />);
    act(() => hiddenPlayer.props.onEnded());
    expect(hiddenPlayer.props.url).toContain("watch?v=two");
    expect(hiddenPlayer.props.playing).toBe(true);
  });
});
