import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import type { Collection, Track } from "@/lib/catalog/model";

export const runtime = "nodejs";

/**
 * Searches the caller's OWN library — their collections by title/tag, and their
 * liked tracks by title/artist. This is what the seed-constant search could
 * never do: Liked Songs and user-created collections were structurally
 * invisible. Owner-scoped, so it never leaks another user's private data.
 */
export async function GET(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase();
  if (!q) return Response.json({ collections: [], tracks: [] });

  const db = adminDb();

  const owned = await db
    .collection("collections")
    .where("ownerId", "==", uid)
    .get();
  const collections = owned.docs
    .map((d) => d.data() as Collection)
    .filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
    );

  const liked = await db
    .collection("users")
    .doc(uid)
    .collection("trackState")
    .where("isLiked", "==", true)
    .get();

  const tracks: Track[] = [];
  const likedDocs = liked.docs.length
    ? await db.getAll(
        ...liked.docs.map((d) => db.collection("tracks").doc(d.id))
      )
    : [];
  for (const ts of likedDocs) {
    if (!ts.exists) continue;
    const t = ts.data() as Track;
    const hit =
      t.title.toLowerCase().includes(q) ||
      t.artists.some((a) => a.name.toLowerCase().includes(q));
    if (hit) tracks.push(t);
  }

  return Response.json({ collections, tracks });
}
