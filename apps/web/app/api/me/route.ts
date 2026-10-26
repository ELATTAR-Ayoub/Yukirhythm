import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { invalidateFeedContext } from "../feed/_context";
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import {
  DEFAULT_PRIVACY,
  DEFAULT_SETTINGS,
  type User,
} from "@/lib/catalog/model";

export const runtime = "nodejs";

const userRef = (uid: string) => adminDb().collection("users").doc(uid);

export async function GET(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();
  const snap = await userRef(uid).get();
  if (!snap.exists)
    return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(snap.data());
}

/** Ensure-user. The uid always comes from the verified token, never the body. */
export async function POST(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const snap = await userRef(uid).get();
  if (snap.exists) return Response.json(snap.data());

  const body = ((await req.json().catch(() => null)) ?? {}) as Partial<User>;
  const authProvider = body.authProvider === "facebook" ? "facebook" : "google";
  const user: User = {
    userId: uid,
    displayName: typeof body.displayName === "string" ? body.displayName : "",
    handle: null,
    email: typeof body.email === "string" ? body.email : "",
    avatarUrl: typeof body.avatarUrl === "string" ? body.avatarUrl : null,
    bio: null,
    authProvider,
    counts: { followerCount: 0, followingCount: 0, collectionCount: 0 },
    privacy: { ...DEFAULT_PRIVACY },
    settings: { ...DEFAULT_SETTINGS },
    createdAt: Timestamp.now(),
  };
  const created = await adminDb().runTransaction(async (tx) => {
    const current = await tx.get(userRef(uid));
    if (current.exists) return { user: current.data(), status: 200 };
    tx.create(userRef(uid), user);
    return { user, status: 201 };
  });
  return Response.json(created.user, { status: created.status });
}

/**
 * Partial update of privacy, settings, and mutable profile fields only.
 * Identity fields — userId, email, authProvider, counts, createdAt — are
 * immutable and any attempt to set them through the body is ignored.
 */
export async function PATCH(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const ref = userRef(uid);
  const snap = await ref.get();
  if (!snap.exists)
    return Response.json({ error: "Not found" }, { status: 404 });

  const body = ((await req.json().catch(() => null)) ?? {}) as Record<
    string,
    unknown
  >;
  const patch: Record<string, unknown> = {};

  if (body.privacy && typeof body.privacy === "object") {
    const p = body.privacy as Record<string, unknown>;
    const privacy: Record<string, boolean> = {};
    for (const k of ["saveHistory", "personalization", "publicProfile"]) {
      if (typeof p[k] === "boolean") privacy[k] = p[k] as boolean;
    }
    if (Object.keys(privacy).length) patch.privacy = privacy;
  }

  if (body.settings && typeof body.settings === "object") {
    const s = body.settings as Record<string, unknown>;
    const settings: Record<string, string> = {};
    for (const k of ["audioQuality", "language", "theme"]) {
      if (typeof s[k] === "string") settings[k] = s[k] as string;
    }
    if (Object.keys(settings).length) patch.settings = settings;
  }

  if (typeof body.displayName === "string")
    patch.displayName = body.displayName;
  if (typeof body.bio === "string") patch.bio = body.bio;
  if (typeof body.handle === "string") patch.handle = body.handle;

  // merge:true so a nested privacy/settings patch does not clobber siblings.
  const batch = adminDb().batch();
  if (patch.privacy) {
    patch.feedRevision = FieldValue.increment(1);
    batch.delete(ref.collection("feeds").doc("new-releases"));
    batch.delete(ref.collection("feeds").doc("you-might-like"));
  }
  batch.set(ref, patch, { merge: true });
  await batch.commit();
  invalidateFeedContext(uid);
  return Response.json((await ref.get()).data());
}
