import type { Track } from "./model";
import type { StatEvent } from "./stats";

/**
 * Pure recommendation scoring. No Firestore, no provider, no clock — the routes
 * assemble candidates and pass them in, so the ranking is deterministic and
 * unit-tested. `nowMs` is injected for the same reason.
 */

const DAY = 24 * 60 * 60 * 1000;

/** A scored candidate carrying why it was picked, for the feed's UI + the loop. */
export type Recommendation = {
  trackId: string;
  score: number;
  reason: string;
  recommendationId: string;
};

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
    for (const a of t.artists) plays.set(a.artistId, (plays.get(a.artistId) ?? 0) + 1);
  }
  const peak = Math.max(0, ...plays.values());
  const out = new Map<string, number>();
  if (peak > 0) for (const [id, n] of plays) out.set(id, n / peak);
  return out;
}

/**
 * New-releases score: 0.5·artistAffinity + 0.3·recency + 0.2·popularity.
 * Recency decays linearly over 90 days; a track with no publish date scores 0
 * on that term rather than being dropped.
 */
export function scoreNewReleases(
  candidates: Track[],
  artistAffinity: Map<string, number>,
  nowMs: number
): Recommendation[] {
  const maxViews = Math.max(1, ...candidates.map((t) => t.stats?.viewCount ?? 0));
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
      const popularity = Math.log1p(t.stats?.viewCount ?? 0) / Math.log1p(maxViews);

      const score = 0.5 * affinity + 0.3 * recency + 0.2 * popularity;
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
  radio: { trackId: string; seedTitle: string }[];
  /** Tracks co-occurring with liked tracks in others' public collections. */
  coListen: { trackId: string; count: number }[];
  /** Tracks matching the user's top labels. */
  labelMatch: { trackId: string; label: string }[];
  /** trackIds to drop (library + recently played). */
  exclude: Set<string>;
};

/**
 * "You might like": blend provider radio (0.5), cross-user co-listening (0.3),
 * and label affinity (0.2). Deduped, excludes the user's own/recent tracks,
 * each item carries the reason it surfaced.
 */
export function blendYouMightLike(input: BlendInput, cap = 20): Recommendation[] {
  const scores = new Map<string, { score: number; reason: string }>();
  const bump = (trackId: string, add: number, reason: string) => {
    if (input.exclude.has(trackId)) return;
    const cur = scores.get(trackId);
    if (cur) cur.score += add;
    else scores.set(trackId, { score: add, reason });
  };

  for (const r of input.radio) bump(r.trackId, 0.5, `Because you played ${r.seedTitle}`);
  const maxCo = Math.max(1, ...input.coListen.map((c) => c.count));
  for (const c of input.coListen)
    bump(c.trackId, 0.3 * (c.count / maxCo), "Listeners like you also played this");
  for (const l of input.labelMatch) bump(l.trackId, 0.2, `More ${l.label}`);

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
