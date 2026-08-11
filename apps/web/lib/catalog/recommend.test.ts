import { describe, it, expect } from "vitest";
import {
  pickJumpBackIn,
  artistAffinityFrom,
  buildRecentTasteProfile,
  diversifyByArtist,
  scoreNewReleases,
  blendYouMightLike,
} from "./recommend";
import type { StatEvent } from "./stats";
import type { Track } from "./model";

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
    source: "collection",
    recommendationId: null,
    deviceId: "",
    clientHourOfDay: 12,
    ...over,
  };
}

function track(id: string, over: Partial<Track> = {}): Track {
  return {
    trackId: id,
    type: "track",
    title: id,
    artists: [{ artistId: `a-${id}`, name: `Artist ${id}` }],
    album: null,
    durationSec: 200,
    artwork: [],
    texture: "tx-k-silk",
    source: { provider: "youtube", videoId: id, url: "", aliasVideoIds: [] },
    isEmbeddable: true,
    isLive: false,
    isFamilySafe: true,
    stats: { viewCount: 1000, likeCount: 0, playCount: 0 },
    publishedAt: null,
    labels: [],
    labelIds: [],
    keywords: [],
    enrichedAt: null,
    schemaVersion: 1,
    ...over,
  } as Track;
}

describe("pickJumpBackIn", () => {
  it("dedupes collections, most-recent first, within 30 days, capped", () => {
    const events = [
      ev({ collectionId: "c2", startedAtMs: NOW }),
      ev({ collectionId: "c1", startedAtMs: NOW - 1000 }),
      ev({ collectionId: "c2", startedAtMs: NOW - 2000 }), // dup, older
      ev({ collectionId: "c3", startedAtMs: NOW - 40 * DAY }), // too old
    ];
    expect(pickJumpBackIn(events, NOW)).toEqual(["c2", "c1"]);
  });

  it("respects the cap", () => {
    const events = Array.from({ length: 20 }, (_, i) =>
      ev({ collectionId: `c${i}`, startedAtMs: NOW - i })
    );
    expect(pickJumpBackIn(events, NOW, 5)).toHaveLength(5);
  });
});

describe("artistAffinityFrom", () => {
  it("normalises play share so the top artist is 1", () => {
    const tracks = new Map([
      ["t1", track("t1", { artists: [{ artistId: "A", name: "A" }] })],
      ["t2", track("t2", { artists: [{ artistId: "B", name: "B" }] })],
    ]);
    const events = [
      ev({ trackId: "t1" }),
      ev({ trackId: "t1" }),
      ev({ trackId: "t2" }),
    ];
    const aff = artistAffinityFrom(events, tracks);
    expect(aff.get("A")).toBe(1);
    expect(aff.get("B")).toBe(0.5);
  });
});

describe("diversifyByArtist", () => {
  it("prefers artist variety and still backfills all 15 slots", () => {
    const tracks = new Map<string, Track>();
    const recommendations = Array.from({ length: 20 }, (_, index) => {
      const id = `t${index}`;
      tracks.set(
        id,
        track(id, {
          artists: [
            {
              artistId: index === 10 ? "other" : "same",
              name: index === 10 ? "Other" : "Same",
            },
          ],
        })
      );
      return {
        trackId: id,
        score: 20 - index,
        reason: "test",
        recommendationId: `r:${id}`,
      };
    });
    const out = diversifyByArtist(recommendations, tracks);
    expect(out).toHaveLength(15);
    expect(out.slice(0, 3).map((item) => item.trackId)).toEqual([
      "t0",
      "t1",
      "t10",
    ]);
  });
});

describe("buildRecentTasteProfile", () => {
  it("weights all four engagement states in order", () => {
    const tracks = new Map([
      ["near", track("near")],
      ["complete", track("complete")],
      ["sample", track("sample")],
      ["skip", track("skip")],
    ]);
    const profile = buildRecentTasteProfile(
      [
        ev({ trackId: "near", engagement: "near-complete" }),
        ev({ trackId: "complete", engagement: "completed" }),
        ev({ trackId: "sample", engagement: "sampled" }),
        ev({ trackId: "skip", engagement: "quick-skip" }),
      ],
      tracks,
      NOW
    );

    expect(profile.trackAffinity.get("near")).toBe(1);
    expect(profile.trackAffinity.get("complete")).toBeCloseTo(1 / 1.2);
    expect(profile.trackAffinity.get("sample")).toBeCloseTo(0.45 / 1.2);
    expect(profile.trackAffinity.has("skip")).toBe(false);
  });

  it("favours recent completed plays, penalises skips, and diversifies seeds", () => {
    const tracks = new Map([
      ["recent", track("recent", { artists: [{ artistId: "A", name: "A" }] })],
      [
        "same-artist",
        track("same-artist", { artists: [{ artistId: "A", name: "A" }] }),
      ],
      ["other", track("other", { artists: [{ artistId: "B", name: "B" }] })],
    ]);
    const profile = buildRecentTasteProfile(
      [
        ev({ trackId: "recent", startedAtMs: NOW }),
        ev({ trackId: "same-artist", startedAtMs: NOW - DAY }),
        ev({
          trackId: "other",
          startedAtMs: NOW,
          listenedSec: 5,
          completed: false,
          skipped: true,
        }),
      ],
      tracks,
      NOW
    );
    expect(profile.trackAffinity.get("recent")).toBe(1);
    expect(profile.trackAffinity.has("other")).toBe(false);
    expect(profile.seedTrackIds).toEqual(["recent"]);
  });

  it("drops listening outside the 60-day taste window", () => {
    const profile = buildRecentTasteProfile(
      [ev({ trackId: "old", startedAtMs: NOW - 61 * DAY })],
      new Map([["old", track("old")]]),
      NOW
    );
    expect(profile.seedTrackIds).toEqual([]);
  });
});

describe("scoreNewReleases", () => {
  it("ranks an affinity artist above an unknown one, all else equal", () => {
    const aff = new Map([["a-known", 1]]);
    const known = track("known", {
      artists: [{ artistId: "a-known", name: "Known" }],
    });
    const unknown = track("unknown", {
      artists: [{ artistId: "a-x", name: "X" }],
    });
    const ranked = scoreNewReleases([unknown, known], aff, NOW);
    expect(ranked[0].trackId).toBe("known");
    expect(ranked[0].reason).toContain("Known");
  });
});

describe("blendYouMightLike", () => {
  it("weights radio over label over co-listen, dedupes, and keeps a reason", () => {
    const out = blendYouMightLike({
      radio: [{ trackId: "r1", seedTitle: "Instant Crush" }],
      coListen: [{ trackId: "c1", count: 10 }],
      labelMatch: [{ trackId: "l1", label: "lofi" }],
      exclude: new Set(),
    });
    expect(out[0].trackId).toBe("r1");
    expect(out[0].reason).toBe("Because you played Instant Crush");
    expect(out.map((r) => r.trackId)).toEqual(["r1", "l1", "c1"]);
  });

  it("excludes the library / recent set", () => {
    const out = blendYouMightLike({
      radio: [{ trackId: "r1", seedTitle: "x" }],
      coListen: [],
      labelMatch: [],
      exclude: new Set(["r1"]),
    });
    expect(out).toHaveLength(0);
  });

  it("sums signals for a track that appears in more than one source", () => {
    const out = blendYouMightLike({
      radio: [{ trackId: "both", seedTitle: "x" }],
      coListen: [{ trackId: "both", count: 1 }],
      labelMatch: [],
      exclude: new Set(),
    });
    expect(out[0].score).toBeCloseTo(0.55); // 0.45 + 0.10
  });

  it("returns at most 15 tracks by default", () => {
    const out = blendYouMightLike({
      radio: Array.from({ length: 25 }, (_, index) => ({
        trackId: `r${index}`,
        seedTitle: "seed",
      })),
      coListen: [],
      labelMatch: [],
      exclude: new Set(),
    });
    expect(out).toHaveLength(15);
  });
});
