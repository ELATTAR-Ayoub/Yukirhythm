import type { Collection, Track, User } from "@/lib/catalog/model";
import type {
  MockCollection,
  MockTrack,
  MockUser,
} from "@/components/studio/screens/mock-data";

/**
 * Maps backend documents onto the shapes the design-system screens render.
 * Pure — the one bridge the migration (phase 8) leans on, so the existing
 * components run unchanged against real data. When the mock provider is
 * finally deleted, the screen components can adopt the backend shapes directly
 * and this file goes away; until then it keeps the swap a data change, not a
 * component rewrite.
 */

export function toStudioTrack(t: Track): MockTrack {
  return {
    id: t.trackId,
    title: t.title,
    // The screens show one artist string; join the structured list.
    artist: t.artists.map((a) => a.name).join(", ") || "Unknown",
    texture: t.texture,
    durationSec: t.durationSec ?? 0,
  };
}

export function toStudioCollection(
  c: Collection,
  opts: { pinned?: boolean } = {}
): MockCollection {
  return {
    id: c.collectionId,
    title: c.title,
    desc: c.description,
    texture: c.texture,
    // MockCollection supports texture|mosaic only; an image cover falls back to
    // its texture swatch (the mock art components do not render a remote image).
    cover: c.cover === "image" ? "texture" : c.cover,
    trackIds: (c.tracks ?? []).map((m) => m.trackId),
    likes: c.stats?.saveCount ?? 0,
    tags: c.tags ?? [],
    kind: c.contentType,
    // Pin state is per-user overlay, passed in by the provider.
    pinned: opts.pinned ?? false,
  };
}

/** "Yuki Sato" -> "YS"; one word -> first two letters; empty -> "?". */
export function initialsOf(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function toStudioUser(u: User): MockUser {
  return {
    id: u.userId,
    userName: u.displayName || "You",
    email: u.email,
    initials: initialsOf(u.displayName || u.email || "?"),
    followers: u.counts?.followerCount ?? 0,
    following: u.counts?.followingCount ?? 0,
  };
}
