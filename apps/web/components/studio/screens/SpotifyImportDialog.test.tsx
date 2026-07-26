import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MockStudioContext, type MockStudioValue } from "./MockStudioProvider";
import type { MockCollection, MockTrack } from "./mock-data";
import SpotifyImportDialog from "./SpotifyImportDialog";
import { SPOTIFY_IMPORT_TOKEN_KEY } from "@/lib/spotify/import";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const matchedTrack: MockTrack = {
  id: "catalog-track",
  title: "Midnight Snowfall",
  artist: "Yuki Sato",
  durationSec: 214,
  texture: "tx-k2-vinyl",
};

const createdCollection: MockCollection = {
  id: "imported-playlist",
  title: "Snow",
  desc: "Imported",
  texture: "tx-k2-vinyl",
  cover: "mosaic",
  trackIds: [matchedTrack.id],
  likes: 0,
  tags: ["spotify-import"],
  kind: "music",
  pinned: false,
};

describe("SpotifyImportDialog", () => {
  beforeEach(() => {
    push.mockClear();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/library");
    window.sessionStorage.setItem(
      SPOTIFY_IMPORT_TOKEN_KEY,
      JSON.stringify({
        accessToken: "spotify-token",
        expiresAt: Date.now() + 60_000,
      })
    );
  });

  it("keeps showing progress and supports retry until the playlist is saved", async () => {
    let failCreate!: (reason: Error) => void;
    const createPromise = new Promise<MockCollection>((_resolve, reject) => {
      failCreate = reject;
    });
    const createCollectionAsync = vi
      .fn()
      .mockImplementationOnce(() => createPromise)
      .mockResolvedValueOnce(createdCollection);
    const searchTracks = vi.fn(async () => [matchedTrack]);
    const context = {
      searchTracks,
      createCollectionAsync,
    } as unknown as MockStudioValue;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          items: [
            {
              id: "spotify-playlist",
              name: "Snow",
              description: "Imported",
              items: { total: 1 },
              external_urls: {
                spotify: "https://open.spotify.com/playlist/spotify-playlist",
              },
            },
          ],
          next: null,
        })
      )
      .mockResolvedValueOnce(
        json({
          items: [
            {
              item: {
                id: "spotify-track",
                type: "track",
                name: "Midnight Snowfall",
                duration_ms: 214_000,
                artists: [{ name: "Yuki Sato" }],
                external_urls: {
                  spotify: "https://open.spotify.com/track/spotify-track",
                },
              },
            },
          ],
          next: null,
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MockStudioContext.Provider value={context}>
        <SpotifyImportDialog open onOpenChange={vi.fn()} />
      </MockStudioContext.Provider>
    );
    expect(
      screen.getByRole("dialog", { name: "Import Spotify playlist" })
    ).toHaveClass(
      "max-h-[calc(100dvh-2rem)]",
      "w-[calc(100vw-2rem)]",
      "overflow-hidden"
    );

    const playlist = await screen.findByRole("button", {
      name: /Snow.*Select to match tracks/i,
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loaded 1 Spotify playlist"
    );

    fireEvent.click(playlist);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Reading “Snow” from Spotify"
    );

    const importButton = await screen.findByRole("button", {
      name: "Import 1 matched track",
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Matched 1 of 1 tracks"
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Removed “Midnight Snowfall” from this import"
    );
    expect(importButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Add back" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Added “Midnight Snowfall” to this import"
    );
    expect(importButton).toBeEnabled();

    fireEvent.click(importButton);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Creating “Snow” and saving 1 tracks"
    );
    expect(
      screen.getByRole("progressbar", {
        name: "Spotify playlist import progress",
      })
    ).toHaveAttribute("aria-valuenow", "0");
    expect(screen.queryByText("Import complete")).not.toBeInTheDocument();

    expect(createCollectionAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Snow",
        trackIds: [matchedTrack.id],
        tags: ["spotify-import"],
      })
    );

    await act(async () => failCreate(new Error("offline")));
    const retrySave = await screen.findByRole("button", {
      name: "Retry save",
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Could not save the playlist: offline"
    );
    expect(screen.queryByText("Import complete")).not.toBeInTheDocument();

    fireEvent.click(retrySave);

    await waitFor(() =>
      expect(screen.getByText("Import complete")).toBeVisible()
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Imported “Snow” with 1 tracks successfully"
    );
    expect(createCollectionAsync).toHaveBeenCalledTimes(2);
  });
});
