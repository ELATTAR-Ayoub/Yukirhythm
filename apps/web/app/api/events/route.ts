import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { invalidateFeedContext } from "../feed/_context";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import {
  classifyListen,
  type EventSource,
  type TrackLabel,
} from "@/lib/catalog/model";

export const runtime = "nodejs";

const SOURCES: EventSource[] = [
  "collection",
  "search",
  "library",
  "radio",
  "recommendation",
];
const MAX_EVENTS_PER_REQUEST = 20;
const MAX_TASTE_EVENTS = 100;
const MIN_LISTEN_SEC = 5;

type RawEvent = {
  eventId?: unknown;
  trackId?: unknown;
  collectionId?: unknown;
  listenedSec?: unknown;
  durationSec?: unknown;
  startedAt?: unknown;
  source?: unknown;
  recommendationId?: unknown;
  deviceId?: unknown;
  clientHourOfDay?: unknown;
  artists?: unknown;
  labels?: unknown;
};

function cleanArtists(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).flatMap((artist) => {
    if (!artist || typeof artist !== "object") return [];
    const item = artist as Record<string, unknown>;
    return typeof item.artistId === "string" && typeof item.name === "string"
      ? [
          {
            artistId: item.artistId.slice(0, 200),
            name: item.name.slice(0, 300),
          },
        ]
      : [];
  });
}

function cleanLabels(value: unknown): TrackLabel[] {
  if (!Array.isArray(value)) return [];
  const kinds = new Set(["genre", "mood"]);
  const sources = new Set([
    "youtube-category",
    "youtube-keywords",
    "provider-topic",
    "inferred",
    "user",
  ]);
  return value.slice(0, 20).flatMap((label) => {
    if (!label || typeof label !== "object") return [];
    const item = label as Record<string, unknown>;
    if (
      typeof item.label !== "string" ||
      !kinds.has(String(item.kind)) ||
      !sources.has(String(item.source)) ||
      typeof item.confidence !== "number"
    )
      return [];
    return [
      {
        label: item.label.slice(0, 120),
        kind: item.kind as TrackLabel["kind"],
        source: item.source as TrackLabel["source"],
        confidence: Math.min(1, Math.max(0, item.confidence)),
      },
    ];
  });
}

function normalize(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as RawEvent;
  const eventId =
    typeof raw.eventId === "string" &&
    /^[A-Za-z0-9_-]{8,128}$/.test(raw.eventId)
      ? raw.eventId
      : null;
  const trackId =
    typeof raw.trackId === "string" && !raw.trackId.includes("/")
      ? raw.trackId.slice(0, 300)
      : "";
  const listenedSec =
    typeof raw.listenedSec === "number" && Number.isFinite(raw.listenedSec)
      ? Math.min(86400, Math.floor(raw.listenedSec))
      : -1;
  const durationSec =
    typeof raw.durationSec === "number" && Number.isFinite(raw.durationSec)
      ? Math.max(0, Math.floor(raw.durationSec))
      : null;
  if (!eventId || !trackId || listenedSec < MIN_LISTEN_SEC) return null;
  const source = SOURCES.includes(raw.source as EventSource)
    ? (raw.source as EventSource)
    : "library";
  const engagement = classifyListen(listenedSec, durationSec);
  return {
    eventId,
    trackId,
    collectionId:
      typeof raw.collectionId === "string"
        ? raw.collectionId.slice(0, 300)
        : null,
    listenedSec,
    durationSec,
    startedAt:
      typeof raw.startedAt === "number" &&
      Number.isFinite(raw.startedAt) &&
      raw.startedAt >= 0 &&
      raw.startedAt <= Date.now() + 300000
        ? Timestamp.fromMillis(raw.startedAt)
        : Timestamp.now(),
    engagement,
    completed: engagement === "completed" || engagement === "near-complete",
    skipped: engagement === "quick-skip",
    source,
    recommendationId:
      typeof raw.recommendationId === "string"
        ? raw.recommendationId.slice(0, 300)
        : null,
    deviceId:
      typeof raw.deviceId === "string" ? raw.deviceId.slice(0, 200) : "",
    clientHourOfDay:
      typeof raw.clientHourOfDay === "number" &&
      Number.isFinite(raw.clientHourOfDay)
        ? Math.min(23, Math.max(0, Math.floor(raw.clientHourOfDay)))
        : 0,
    artists: cleanArtists(raw.artists),
    labels: cleanLabels(raw.labels),
  };
}

/** A bounded, retry-safe transition. Consent and duplicate detection are
 * checked transactionally; browser state is never an authorization boundary. */
export async function POST(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const body = ((await req.json().catch(() => null)) ?? {}) as {
    events?: unknown;
    tasteSnapshot?: unknown;
  };
  const events = (Array.isArray(body.events) ? body.events : [])
    .slice(0, MAX_EVENTS_PER_REQUEST)
    .map(normalize)
    .filter((event): event is NonNullable<typeof event> => event !== null);
  if (!events.length) return Response.json({ ok: true, written: 0 });

  const db = adminDb();
  const userRef = db.collection("users").doc(uid);
  const tasteRef = userRef.collection("views").doc("taste");
  const unique = [...new Map(events.map((e) => [e.eventId, e])).values()];
  const refs = unique.map((e) =>
    db.collection("playEvents").doc(`${uid}_${e.eventId}`)
  );
  const result = await db.runTransaction(async (tx) => {
    const [profile, taste, ...existing] = await tx.getAll(
      userRef,
      tasteRef,
      ...refs
    );
    if (profile.data()?.privacy?.saveHistory !== true) {
      return { ok: true, written: 0, skipped: "saveHistory off" };
    }
    const cutoff = profile.data()?.historyClearedAtMs ?? 0;
    const fresh = unique.filter(
      (event, i) => !existing[i].exists && event.startedAt.toMillis() > cutoff
    );
    if (!fresh.length) return { ok: true, written: 0 };
    // Legacy clients may lack metadata. Resolve only those records, in one read.
    const missing = fresh.filter(
      (e) => e.durationSec === null || !e.artists.length
    );
    const metadata = missing.length
      ? await tx.getAll(
          ...missing.map((e) => db.collection("tracks").doc(e.trackId))
        )
      : [];
    const stateIds = [...new Set(fresh.map((event) => event.trackId))];
    const states = await tx.getAll(
      ...stateIds.map((id) => userRef.collection("trackState").doc(id))
    );
    const lastPlayed = new Map(
      states.map((state) => [
        state.id,
        state.data()?.lastPlayedAt as Timestamp | undefined,
      ])
    );
    const byId = new Map(
      metadata.filter((d) => d.exists).map((d) => [d.id, d.data()!])
    );
    const nextEvents = fresh.map((event) => {
      const track = byId.get(event.trackId);
      const durationSec = event.durationSec ?? track?.durationSec ?? null;
      const engagement = classifyListen(event.listenedSec, durationSec);
      return {
        ...event,
        durationSec,
        engagement,
        completed: engagement === "completed" || engagement === "near-complete",
        skipped: engagement === "quick-skip",
        artists: event.artists.length ? event.artists : (track?.artists ?? []),
        labels: event.labels.length ? event.labels : (track?.labels ?? []),
        labelIds: track?.labelIds ?? event.labels.map((l) => l.label),
      };
    });
    for (const event of nextEvents) {
      const previousPlayed = lastPlayed.get(event.trackId);
      const lastPlayedAt =
        previousPlayed && previousPlayed.toMillis() > event.startedAt.toMillis()
          ? previousPlayed
          : event.startedAt;
      lastPlayed.set(event.trackId, lastPlayedAt);
      tx.create(db.collection("playEvents").doc(`${uid}_${event.eventId}`), {
        ...event,
        userId: uid,
        syncedAt: Timestamp.now(),
      });
      tx.set(
        userRef.collection("trackState").doc(event.trackId),
        {
          trackId: event.trackId,
          playCount: FieldValue.increment(1),
          completedCount: FieldValue.increment(event.completed ? 1 : 0),
          skipCount: FieldValue.increment(event.skipped ? 1 : 0),
          totalListenedSec: FieldValue.increment(event.listenedSec),
          lastPlayedAt,
        },
        { merge: true }
      );
    }
    const previous = (taste.data()?.events ?? []) as Array<
      Record<string, unknown> & { eventId: string; startedAt: number }
    >;
    const merged = new Map(previous.map((event) => [event.eventId, event]));
    for (const event of nextEvents)
      merged.set(event.eventId, {
        ...event,
        startedAt: event.startedAt.toMillis(),
      });
    const snapshot = [...merged.values()]
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, MAX_TASTE_EVENTS);
    while (
      snapshot.length &&
      Buffer.byteLength(JSON.stringify(snapshot), "utf8") > 700000
    )
      snapshot.pop();
    tx.set(tasteRef, {
      events: snapshot,
      eventCount: snapshot.length,
      updatedAt: Timestamp.now(),
      schemaVersion: 2,
    });
    return { ok: true, written: nextEvents.length };
  });
  invalidateFeedContext(uid);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
