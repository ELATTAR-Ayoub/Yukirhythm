import { describe, it, expect } from "vitest";
import {
  toStudioTrack,
  toStudioCollection,
  toStudioUser,
  initialsOf,
} from "./adapt";
import type { Collection, Track, User } from "@/lib/catalog/model";

function track(over: Partial<Track> = {}): Track {
  return {
    trackId: "t1",
    type: "track",
    title: "Instant Crush",
    artists: [
      { artistId: "a1", name: "Daft Punk" },
      { artistId: "a2", name: "Julian Casablancas" },
    ],
    album: null,
    durationSec: 338,
    artwork: [],
    texture: "tx-k-silk",
    source: { provider: "youtube", videoId: "t1", url: "", aliasVideoIds: [] },
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
    ...over,
  } as Track;
}

function collection(over: Partial<Collection> = {}): Collection {
  return {
    collectionId: "c1",
    ownerId: "u1",
    role: "playlist",
    contentType: "music",
    title: "Night Drive",
    description: "neon",
    tags: ["night"],
    cover: "mosaic",
    texture: "tx-k2-vinyl",
    imageUrl: null,
    tracks: [
      { trackId: "t1", addedAt: null as never, addedBy: "u1" },
      { trackId: "t2", addedAt: null as never, addedBy: "u1" },
    ],
    visibility: "private",
    stats: { trackCount: 2, totalDurationSec: 0, saveCount: 7, playCount: 0 },
    createdAt: null as never,
    updatedAt: null as never,
    ...over,
  } as Collection;
}

function user(over: Partial<User> = {}): User {
  return {
    userId: "u1",
    displayName: "Yuki Sato",
    handle: null,
    email: "yuki@x.com",
    avatarUrl: null,
    bio: null,
    authProvider: "google",
    counts: { followerCount: 1240, followingCount: 318, collectionCount: 3 },
    privacy: { saveHistory: true, personalization: true, publicProfile: false },
    settings: { audioQuality: "auto", language: "en", theme: "system" },
    createdAt: null as never,
    ...over,
  } as User;
}

describe("toStudioTrack", () => {
  it("joins the structured artist list into one string", () => {
    const m = toStudioTrack(track());
    expect(m.id).toBe("t1");
    expect(m.artist).toBe("Daft Punk, Julian Casablancas");
    expect(m.durationSec).toBe(338);
    expect(m.texture).toBe("tx-k-silk");
  });

  it("defaults a null duration to 0 and empty artists to Unknown", () => {
    const m = toStudioTrack(track({ durationSec: null, artists: [] }));
    expect(m.durationSec).toBe(0);
    expect(m.artist).toBe("Unknown");
  });
});

describe("toStudioCollection", () => {
  it("maps fields and flattens membership to trackIds", () => {
    const m = toStudioCollection(collection());
    expect(m.id).toBe("c1");
    expect(m.desc).toBe("neon");
    expect(m.trackIds).toEqual(["t1", "t2"]);
    expect(m.likes).toBe(7); // saveCount
    expect(m.kind).toBe("music"); // contentType
    expect(m.cover).toBe("mosaic");
    expect(m.pinned).toBe(false);
  });

  it("takes pin state from the provider and keeps an image cover as-is", () => {
    const m = toStudioCollection(collection({ cover: "image" }), { pinned: true });
    expect(m.pinned).toBe(true);
    expect(m.cover).toBe("image");
  });
});

describe("initialsOf", () => {
  it("builds initials from a full name, one word, or nothing", () => {
    expect(initialsOf("Yuki Sato")).toBe("YS");
    expect(initialsOf("Ayoub")).toBe("AY");
    expect(initialsOf("  ")).toBe("?");
  });
});

describe("toStudioUser", () => {
  it("maps counts and derives initials", () => {
    const m = toStudioUser(user());
    expect(m.id).toBe("u1");
    expect(m.userName).toBe("Yuki Sato");
    expect(m.initials).toBe("YS");
    expect(m.followers).toBe(1240);
    expect(m.following).toBe(318);
  });
});

describe("artwork carried onto the studio shapes", () => {
  it("carries the widest provider artwork onto the track", () => {
    const t = {
      trackId: "abc123",
      title: "Realize",
      artists: [{ artistId: "a1", name: "鈴木このみ" }],
      durationSec: 244,
      texture: "tx-k2-vinyl",
      artwork: [
        { url: "https://cdn/small.jpg", width: 120, height: 90 },
        { url: "https://cdn/big.jpg", width: 640, height: 480 },
      ],
      source: { provider: "youtube", videoId: "abc123", url: "", aliasVideoIds: [] },
    } as unknown as Parameters<typeof toStudioTrack>[0];

    expect(toStudioTrack(t).artUrl).toBe("https://cdn/big.jpg");
  });

  it("derives a YouTube thumbnail for a track with no stored artwork", () => {
    const t = {
      trackId: "xyz789",
      title: "il vento d'oro",
      artists: [{ artistId: "a2", name: "YUGO KANNO" }],
      durationSec: 296,
      texture: "tx-k-silk",
      artwork: [],
      source: { provider: "youtube", videoId: "xyz789", url: "", aliasVideoIds: [] },
    } as unknown as Parameters<typeof toStudioTrack>[0];

    expect(toStudioTrack(t).artUrl).toBe(
      "https://i.ytimg.com/vi/xyz789/hqdefault.jpg"
    );
  });

  it("keeps an image cover as an image instead of downgrading it to a texture", () => {
    // The old adapter rewrote cover:"image" to "texture" because the mock art
    // components could not render a remote image. Artwork can, so the
    // downgrade is now pure data loss.
    const c = {
      collectionId: "c1",
      title: "Late Study Lo-Fi",
      description: "Quiet loops.",
      texture: "tx-k2-topo",
      cover: "image",
      imageUrl: "https://cdn/cover.jpg",
      tracks: [],
      tags: [],
      contentType: "music",
      stats: { trackCount: 0, totalDurationSec: 0, saveCount: 0, playCount: 0 },
    } as unknown as Parameters<typeof toStudioCollection>[0];

    const out = toStudioCollection(c);
    expect(out.cover).toBe("image");
    expect(out.artUrl).toBe("https://cdn/cover.jpg");
  });
});
