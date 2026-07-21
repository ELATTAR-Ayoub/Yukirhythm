import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import type { PublicProfile, User } from "@/lib/catalog/model";

export const runtime = "nodejs";

/**
 * A user's public profile. Returns a projection with no private fields
 * (email/settings/privacy) and only when the target made their profile public.
 * A private profile 404s — indistinguishable from one that does not exist, so
 * its existence is not leaked.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ uid: string }> }
): Promise<Response> {
  const me = await uidFromRequest(req);
  if (!me) return unauthorized();

  const { uid: userId } = await params;
  const snap = await adminDb().collection("users").doc(userId).get();
  if (!snap.exists) return Response.json({ error: "Not found" }, { status: 404 });

  const u = snap.data() as User;
  // The caller can always see their own profile; others only if it is public.
  if (userId !== me && u.privacy?.publicProfile !== true) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const profile: PublicProfile = {
    userId: u.userId,
    displayName: u.displayName,
    handle: u.handle,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
    counts: u.counts,
  };
  return Response.json(profile);
}
