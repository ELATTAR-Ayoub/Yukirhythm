import type { Collection, StatsRollup, Track, User } from "@/lib/catalog/model";
import type {
  HistoryGroup,
  MockCollection,
  MockHistoryEntry,
  MockStats,
  MockTrack,
  MockUser,
} from "@/components/studio/screens/mock-data";
import { collectionArtUrl, trackArtUrl } from "./artwork";

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
    artUrl: trackArtUrl(t),
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
    // An image cover renders as an image now that Artwork can draw one; it
    // used to be downgraded to the texture swatch, which was data loss.
    cover: c.cover,
    artUrl: collectionArtUrl(c),
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

/** Backend rollup → the shape /profile/stats renders. */
export function toStudioStats(s: StatsRollup): MockStats {
  return {
    minutesWeek: s.minutesWeek,
    minutesMonth: s.minutesMonth,
    minutesAllTime: s.minutesAllTime,
    streakDays: s.streakDays,
    topArtists: s.topArtists.map((a) => ({ name: a.name, plays: a.plays })),
    topTrackIds: s.topTrackIds,
    // the screen calls the label "name"
    genreSplit: s.genreSplit.map((g) => ({ name: g.label, pct: g.pct })),
    byHour: s.byHour,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Buckets a play into the group /profile/recents renders. The screen's groups
 * are relative to now, so they are derived here rather than stored — a play
 * that was "Today" yesterday must read as "Yesterday" tomorrow.
 */
export function historyGroupOf(
  startedAtMs: number,
  nowMs: number
): HistoryGroup {
  const startOfToday = new Date(nowMs);
  startOfToday.setHours(0, 0, 0, 0);
  if (startedAtMs >= startOfToday.getTime()) return "Today";
  if (startedAtMs >= startOfToday.getTime() - DAY_MS) return "Yesterday";
  return "This week";
}

/** "09:12" for today/yesterday, weekday ("Tue") for older — matches the screen. */
export function historyTimeLabel(
  startedAtMs: number,
  group: HistoryGroup
): string {
  const d = new Date(startedAtMs);
  if (group === "This week") {
    return d.toLocaleDateString("en-US", { weekday: "short" });
  }
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function toStudioHistory(
  items: {
    trackId: string;
    startedAtMs: number;
    collection: { collectionId: string } | null;
  }[],
  nowMs: number
): MockHistoryEntry[] {
  return items.map((i) => {
    const group = historyGroupOf(i.startedAtMs, nowMs);
    return {
      trackId: i.trackId,
      collectionId: i.collection?.collectionId ?? "",
      group,
      timeLabel: historyTimeLabel(i.startedAtMs, group),
    };
  });
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
