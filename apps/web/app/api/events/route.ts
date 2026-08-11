import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { gone } from "@/lib/api/disabled";
import { adminDb } from "@/lib/firebase/admin";
import { invalidateFeedContext } from "../feed/_context";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import {
  classifyListen,
  type EventSource,
  type Track,
  type User,
} from "@/lib/catalog/model";

export const runtime = "nodejs";

const SOURCES: EventSource[] = [
  "collection",
  "search",
  "library",
  "radio",
  "recommendation",
];

type RawEvent = {
  eventId?: unknown;
  trackId?: unknown;
  collectionId?: unknown;
  listenedSec?: unknown;
  startedAt?: unknown;
  source?: unknown;
  recommendationId?: unknown;
  deviceId?: unknown;
  clientHourOfDay?: unknown;
};

/**
 * Batched play events. Accepts `{ events: [...] }`. Each event is scored
 * against the completion threshold, written to the append-only `playEvents`
 * store, and rolled into the user's per-track overlay counters.
 *
 * Gated on consent: with `privacy.saveHistory === false` the request succeeds
 * but nothing is written — the toggle suppresses the write, it is not
 * written-then-hidden.
 */
export async function POST(req: Request): Promise<Response> {
  if (process.env.ENABLE_LEGACY_LISTENING_SYNC !== "true") return gone("Listening history sync");
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const db = adminDb();
  const user = (await db.collection("users").doc(uid).get()).data() as
    User | undefined;
  if (user?.privacy?.saveHistory === false) {
    return Response.json({ ok: true, written: 0, skipped: "saveHistory off" });
  }

  const body = (await req.json().catch(() => ({}))) as { events?: unknown };
  const raw = Array.isArray(body.events) ? (body.events as RawEvent[]) : [];

  let written = 0;
  for (const e of raw) {
    const trackId = typeof e.trackId === "string" ? e.trackId : "";
    const listenedSec =
      typeof e.listenedSec === "number" && e.listenedSec >= 0
        ? Math.floor(e.listenedSec)
        : -1;
    if (!trackId || listenedSec < 0) continue; // skip malformed, don't fail the batch

    const trackSnap = await db.collection("tracks").doc(trackId).get();
    const durationSec = trackSnap.exists
      ? ((trackSnap.data() as Track).durationSec ?? null)
      : null;
    const engagement = classifyListen(listenedSec, durationSec);
    const completed =
      engagement === "completed" || engagement === "near-complete";
    const skipped = engagement === "quick-skip";

    const source = SOURCES.includes(e.source as EventSource)
      ? (e.source as EventSource)
      : "library";
    const hour =
      typeof e.clientHourOfDay === "number"
        ? Math.min(23, Math.max(0, Math.floor(e.clientHourOfDay)))
        : 0;
    const startedAt =
      typeof e.startedAt === "number"
        ? Timestamp.fromMillis(e.startedAt)
        : Timestamp.now();

    const suppliedEventId =
      typeof e.eventId === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(e.eventId)
        ? e.eventId
        : null;
    const eventRef = suppliedEventId
      ? db.collection("playEvents").doc(suppliedEventId)
      : db.collection("playEvents").doc();
    const stateRef = db
      .collection("users")
      .doc(uid)
      .collection("trackState")
      .doc(trackId);

    const didWrite = await db.runTransaction(async (tx) => {
      // reads before writes
      const [eventSnap, stateSnap] = await Promise.all([
        tx.get(eventRef),
        tx.get(stateRef),
      ]);
      if (eventSnap.exists) return false;

      tx.set(eventRef, {
        eventId: eventRef.id,
        userId: uid,
        trackId,
        collectionId:
          typeof e.collectionId === "string" ? e.collectionId : null,
        startedAt,
        listenedSec,
        engagement,
        completed,
        skipped,
        source,
        recommendationId:
          typeof e.recommendationId === "string" ? e.recommendationId : null,
        deviceId: typeof e.deviceId === "string" ? e.deviceId : "",
        clientHourOfDay: hour,
      });

      const counters: Record<string, unknown> = {
        trackId,
        playCount: FieldValue.increment(1),
        totalListenedSec: FieldValue.increment(listenedSec),
        lastPlayedAt: Timestamp.now(),
        completedCount: FieldValue.increment(completed ? 1 : 0),
        skipCount: FieldValue.increment(skipped ? 1 : 0),
      };
      if (!stateSnap.exists) counters.addedAt = Timestamp.now();
      tx.set(stateRef, counters, { merge: true });
      return true;
    });

    if (didWrite) written++;
  }

  // Global tracks.stats.playCount is a per-doc hotspot (spec §14) — deferred to
  // a sharded counter / scheduled aggregation rather than incremented inline.
  if (written > 0) invalidateFeedContext(uid);
  return Response.json({ ok: true, written });
}
