import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import type { Track } from "@/lib/catalog/model";
import type { MockCollection } from "./mock-data";

const backend = vi.hoisted(() => ({
  catalog: {
    tracksByIds: vi.fn(),
    track: vi.fn(),
  },
}));

vi.mock("@/lib/studio/useBackend", () => ({
  useBackend: () => backend,
}));

import useResolvedCollectionTracks from "./useResolvedCollectionTracks";

function catalogTrack(trackId: string): Track {
  return {
    trackId,
    type: "track",
    title: `Track ${trackId}`,
    artists: [{ artistId: "artist", name: "Artist" }],
    album: null,
    durationSec: 180,
    artwork: [
      {
        url: `https://images.test/${trackId}.jpg`,
        width: 1280,
        height: 720,
      },
    ],
    texture: "tx-k-silk",
    source: {
      provider: "youtube",
      videoId: trackId,
      url: `https://youtube.test/watch?v=${trackId}`,
      aliasVideoIds: [],
    },
    isEmbeddable: true,
    isLive: false,
    isFamilySafe: true,
    stats: { viewCount: 0, likeCount: 0, playCount: 0 },
    publishedAt: null,
    labels: [],
    labelIds: [],
    keywords: [],
    enrichedAt: null,
    schemaVersion: 1,
  };
}

function collection(trackIds: string[]): MockCollection {
  return {
    id: "collection-complete-tracks",
    title: "Complete tracks",
    desc: "",
    texture: "tx-k-marble",
    cover: "mosaic",
    trackIds,
    likes: 0,
    tags: [],
    kind: "music",
    pinned: false,
  };
}

describe("useResolvedCollectionTracks", () => {
  beforeEach(() => {
    backend.catalog.tracksByIds.mockReset();
    backend.catalog.track.mockReset();
  });

  it("renders every membership in playlist order from the batched documents", async () => {
    const ids = Array.from({ length: 125 }, (_, index) => `complete-${index}`);
    backend.catalog.tracksByIds.mockResolvedValue({
      tracks: ids.map(catalogTrack),
      missingTrackIds: [],
    });

    const { result } = renderHook(() =>
      useResolvedCollectionTracks(collection(ids))
    );

    expect(result.current.tracks).toBeNull();
    await waitFor(() => expect(result.current.tracks).toHaveLength(125));
    expect(result.current.tracks?.map((track) => track.id)).toEqual(ids);
    expect(result.current.tracks?.[0]?.artUrl).toBe(
      "https://images.test/complete-0.jpg"
    );
    expect(backend.catalog.tracksByIds).toHaveBeenCalledWith(ids);
    expect(result.current.missingTrackIds).toEqual([]);
  });

  it("recovers a legacy membership whose track document is missing", async () => {
    const ids = ["legacy-present", "legacy-recoverable"];
    backend.catalog.tracksByIds.mockResolvedValue({
      tracks: [catalogTrack(ids[0])],
      missingTrackIds: [ids[1]],
    });
    backend.catalog.track.mockResolvedValue(catalogTrack(ids[1]));

    const { result } = renderHook(() =>
      useResolvedCollectionTracks(collection(ids))
    );

    await waitFor(() => expect(result.current.tracks).toHaveLength(2));
    expect(result.current.tracks?.map((track) => track.id)).toEqual(ids);
    expect(backend.catalog.track).toHaveBeenCalledWith(ids[1]);
    expect(result.current.missingTrackIds).toEqual([]);
  });

  it("reports a genuinely unavailable membership instead of dropping it silently", async () => {
    const ids = ["unavailable-present", "unavailable-missing"];
    backend.catalog.tracksByIds.mockResolvedValue({
      tracks: [catalogTrack(ids[0])],
      missingTrackIds: [ids[1]],
    });
    backend.catalog.track.mockRejectedValue(new Error("not found"));

    const { result } = renderHook(() =>
      useResolvedCollectionTracks(collection(ids))
    );

    await waitFor(() => expect(result.current.tracks).toHaveLength(1));
    expect(result.current.missingTrackIds).toEqual([ids[1]]);
  });
});
