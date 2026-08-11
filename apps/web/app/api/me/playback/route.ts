import { Timestamp } from "firebase-admin/firestore";
import { gone } from "@/lib/api/disabled";
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import {
  EMPTY_PLAYBACK,
  REPEAT_MODES,
  type PlaybackState,
} from "@/lib/catalog/model";

export const runtime = "nodejs";

const ref = (uid: string) =>
  adminDb().collection("users").doc(uid).collection("playback").doc("current");

const asStringArray = (v: unknown): string[] | undefined =>
  Array.isArray(v) && v.every((x) => typeof x === "string")
    ? (v as string[])
    : undefined;

export async function GET(req: Request): Promise<Response> {
  if (process.env.ENABLE_LEGACY_PLAYBACK_SYNC !== "true") return gone("Playback sync");
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const snap = await ref(uid).get();
  if (snap.exists) return Response.json({ ...EMPTY_PLAYBACK, ...snap.data() });
  // Never 404 — a user who has never played anything gets a fresh empty state.
  return Response.json({ ...EMPTY_PLAYBACK, updatedAt: Timestamp.now() });
}

/**
 * Throttled partial write of playback state. Every field is validated and
 * clamped — a client cannot store a volume of 1.5, a negative position, or a
 * bogus repeat mode. Unknown fields are ignored. The caller flushes this every
 * ~10s and on pause/stop/unload, not every tick.
 */
export async function PUT(req: Request): Promise<Response> {
  if (process.env.ENABLE_LEGACY_PLAYBACK_SYNC !== "true") return gone("Playback sync");
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Partial<PlaybackState> = { updatedAt: Timestamp.now() };

  if (body.trackId === null || typeof body.trackId === "string")
    patch.trackId = body.trackId as string | null;
  if (
    body.sourceType === "collection" ||
    body.sourceType === "library" ||
    body.sourceType === "search" ||
    body.sourceType === "radio"
  )
    patch.sourceType = body.sourceType;
  if (body.sourceId === null || typeof body.sourceId === "string")
    patch.sourceId = body.sourceId as string | null;

  const queue = asStringArray(body.queue);
  if (queue) patch.queue = queue;
  const manualQueue = asStringArray(body.manualQueue);
  if (manualQueue) patch.manualQueue = manualQueue;

  if (typeof body.queueIndex === "number" && Number.isFinite(body.queueIndex))
    patch.queueIndex = Math.max(-1, Math.floor(body.queueIndex));
  if (typeof body.positionSec === "number" && body.positionSec >= 0)
    patch.positionSec = Math.floor(body.positionSec);
  if (typeof body.isPlaying === "boolean") patch.isPlaying = body.isPlaying;
  if (typeof body.shuffleMode === "boolean")
    patch.shuffleMode = body.shuffleMode;
  if (REPEAT_MODES.includes(body.repeatMode as PlaybackState["repeatMode"]))
    patch.repeatMode = body.repeatMode as PlaybackState["repeatMode"];
  if (typeof body.volume === "number")
    patch.volume = Math.min(1, Math.max(0, body.volume));
  if (typeof body.deviceId === "string") patch.deviceId = body.deviceId;

  // Merge creates the document if absent. GET supplies defaults, so a save
  // needs no existence read, seed write, or read-after-write.
  await ref(uid).set(patch, { merge: true });
  return Response.json(patch);
}
