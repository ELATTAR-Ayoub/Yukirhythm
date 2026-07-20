import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { getCatalogProvider } from "@/lib/catalog/provider";
import { toArtistDoc } from "@/lib/catalog/ingest";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ artistId: string }> }
): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const { artistId } = await params;
  const ref = adminDb().collection("artists").doc(artistId);
  const snap = await ref.get();
  // Track ingest creates name-only stubs; a stub has no bio, so refresh once.
  if (snap.exists && (snap.data() as { bio?: string | null }).bio) {
    return Response.json(snap.data());
  }

  const artist = await (await getCatalogProvider()).getArtist(artistId);
  if (!artist) {
    if (snap.exists) return Response.json(snap.data());
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await ref.set(
    { ...toArtistDoc(artist), enrichedAt: Timestamp.now() },
    { merge: true }
  );
  return Response.json((await ref.get()).data());
}
