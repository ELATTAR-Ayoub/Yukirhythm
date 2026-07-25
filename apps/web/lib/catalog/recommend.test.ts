import { describe, it, expect } from "vitest";
import {
  pickJumpBackIn,
  artistAffinityFrom,
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
  it("weights radio over co-listen over label, dedupes, and keeps a reason", () => {
    const out = blendYouMightLike({
      radio: [{ trackId: "r1", seedTitle: "Instant Crush" }],
      coListen: [{ trackId: "c1", count: 10 }],
      labelMatch: [{ trackId: "l1", label: "lofi" }],
      exclude: new Set(),
    });
    expect(out[0].trackId).toBe("r1"); // radio weight 0.5 is highest
    expect(out[0].reason).toBe("Because you played Instant Crush");
    expect(out.map((r) => r.trackId)).toEqual(["r1", "c1", "l1"]);
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
    expect(out[0].score).toBeCloseTo(0.8); // 0.5 + 0.3
  });
});
