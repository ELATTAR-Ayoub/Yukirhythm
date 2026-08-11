import { classifyListen, type Track } from "./model";
import type { StatEvent } from "./stats";

/**
 * Pure recommendation scoring. No Firestore, no provider, no clock — the routes
 * assemble candidates and pass them in, so the ranking is deterministic and
 * unit-tested. `nowMs` is injected for the same reason.
 */

const DAY = 24 * 60 * 60 * 1000;
const TASTE_WINDOW_DAYS = 60;
const TASTE_HALF_LIFE_DAYS = 14;

export type TasteProfile = {
  trackAffinity: Map<string, number>;
  artistAffinity: Map<string, number>;
  labelAffinity: Map<string, number>;
  seedTrackIds: string[];
};

function normalise(scores: Map<string, number>): Map<string, number> {
  const peak = Math.max(0, ...scores.values());
  if (peak <= 0) return new Map();
  return new Map(
    [...scores.entries()]
      .filter(([, score]) => score > 0)
      .map(([id, score]) => [id, score / peak])
  );
}

/** A recent, engagement-weighted taste profile built from actual listening. */
export function buildRecentTasteProfile(
  events: StatEvent[],
  tracksById: Map<string, Track>,
  nowMs: number,
  likedTrackIds: Set<string> = new Set()
): TasteProfile {
  const trackScores = new Map<string, number>();
  const cutoff = nowMs - TASTE_WINDOW_DAYS * DAY;

  for (const event of events) {
    if (event.startedAtMs < cutoff) continue;
    const ageDays = Math.max(0, (nowMs - event.startedAtMs) / DAY);
    const recency = Math.pow(0.5, ageDays / TASTE_HALF_LIFE_DAYS);
    const engagementType =
      event.engagement ??
      classifyListen(
        event.listenedSec,
        tracksById.get(event.trackId)?.durationSec ?? null
      );
    const engagement =
      engagementType === "near-complete"
        ? 1.2
        : engagementType === "completed"
          ? 1
          : engagementType === "sampled"
            ? 0.45
            : -0.35;
    const likedBoost = likedTrackIds.has(event.trackId) ? 0.6 : 0;
    trackScores.set(
      event.trackId,
      (trackScores.get(event.trackId) ?? 0) +
        recency * (engagement + likedBoost)
    );
  }

  // A like remains a useful seed even if it was not played inside the window.
  for (const trackId of likedTrackIds) {
    trackScores.set(trackId, Math.max(trackScores.get(trackId) ?? 0, 0.6));
  }

  const trackAffinity = normalise(trackScores);
  const artistScores = new Map<string, number>();
  const labelScores = new Map<string, number>();
  for (const [trackId, affinity] of trackAffinity) {
    const track = tracksById.get(trackId);
    if (!track) continue;
    for (const artist of track.artists) {
      if (artist.artistId) {
        artistScores.set(
          artist.artistId,
          (artistScores.get(artist.artistId) ?? 0) + affinity
        );
      }
    }
    for (const label of track.labels ?? []) {
      if (label.kind !== "genre") continue;
      const id = label.label.toLowerCase();
      labelScores.set(
        id,
        (labelScores.get(id) ?? 0) + affinity * label.confidence
      );
    }
  }

  const seenArtists = new Set<string>();
  const seedTrackIds: string[] = [];
  for (const [trackId] of [...trackAffinity].sort((a, b) => b[1] - a[1])) {
    const artistId = tracksById.get(trackId)?.artists[0]?.artistId ?? "";
    if (artistId && seenArtists.has(artistId)) continue;
    if (artistId) seenArtists.add(artistId);
    seedTrackIds.push(trackId);
    if (seedTrackIds.length >= 6) break;
  }

  return {
    trackAffinity,
    artistAffinity: normalise(artistScores),
    labelAffinity: normalise(labelScores),
    seedTrackIds,
  };
}

/** A scored candidate carrying why it was picked, for the feed's UI + the loop. */
export type Recommendation = {
  trackId: string;
  score: number;
  reason: string;
  recommendationId: string;
};

/** Prefer artist variety, then backfill so a sufficiently large pool stays full. */
export function diversifyByArtist(
  recommendations: Recommendation[],
  tracksById: Map<string, Track>,
  cap = 15,
  maxPerArtist = 2
): Recommendation[] {
  const selected: Recommendation[] = [];
  const overflow: Recommendation[] = [];
  const counts = new Map<string, number>();
  for (const recommendation of recommendations) {
    const track = tracksById.get(recommendation.trackId);
    if (!track) continue;
    const artistId = track.artists[0]?.artistId ?? track.artists[0]?.name ?? "";
    const count = counts.get(artistId) ?? 0;
    if (artistId && count >= maxPerArtist) {
      overflow.push(recommendation);
      continue;
    }
    selected.push(recommendation);
    if (artistId) counts.set(artistId, count + 1);
    if (selected.length >= cap) return selected;
  }
  return [...selected, ...overflow].slice(0, cap);
}

/**
 * Distinct collections from the last 30 days of events, most-recent play first,
 * capped. This is "Jump back in".
 */
export function pickJumpBackIn(
  events: StatEvent[],
  nowMs: number,
  cap = 12
): string[] {
  const cutoff = nowMs - 30 * DAY;
  const seen = new Set<string>();
  const out: string[] = [];
  // events are assumed newest-first; sort defensively.
  for (const e of [...events].sort((a, b) => b.startedAtMs - a.startedAtMs)) {
    if (e.startedAtMs < cutoff || !e.collectionId) continue;
    if (seen.has(e.collectionId)) continue;
    seen.add(e.collectionId);
    out.push(e.collectionId);
    if (out.length >= cap) break;
  }
  return out;
}

/** Normalised play share per artist over the given events (0..1, peak = 1). */
export function artistAffinityFrom(
  events: StatEvent[],
  tracksById: Map<string, Track>
): Map<string, number> {
  const plays = new Map<string, number>();
  for (const e of events) {
    if (!e.completed) continue;
    const t = tracksById.get(e.trackId);
    if (!t) continue;
    for (const a of t.artists)
      plays.set(a.artistId, (plays.get(a.artistId) ?? 0) + 1);
  }
  const peak = Math.max(0, ...plays.values());
  const out = new Map<string, number>();
  if (peak > 0) for (const [id, n] of plays) out.set(id, n / peak);
  return out;
}

/**
 * New-releases score: 0.6 recency + 0.25 genre affinity + 0.1 artist
 * affinity + 0.05 popularity.
 * Recency decays linearly over 90 days; a track with no publish date scores 0
 * on that term rather than being dropped.
 */
export function scoreNewReleases(
  candidates: Track[],
  artistAffinity: Map<string, number>,
  nowMs: number,
  labelAffinity: Map<string, number> = new Map()
): Recommendation[] {
  const maxViews = Math.max(
    1,
    ...candidates.map((t) => t.stats?.viewCount ?? 0)
  );
  return candidates
    .map((t) => {
      const affinity = Math.max(
        0,
        ...t.artists.map((a) => artistAffinity.get(a.artistId) ?? 0)
      );
      const publishedMs = t.publishedAt
        ? (t.publishedAt as unknown as { toMillis(): number }).toMillis()
        : 0;
      const ageDays = publishedMs ? (nowMs - publishedMs) / DAY : Infinity;
      const recency = ageDays <= 90 ? 1 - ageDays / 90 : 0;
      const popularity =
        Math.log1p(t.stats?.viewCount ?? 0) / Math.log1p(maxViews);
      const genreAffinity = Math.max(
        0,
        ...(t.labels ?? [])
          .filter((label) => label.kind === "genre")
          .map((label) => labelAffinity.get(label.label.toLowerCase()) ?? 0)
      );

      const score =
        0.6 * recency +
        0.25 * genreAffinity +
        0.1 * affinity +
        0.05 * popularity;
      const reason =
        affinity > 0
          ? `New from ${t.artists[0]?.name ?? "an artist you play"}`
          : "Fresh and popular";
      return {
        trackId: t.trackId,
        score,
        reason,
        recommendationId: `nr:${t.trackId}`,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export type BlendInput = {
  /** Provider radio seeded from the user's most-played, with the seed's title. */
  radio: { trackId: string; seedTitle: string; affinity?: number }[];
  /** Tracks co-occurring with liked tracks in others' public collections. */
  coListen: { trackId: string; count: number }[];
  /** Tracks matching the user's top labels. */
  labelMatch: { trackId: string; label: string; affinity?: number }[];
  /** Candidate artist affinity derived from recent listening. */
  artistMatch?: { trackId: string; artist: string; affinity: number }[];
  /** Small provider-quality tie breaker, normalised to 0..1. */
  quality?: { trackId: string; score: number }[];
  /** trackIds to drop (library + recently played). */
  exclude: Set<string>;
};

/**
 * "You might like": blend provider radio similarity, genre and artist taste,
 * cross-user co-listening, and a small quality tie breaker. Deduped, excludes
 * the user's own/recent tracks, and carries the reason it surfaced.
 */
export function blendYouMightLike(
  input: BlendInput,
  cap = 15
): Recommendation[] {
  const scores = new Map<string, { score: number; reason: string }>();
  const bump = (trackId: string, add: number, reason: string) => {
    if (input.exclude.has(trackId)) return;
    const cur = scores.get(trackId);
    if (cur) cur.score += add;
    else scores.set(trackId, { score: add, reason });
  };

  for (const r of input.radio)
    bump(
      r.trackId,
      0.45 * (r.affinity ?? 1),
      `Because you played ${r.seedTitle}`
    );
  const maxCo = Math.max(1, ...input.coListen.map((c) => c.count));
  for (const c of input.coListen)
    bump(
      c.trackId,
      0.1 * (c.count / maxCo),
      "Listeners like you also played this"
    );
  for (const l of input.labelMatch)
    bump(l.trackId, 0.25 * (l.affinity ?? 1), `More ${l.label}`);
  for (const artist of input.artistMatch ?? []) {
    bump(artist.trackId, 0.15 * artist.affinity, `Similar to ${artist.artist}`);
  }
  for (const quality of input.quality ?? []) {
    bump(
      quality.trackId,
      0.05 * quality.score,
      "A strong match for your taste"
    );
  }

  return [...scores.entries()]
    .map(([trackId, v]) => ({
      trackId,
      score: v.score,
      reason: v.reason,
      recommendationId: `yml:${trackId}`,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, cap);
}
