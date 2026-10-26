import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MockTrack } from "./mock-data";
import {
  clearCachedStudioFeeds,
  useCachedStudioFeed,
} from "./useCachedStudioFeed";

const feedApi = vi.hoisted(() => ({
  newReleases: vi.fn(),
  youMightLike: vi.fn(),
}));

vi.mock("@/lib/studio/useBackend", () => ({
  useBackend: () => ({ feed: feedApi }),
}));

const providerTrack: MockTrack = {
  id: "provider-track",
  title: "Provider result",
  artist: "Provider Artist",
  texture: "tx-k2-vinyl",
  durationSec: 180,
};
const providerTracks = [providerTrack];

function Probe({
  loading = false,
  tracks = providerTracks,
  userId = "user-1",
}: {
  loading?: boolean;
  tracks?: MockTrack[];
  userId?: string;
}) {
  const feed = useCachedStudioFeed({
    feed: "new-releases",
    userId,
    providerTracks: tracks,
    providerLoading: loading,
  });

  return (
    <div>
      <span data-testid="state">{feed.loading ? "loading" : "ready"}</span>
      <span data-testid="tracks">
        {feed.tracks.map((track) => track.id).join()}
      </span>
      <button type="button" aria-busy={feed.refreshing} onClick={feed.refresh}>
        Refresh
      </button>
    </div>
  );
}

describe("useCachedStudioFeed", () => {
  beforeEach(() => {
    window.localStorage.clear();
    feedApi.newReleases.mockReset();
    feedApi.youMightLike.mockReset();
  });

  it("renders a completed shelf independently of the aggregate loading flag", () => {
    render(<Probe loading />);

    expect(screen.getByTestId("state")).toHaveTextContent("ready");
    expect(screen.getByTestId("tracks")).toHaveTextContent("provider-track");
  });

  it("restores the saved result instead of replacing it on a revisit", () => {
    window.localStorage.setItem(
      "yukirhythm:feed:v2:user-1:new-releases",
      JSON.stringify({
        tracks: [{ ...providerTrack, id: "saved-track", title: "Saved" }],
      })
    );

    render(<Probe loading tracks={[]} />);

    expect(screen.getByTestId("state")).toHaveTextContent("ready");
    expect(screen.getByTestId("tracks")).toHaveTextContent("saved-track");
  });

  it("shows refresh progress and persists the independently refreshed result", async () => {
    let finishRefresh: (value: unknown) => void = () => {};
    feedApi.newReleases.mockReturnValue(
      new Promise((resolve) => {
        finishRefresh = resolve;
      })
    );
    render(<Probe />);

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(screen.getByRole("button", { name: "Refresh" })).toHaveAttribute(
      "aria-busy",
      "true"
    );

    await act(async () => {
      finishRefresh({
        items: [
          {
            track: {
              trackId: "refreshed-track",
              title: "Refreshed",
              artists: [{ artistId: "artist", name: "Refresh Artist" }],
              artwork: [],
              texture: "tx-k2-topo",
              durationSec: 200,
            },
          },
        ],
      });
    });

    expect(screen.getByTestId("tracks")).toHaveTextContent("refreshed-track");
    expect(screen.getByRole("button", { name: "Refresh" })).toHaveAttribute(
      "aria-busy",
      "false"
    );
    expect(
      window.localStorage.getItem("yukirhythm:feed:v2:user-1:new-releases")
    ).toContain("refreshed-track");
  });

  it("ignores a refresh response belonging to the previous account", async () => {
    let finish!: (value: unknown) => void;
    feedApi.newReleases.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const view = render(<Probe />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    view.rerender(
      <Probe
        userId="user-2"
        tracks={[{ ...providerTrack, id: "other-account" }]}
      />
    );
    await act(async () => {
      finish({ items: [] });
    });
    expect(screen.getByTestId("tracks")).toHaveTextContent("other-account");
  });

  it("fetches fresh data after privacy invalidates a cached feed", async () => {
    clearCachedStudioFeeds("user-1");
    feedApi.newReleases.mockResolvedValueOnce({ items: [] });
    render(<Probe />);
    await act(async () => {});
    expect(feedApi.newReleases).toHaveBeenCalledWith(true);
    expect(screen.getByTestId("tracks")).not.toHaveTextContent(
      "provider-track"
    );
  });

  it("deduplicates rapid refresh clicks", async () => {
    let finish!: (value: unknown) => void;
    feedApi.newReleases.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    render(<Probe />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(feedApi.newReleases).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish({ items: [] });
    });
  });
});
