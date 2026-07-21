import { describe, it, expect } from "vitest";
import { computeStats, computeStreak, localDate, type StatEvent } from "./stats";
import type { Track } from "./model";

const TZ = "UTC";
const NOW = Date.parse("2026-07-20T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function ev(over: Partial<StatEvent>): StatEvent {
  return {
    eventId: "e",
    userId: "u",
    trackId: "t1",
    collectionId: null,
    startedAtMs: NOW,
    listenedSec: 120,
    completed: true,
    skipped: false,
    source: "library",
    recommendationId: null,
    deviceId: "",
    clientHourOfDay: 12,
    ...over,
  };
}

function track(over: Partial<Track>): Track {
  return {
    trackId: "t1",
    type: "track",
    title: "T",
    artists: [{ artistId: "a1", name: "Artist One" }],
    album: null,
    durationSec: 200,
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

describe("localDate", () => {
  it("renders YYYY-MM-DD in the given zone", () => {
    expect(localDate(NOW, "UTC")).toBe("2026-07-20");
    // 12:00 UTC is still 2026-07-20 in New York (08:00)
    expect(localDate(NOW, "America/New_York")).toBe("2026-07-20");
    // 00:30 UTC on the 20th is the 19th in New York
    expect(localDate(Date.parse("2026-07-20T00:30:00Z"), "America/New_York")).toBe(
      "2026-07-19"
    );
  });
});

describe("minutes windows", () => {
  it("drops an 8-day-old play from minutesWeek but keeps it in month", () => {
    const events = [
      ev({ startedAtMs: NOW, listenedSec: 600 }), // this week
      ev({ startedAtMs: NOW - 8 * DAY, listenedSec: 600 }), // 8 days ago
    ];
    const s = computeStats(events, new Map(), NOW, TZ);
    expect(s.minutesWeek).toBe(10); // only the recent 600s
    expect(s.minutesMonth).toBe(20); // both
    expect(s.minutesAllTime).toBe(20);
  });
});

describe("computeStreak", () => {
  const mk = (days: number[]) =>
    new Set(days.map((d) => localDate(NOW - d * DAY, TZ)));

  it("counts consecutive days back from today", () => {
    expect(computeStreak(mk([0, 1, 2]), NOW, TZ).streakDays).toBe(3);
  });

  it("does not break a streak just because today has no play yet", () => {
    expect(computeStreak(mk([1, 2, 3]), NOW, TZ).streakDays).toBe(3);
  });

  it("breaks on a missing day", () => {
    expect(computeStreak(mk([0, 1, 3]), NOW, TZ).streakDays).toBe(2);
  });

  it("is zero when the most recent play is older than yesterday", () => {
    expect(computeStreak(mk([3, 4]), NOW, TZ).streakDays).toBe(0);
  });
});

describe("top artists / tracks", () => {
  it("ranks by completed play count", () => {
    const tracks = new Map<string, Track>([
      ["t1", track({ trackId: "t1", artists: [{ artistId: "a1", name: "One" }] })],
      ["t2", track({ trackId: "t2", artists: [{ artistId: "a2", name: "Two" }] })],
    ]);
    const events = [
      ev({ trackId: "t1" }),
      ev({ trackId: "t1" }),
      ev({ trackId: "t2" }),
      ev({ trackId: "t2", completed: false, skipped: true }), // skip: not counted
    ];
    const s = computeStats(events, tracks, NOW, TZ);
    expect(s.topArtists[0]).toEqual({ artistId: "a1", name: "One", plays: 2 });
    expect(s.topTrackIds).toEqual(["t1", "t2"]);
  });
});

describe("genre split", () => {
  it("normalises labelled listening to 100 and excludes unlabelled tracks", () => {
    const tracks = new Map<string, Track>([
      ["t1", track({ trackId: "t1", labelIds: ["lofi"] })],
      ["t2", track({ trackId: "t2", labelIds: ["ambient"] })],
      ["t3", track({ trackId: "t3", labelIds: [] })], // unlabelled, excluded
    ]);
    const events = [
      ev({ trackId: "t1", listenedSec: 300 }),
      ev({ trackId: "t2", listenedSec: 100 }),
      ev({ trackId: "t3", listenedSec: 600 }),
    ];
    const s = computeStats(events, tracks, NOW, TZ);
    // denominator is 300+100 = 400, not 1000
    expect(s.genreSplit).toEqual([
      { label: "lofi", pct: 75 },
      { label: "ambient", pct: 25 },
    ]);
  });

  it("is empty when nothing is labelled — not fabricated", () => {
    const tracks = new Map<string, Track>([["t1", track({ labelIds: [] })]]);
    const s = computeStats([ev({ trackId: "t1" })], tracks, NOW, TZ);
    expect(s.genreSplit).toEqual([]);
  });
});

describe("byHour", () => {
  it("buckets completed plays by clientHourOfDay, peak normalised to 1", () => {
    const events = [
      ev({ clientHourOfDay: 9 }),
      ev({ clientHourOfDay: 9 }),
      ev({ clientHourOfDay: 22 }),
    ];
    const s = computeStats(events, new Map(), NOW, TZ);
    expect(s.byHour[9]).toBe(1); // peak
    expect(s.byHour[22]).toBe(0.5);
    expect(s.byHour[0]).toBe(0);
    expect(s.byHour).toHaveLength(24);
  });
});
