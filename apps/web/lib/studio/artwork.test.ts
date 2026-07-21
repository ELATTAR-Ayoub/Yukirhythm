import { describe, it, expect } from "vitest";

import { collectionArtUrl, trackArtUrl, youtubeThumbUrl } from "./artwork";
import type { Collection, Track } from "@/lib/catalog/model";

/** A Track with only the fields these helpers read. */
function track(over: Partial<Track> = {}): Track {
  return {
    trackId: "abc123",
    source: { provider: "youtube", videoId: "abc123", url: "", aliasVideoIds: [] },
    artwork: [],
    ...over,
  } as Track;
}

function collection(over: Partial<Collection> = {}): Collection {
  return { cover: "texture", imageUrl: null, ...over } as Collection;
}

describe("youtubeThumbUrl", () => {
  it("builds the hqdefault URL for a video id", () => {
    expect(youtubeThumbUrl("dQw4w9WgXcQ")).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
    );
  });

  it("returns empty for a missing id rather than a broken URL", () => {
    expect(youtubeThumbUrl("")).toBe("");
  });
});

describe("trackArtUrl", () => {
  it("prefers the widest provider artwork", () => {
    const t = track({
      artwork: [
        { url: "https://cdn/small.jpg", width: 120, height: 90 },
        { url: "https://cdn/big.jpg", width: 640, height: 480 },
        { url: "https://cdn/mid.jpg", width: 320, height: 180 },
      ],
    });
    expect(trackArtUrl(t)).toBe("https://cdn/big.jpg");
  });

  it("ignores artwork entries with no url", () => {
    const t = track({
      artwork: [
        { url: "", width: 9999, height: 9999 },
        { url: "https://cdn/real.jpg", width: 100, height: 100 },
      ],
    });
    expect(trackArtUrl(t)).toBe("https://cdn/real.jpg");
  });

  it("derives a YouTube thumbnail when artwork is empty", () => {
    // Most of the catalogue predates enrichment; without this every one of
    // those tracks would fall through to a generated texture.
    const t = track({ artwork: [], source: { provider: "youtube", videoId: "xyz789", url: "", aliasVideoIds: [] } });
    expect(trackArtUrl(t)).toBe("https://i.ytimg.com/vi/xyz789/hqdefault.jpg");
  });

  it("falls back to the track id when source.videoId is missing", () => {
    const t = track({ artwork: [] });
    delete (t as { source?: unknown }).source;
    expect(trackArtUrl(t)).toBe("https://i.ytimg.com/vi/abc123/hqdefault.jpg");
  });

  it("returns empty when there is nothing to build a URL from", () => {
    const t = track({ artwork: [], trackId: "" });
    delete (t as { source?: unknown }).source;
    expect(trackArtUrl(t)).toBe("");
  });
});

describe("collectionArtUrl", () => {
  it("returns the stored image for an image cover", () => {
    expect(
      collectionArtUrl(collection({ cover: "image", imageUrl: "https://cdn/c.jpg" }))
    ).toBe("https://cdn/c.jpg");
  });

  it("returns empty for texture and mosaic covers", () => {
    expect(collectionArtUrl(collection({ cover: "texture", imageUrl: "https://cdn/c.jpg" }))).toBe("");
    expect(collectionArtUrl(collection({ cover: "mosaic", imageUrl: "https://cdn/c.jpg" }))).toBe("");
  });
});
