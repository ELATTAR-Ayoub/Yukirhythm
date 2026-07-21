import type { PlayEvent, StatsRollup, Track } from "./model";

/**
 * Pure stats aggregation over a play-event set. No Firestore, no clock — the
 * caller passes `nowMs` and the timezone, so this is fully deterministic and
 * unit-tested independently of the route.
 *
 * An "event" here is the stored shape but with `startedAt` already reduced to
 * epoch millis, so this module never touches a Firestore Timestamp.
 */
export type StatEvent = Omit<PlayEvent, "startedAt"> & { startedAtMs: number };

const DAY = 24 * 60 * 60 * 1000;

/** Local calendar date "YYYY-MM-DD" for an instant, in the given IANA zone. */
export function localDate(ms: number, tz: string): string {
  // en-CA renders as YYYY-MM-DD, which sorts and compares as a plain string.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function minutesWithin(events: StatEvent[], nowMs: number, windowMs: number): number {
  const cutoff = nowMs - windowMs;
  let sec = 0;
  for (const e of events) if (e.startedAtMs >= cutoff) sec += e.listenedSec;
  return Math.floor(sec / 60);
}

/**
 * Consecutive days ending today (or yesterday) with ≥1 completed play. A day
 * with no play yet does not break a streak that already includes yesterday.
 */
export function computeStreak(
  completedDates: Set<string>,
  nowMs: number,
  tz: string
): { streakDays: number; lastListenDate: string | null } {
  if (completedDates.size === 0) return { streakDays: 0, lastListenDate: null };

  const today = localDate(nowMs, tz);
  const yesterday = localDate(nowMs - DAY, tz);
  // Anchor on today if played today, else yesterday; if neither, streak is 0.
  let anchorMs: number;
  if (completedDates.has(today)) anchorMs = nowMs;
  else if (completedDates.has(yesterday)) anchorMs = nowMs - DAY;
  else return { streakDays: 0, lastListenDate: mostRecent(completedDates) };

  let streak = 0;
  for (let d = anchorMs; ; d -= DAY) {
    if (completedDates.has(localDate(d, tz))) streak++;
    else break;
  }
  return { streakDays: streak, lastListenDate: mostRecent(completedDates) };
}

function mostRecent(dates: Set<string>): string {
  return [...dates].sort().at(-1)!;
}

export function computeStats(
  events: StatEvent[],
  tracksById: Map<string, Track>,
  nowMs: number,
  tz: string
): StatsRollup {
  const completed = events.filter((e) => e.completed);

  // streak
  const completedDates = new Set(completed.map((e) => localDate(e.startedAtMs, tz)));
  const { streakDays, lastListenDate } = computeStreak(completedDates, nowMs, tz);

  // top artists + top tracks (by completed play count)
  const artistPlays = new Map<string, { name: string; plays: number }>();
  const trackPlays = new Map<string, number>();
  const genreSec = new Map<string, number>();
  const byHour = new Array(24).fill(0);

  for (const e of completed) {
    trackPlays.set(e.trackId, (trackPlays.get(e.trackId) ?? 0) + 1);
    const h = Math.min(23, Math.max(0, e.clientHourOfDay | 0));
    byHour[h] += 1;

    const track = tracksById.get(e.trackId);
    if (track) {
      for (const a of track.artists) {
        const cur = artistPlays.get(a.artistId) ?? { name: a.name, plays: 0 };
        cur.plays += 1;
        artistPlays.set(a.artistId, cur);
      }
      for (const label of track.labelIds ?? []) {
        genreSec.set(label, (genreSec.get(label) ?? 0) + e.listenedSec);
      }
    }
  }

  const topArtists = [...artistPlays.entries()]
    .map(([artistId, v]) => ({ artistId, name: v.name, plays: v.plays }))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 10);

  const topTrackIds = [...trackPlays.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);

  // genre split: labelled listening only, normalised to 100
  const labelledTotal = [...genreSec.values()].reduce((a, b) => a + b, 0);
  const genreSplit =
    labelledTotal > 0
      ? [...genreSec.entries()]
          .map(([label, sec]) => ({
            label,
            pct: Math.round((sec / labelledTotal) * 100),
          }))
          .sort((a, b) => b.pct - a.pct)
      : [];

  // byHour normalised so the peak hour is 1.0
  const peak = Math.max(...byHour, 0);
  const byHourNorm = peak > 0 ? byHour.map((n) => n / peak) : byHour;

  return {
    minutesWeek: minutesWithin(events, nowMs, 7 * DAY),
    minutesMonth: minutesWithin(events, nowMs, 30 * DAY),
    minutesYear: minutesWithin(events, nowMs, 365 * DAY),
    minutesAllTime: Math.floor(
      events.reduce((s, e) => s + e.listenedSec, 0) / 60
    ),
    streakDays,
    lastListenDate,
    topArtists,
    topTrackIds,
    genreSplit,
    byHour: byHourNorm,
    timezone: tz,
  };
}
