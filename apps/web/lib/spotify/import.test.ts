import { describe, expect, it, vi } from "vitest";

import type { MockTrack } from "@/components/studio/screens/mock-data";
import {
  SPOTIFY_IMPORT_SCOPES,
  SpotifyImportError,
  fetchSpotifyImportSources,
  fetchSpotifyLikedSongsTracks,
  fetchSpotifyPlaylistTracks,
  fetchSpotifyPlaylists,
  pickBestSpotifyMatch,
  scoreSpotifyMatch,
  spotifySearchQuery,
  type SpotifySourceTrack,
} from "./import";

const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

describe("Spotify playlist import helpers", () => {
  it("always puts Liked Songs before Spotify playlists", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/me/tracks?limit=1")) {
        return json({ items: [], total: 73, next: null });
      }
      if (url.includes("/me/playlists")) {
        return json({
          items: [{ id: "playlist", name: "Night drive", items: { total: 4 } }],
          next: null,
        });
      }
      return json({ error: { message: "Unexpected request" } }, 500);
    });

    const sources = await fetchSpotifyImportSources("access", fetchMock);

    expect(sources.map((source) => source.name)).toEqual([
      "Liked Songs",
      "Night drive",
    ]);
    expect(sources[0]).toMatchObject({
      source: "liked-songs",
      itemCount: 73,
    });
    expect(SPOTIFY_IMPORT_SCOPES).toContain("user-library-read");
  });

  it("loads every playlist page and accepts the current items count shape", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          items: [
            {
              id: "p1",
              name: "Night drive",
              description: "After dark",
              images: [{ url: "https://img.test/p1" }],
              items: { total: 42 },
              external_urls: {
                spotify: "https://open.spotify.com/playlist/p1",
              },
            },
          ],
          next: "https://api.spotify.com/v1/me/playlists?offset=50",
        })
      )
      .mockResolvedValueOnce(
        json({
          items: [
            {
              id: "p2",
              name: "Focus",
              tracks: { total: 3 },
            },
          ],
          next: null,
        })
      );

    const playlists = await fetchSpotifyPlaylists("access", fetchMock);

    expect(playlists).toHaveLength(2);
    expect(playlists[0]).toMatchObject({
      id: "p1",
      itemCount: 42,
      imageUrl: "https://img.test/p1",
    });
    expect(playlists[1]).toMatchObject({ id: "p2", itemCount: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { Authorization: "Bearer access" },
    });
  });

  it("reads modern item and migration-era track wrappers, preserving order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json({
        items: [
          {
            item: {
              id: "s1",
              type: "track",
              name: "Midnight Snowfall",
              duration_ms: 201000,
              artists: [{ name: "Aiko Vale" }],
              album: { name: "Blue Hour" },
              external_urls: {
                spotify: "https://open.spotify.com/track/s1",
              },
            },
          },
          {
            track: {
              id: "s2",
              type: "track",
              name: "Glass Satellites",
              artists: [{ name: "Neon Koi" }],
            },
          },
          { item: { id: "episode", type: "episode", name: "Talk" } },
          {
            item: {
              id: "local",
              type: "track",
              is_local: true,
              name: "Local file",
              artists: [{ name: "Someone" }],
            },
          },
          { item: null },
        ],
        next: null,
      })
    );

    const result = await fetchSpotifyPlaylistTracks(
      "playlist",
      "access",
      fetchMock
    );

    expect(result.tracks.map((track) => track.id)).toEqual(["s1", "s2"]);
    expect(result.tracks.map((track) => track.position)).toEqual([0, 1]);
    expect(result.tracks[0]?.durationSec).toBe(201);
    expect(result.skipped).toBe(3);
  });

  it("loads every Liked Songs page and skips unavailable saved tracks", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          items: [
            {
              track: {
                id: "liked-1",
                type: "track",
                name: "Midnight Snowfall",
                duration_ms: 214000,
                artists: [{ name: "Yuki Sato" }],
              },
            },
            {
              track: {
                id: "local",
                type: "track",
                is_local: true,
                name: "Local",
                artists: [{ name: "Someone" }],
              },
            },
          ],
          next: "https://api.spotify.com/v1/me/tracks?limit=50&offset=50",
        })
      )
      .mockResolvedValueOnce(
        json({
          items: [
            {
              item: {
                id: "liked-2",
                type: "track",
                name: "Paper Lanterns",
                artists: [{ name: "Rei Kurosawa" }],
              },
            },
          ],
          next: null,
        })
      );

    const result = await fetchSpotifyLikedSongsTracks("access", fetchMock);

    expect(result.tracks.map((track) => track.id)).toEqual([
      "liked-1",
      "liked-2",
    ]);
    expect(result.tracks.map((track) => track.position)).toEqual([0, 2]);
    expect(result.skipped).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns an actionable error for a followed playlist Spotify will not expose", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json({ error: { message: "Forbidden" } }, 403));

    await expect(
      fetchSpotifyPlaylistTracks("followed", "access", fetchMock)
    ).rejects.toEqual(
      new SpotifyImportError(
        "Spotify only allows importing playlists you own or collaborate on.",
        403,
        undefined
      )
    );
  });

  it("prefers a title-and-artist match over a similarly titled result", () => {
    const source: SpotifySourceTrack = {
      id: "spotify-1",
      title: "Midnight Snowfall",
      artists: ["Aiko Vale"],
      album: "Blue Hour",
      durationSec: 200,
      externalUrl: "",
      position: 0,
    };
    const wrong: MockTrack = {
      id: "wrong",
      title: "Midnight",
      artist: "Another Artist",
      durationSec: 200,
      texture: "tx-k-silk",
    };
    const right: MockTrack = {
      id: "right",
      title: "Midnight Snowfall",
      artist: "Aiko Vale",
      durationSec: 201,
      texture: "tx-k-silk",
    };

    expect(scoreSpotifyMatch(source, right)).toBeGreaterThan(
      scoreSpotifyMatch(source, wrong)
    );
    expect(pickBestSpotifyMatch(source, [wrong, right]).track?.id).toBe(
      "right"
    );
    expect(spotifySearchQuery(source)).toBe("Midnight Snowfall Aiko Vale");
  });
});
