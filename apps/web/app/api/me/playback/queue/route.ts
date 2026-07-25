import { Timestamp } from "firebase-admin/firestore";
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

    tx.set(r, { ...state, ...next }, { merge: true });
  });

  return Response.json((await r.get()).data());
}
