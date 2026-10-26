import { classifyListen, type Track } from "@/lib/catalog/model";
import { computeStats, type StatEvent } from "@/lib/catalog/stats";
import type { MockTrack } from "@/components/studio/screens/mock-data";

export type LocalListen = {
  eventId: string;
  trackId: string;
  collectionId: string | null;
  startedAt: number;
  listenedSec: number;
  durationSec: number;
  source: "collection" | "library" | "search" | "recommendation";
  recommendationId: string | null;
  clientHourOfDay: number;
  artists: NonNullable<MockTrack["artists"]>;
  labels: NonNullable<MockTrack["labels"]>;
  track?: MockTrack;
};
const archiveKey = (uid: string) => `yukirhythm:listens:v2:${uid}`;
export const outboxKey = (uid: string) => `yukirhythm:history:v1:${uid}`;

function read(key: string): LocalListen[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(data)
      ? data.filter(
          (e): e is LocalListen =>
            e &&
            typeof e === "object" &&
            typeof e.eventId === "string" &&
            typeof e.trackId === "string" &&
            Number.isFinite(e.startedAt) &&
            Number.isFinite(e.listenedSec)
        )
      : [];
  } catch {
    return [];
  }
}
function write(key: string, events: LocalListen[]) {
  try {
    if (events.length) localStorage.setItem(key, JSON.stringify(events));
    else localStorage.removeItem(key);
  } catch {
    if (key.includes(":guest-"))
      throw new Error("Couldn't save guest listening history on this device.");
    /* Network persistence remains available with storage disabled. */
  }
}
export function pendingListens(uid: string) {
  return read(outboxKey(uid));
}
export function savedListens(uid: string) {
  const events = [...read(archiveKey(uid)), ...pendingListens(uid)];
  return [...new Map(events.map((e) => [e.eventId, e])).values()]
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 2000);
}
export function storeListen(uid: string, event: LocalListen) {
  write(
    archiveKey(uid),
    [
      event,
      ...savedListens(uid).filter((e) => e.eventId !== event.eventId),
    ].slice(0, 2000)
  );
  write(
    outboxKey(uid),
    [
      event,
      ...pendingListens(uid).filter((e) => e.eventId !== event.eventId),
    ].slice(0, 200)
  );
}
export function acknowledgeListens(uid: string, ids: Set<string>) {
  // Migrate old pending-only history before removing an acknowledged upload.
  write(archiveKey(uid), savedListens(uid));
  write(
    outboxKey(uid),
    pendingListens(uid).filter((e) => !ids.has(e.eventId))
  );
}
export function clearSavedListens(uid: string) {
  write(archiveKey(uid), []);
  write(outboxKey(uid), []);
}
export function localListeningStats(events: LocalListen[], now = Date.now()) {
  const tracks = new Map<string, Track>();
  const statsEvents: StatEvent[] = events.map((e) => {
    const engagement = classifyListen(e.listenedSec, e.durationSec);
    tracks.set(e.trackId, {
      trackId: e.trackId,
      artists: e.artists ?? [],
      labels: e.labels ?? [],
      labelIds: (e.labels ?? [])
        .filter((l) => l.kind === "genre")
        .map((l) => l.label),
    } as Track);
    return {
      ...e,
      userId: "local",
      deviceId: "local",
      startedAtMs: e.startedAt,
      engagement,
      completed: engagement === "completed" || engagement === "near-complete",
      skipped: engagement === "quick-skip",
    };
  });
  return computeStats(
    statsEvents,
    tracks,
    now,
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
}
