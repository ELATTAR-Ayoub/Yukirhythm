import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { invalidateFeedContext } from "../feed/_context";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { classifyListen, type EventSource, type TrackLabel } from "@/lib/catalog/model";

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
      ? [{ artistId: item.artistId.slice(0, 200), name: item.name.slice(0, 300) }]
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
    ) return [];
    return [{
      label: item.label.slice(0, 120),
      kind: item.kind as TrackLabel["kind"],
      source: item.source as TrackLabel["source"],
      confidence: Math.min(1, Math.max(0, item.confidence)),
    }];
  });
}

function normalize(raw: RawEvent) {
  const eventId =
    typeof raw.eventId === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(raw.eventId)
      ? raw.eventId
      : null;
  const trackId = typeof raw.trackId === "string" ? raw.trackId.slice(0, 300) : "";
  const listenedSec =
    typeof raw.listenedSec === "number" && Number.isFinite(raw.listenedSec)
      ? Math.floor(raw.listenedSec)
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
    collectionId: typeof raw.collectionId === "string" ? raw.collectionId.slice(0, 300) : null,
    listenedSec,
    durationSec,
    startedAt: typeof raw.startedAt === "number" && Number.isFinite(raw.startedAt)
      ? Timestamp.fromMillis(raw.startedAt)
      : Timestamp.now(),
    engagement,
    completed: engagement === "completed" || engagement === "near-complete",
    skipped: engagement === "quick-skip",
    source,
    recommendationId: typeof raw.recommendationId === "string"
      ? raw.recommendationId.slice(0, 300)
      : null,
    deviceId: typeof raw.deviceId === "string" ? raw.deviceId.slice(0, 200) : "",
    clientHourOfDay: typeof raw.clientHourOfDay === "number"
      ? Math.min(23, Math.max(0, Math.floor(raw.clientHourOfDay)))
      : 0,
    artists: cleanArtists(raw.artists),
    labels: cleanLabels(raw.labels),
  };
}

/** One transition request, zero Firestore reads. The browser already loaded
 * privacy once with `/api/me`; privacy-off sessions never call this endpoint.
 * A deterministic play-event write is retry-safe, and the compact taste view
 * replaces itself rather than growing an unbounded history document. */
export async function POST(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as {
    events?: unknown;
    tasteSnapshot?: unknown;
  };
  const events = (Array.isArray(body.events) ? body.events : [])
    .slice(0, MAX_EVENTS_PER_REQUEST)
    .map((event) => normalize(event as RawEvent))
    .filter((event): event is NonNullable<typeof event> => event !== null);
  if (!events.length) return Response.json({ ok: true, written: 0 });

  const tasteSnapshot = (Array.isArray(body.tasteSnapshot) ? body.tasteSnapshot : [])
    .slice(0, MAX_TASTE_EVENTS)
    .map((event) => normalize(event as RawEvent))
    .filter((event): event is NonNullable<typeof event> => event !== null)
    .map((event) => ({ ...event, startedAt: event.startedAt.toMillis() }));

  const db = adminDb();
  const batch = db.batch();
  for (const event of events) {
    batch.set(db.collection("playEvents").doc(event.eventId), {
      ...event,
      userId: uid,
      syncedAt: Timestamp.now(),
    });
  }
  batch.set(db.collection("users").doc(uid).collection("views").doc("taste"), {
    events: tasteSnapshot,
    eventCount: tasteSnapshot.length,
    updatedAt: Timestamp.now(),
    schemaVersion: 1,
  });
  await batch.commit();
  invalidateFeedContext(uid);
  return Response.json({ ok: true, written: events.length });
}
