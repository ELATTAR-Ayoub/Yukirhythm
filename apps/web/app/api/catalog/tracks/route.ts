import { adminDb } from "@/lib/firebase/admin";
import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { resolveLabel } from "@/lib/catalog/taxonomy";

const LIMIT = 40;

export async function GET(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const raw = (new URL(req.url).searchParams.get("label") ?? "").trim();
  // Enrichment writes only canonical slugs, so a free-form string can never
  // match. Resolving here is what lets "Lo-Fi" and "lo fi" both work.
  const label = resolveLabel(raw);
  if (!label) {
    return Response.json({ error: "Unknown label" }, { status: 400 });
  }

  const snap = await adminDb()
    .collection("tracks")
    .where("isEmbeddable", "==", true)
    // labelIds is the flat mirror of labels[].label — array-contains cannot
    // match a nested field, so querying labels directly would return nothing.
    .where("labelIds", "array-contains", label)
    .limit(LIMIT)
    .get();

  return Response.json({ label, tracks: snap.docs.map((d) => d.data()) });
}
