import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { pickJumpBackIn } from "@/lib/catalog/recommend";
import type { Collection } from "@/lib/catalog/model";
import { loadFeedContext } from "../_context";

export const runtime = "nodejs";

/**
 * Jump back in: the collections the user has played recently, most-recent
 * first. Recency only — no scoring. Cold pad: if fewer than three, append the
 * user's most-recent owned/saved collections so the rail is never near-empty.
 */
export async function GET(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const db = adminDb();
  const { events } = await loadFeedContext(uid);

  const ids = pickJumpBackIn(events, Date.now());
  const collections: Collection[] = [];
  for (const id of ids) {
    const c = await db.collection("collections").doc(id).get();
    if (c.exists) collections.push(c.data() as Collection);
  }

  // Cold pad from owned collections, newest first, skipping ones already shown.
  if (collections.length < 3) {
    const owned = await db
      .collection("collections")
      .where("ownerId", "==", uid)
      .get();
    const extra = owned.docs
      .map((d) => d.data() as Collection)
      .filter((c) => !ids.includes(c.collectionId))
      .sort(
        (a, b) =>
          (b.createdAt as unknown as { toMillis(): number }).toMillis() -
          (a.createdAt as unknown as { toMillis(): number }).toMillis()
      );
    for (const c of extra) {
      collections.push(c);
      if (collections.length >= 3) break;
    }
  }

  return Response.json({ collections });
}
