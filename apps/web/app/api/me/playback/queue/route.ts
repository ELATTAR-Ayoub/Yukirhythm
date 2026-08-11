import { Timestamp } from "firebase-admin/firestore";
import { gone } from "@/lib/api/disabled";
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { EMPTY_PLAYBACK, type PlaybackState } from "@/lib/catalog/model";

export const runtime = "nodejs";

const ref = (uid: string) =>
  adminDb().collection("users").doc(uid).collection("playback").doc("current");

/**
 * Enqueue a track. `mode: "next"` pushes onto manualQueue, played before the
 * main queue; `mode: "end"` appends to the main queue. Runs in a transaction so
 * concurrent enqueues from two devices do not clobber each other.
 */
export async function POST(req: Request): Promise<Response> {
  if (process.env.ENABLE_LEGACY_PLAYBACK_SYNC !== "true") return gone("Playback queue sync");
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as {
    trackId?: unknown;
    mode?: unknown;
  };
  const trackId = typeof body.trackId === "string" ? body.trackId : "";
  if (!trackId)
    return Response.json({ error: "trackId required" }, { status: 400 });
  const mode = body.mode === "next" ? "next" : "end";

  const r = ref(uid);
  const db = adminDb();
  let result: PlaybackState = { ...EMPTY_PLAYBACK, updatedAt: Timestamp.now() };
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(r);
    const state = (
      snap.exists
        ? snap.data()
        : { ...EMPTY_PLAYBACK, updatedAt: Timestamp.now() }
    ) as PlaybackState;

    const next: Partial<PlaybackState> = { updatedAt: Timestamp.now() };
    if (mode === "next")
      next.manualQueue = [...(state.manualQueue ?? []), trackId];
    else next.queue = [...(state.queue ?? []), trackId];

    result = { ...state, ...next } as PlaybackState;
    tx.set(r, result, { merge: true });
  });

  return Response.json(result);
}

/**
 * Clear the ad-hoc playback queue and stop its current track. This is
 * intentionally a playback mutation, not a collection mutation: no playlist
 * document is read or changed.
 */
export async function DELETE(req: Request): Promise<Response> {
  if (process.env.ENABLE_LEGACY_PLAYBACK_SYNC !== "true") return gone("Playback queue sync");
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const r = ref(uid);
  const db = adminDb();
  let result: PlaybackState = { ...EMPTY_PLAYBACK, updatedAt: Timestamp.now() };
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(r);
    const state = (
      snap.exists
        ? snap.data()
        : { ...EMPTY_PLAYBACK, updatedAt: Timestamp.now() }
    ) as PlaybackState;

    result = {
      ...state,
      trackId: null,
      sourceType: "library",
      sourceId: null,
      queue: [],
      queueIndex: -1,
      manualQueue: [],
      positionSec: 0,
      isPlaying: false,
      shuffleMode: false,
      updatedAt: Timestamp.now(),
    };
    tx.set(r, result);
  });

  return Response.json(result);
}
