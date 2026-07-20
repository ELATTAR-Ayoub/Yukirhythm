import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { getCatalogProvider } from "@/lib/catalog/provider";
import { ingestTrack } from "@/lib/catalog/ingest";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ trackId: string }> }
): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const { trackId } = await params;
  const ref = adminDb().collection("tracks").doc(trackId);
  const snap = await ref.get();
  if (snap.exists) return Response.json(snap.data());

  // Not seen before — fetch from the provider, store, and return.
  const provider = await getCatalogProvider();
  const track = await provider.getTrack(trackId);
  if (!track) return Response.json({ error: "Not found" }, { status: 404 });

  await ingestTrack(track);
  return Response.json((await ref.get()).data());
}
