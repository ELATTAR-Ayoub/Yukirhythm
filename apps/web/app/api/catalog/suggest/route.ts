import { uidFromRequest, unauthorized } from "@/lib/firebase/verify";
import { getCatalogProvider } from "@/lib/catalog/provider";

export async function GET(req: Request): Promise<Response> {
  const uid = await uidFromRequest(req);
  if (!uid) return unauthorized();

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (!q) return Response.json({ suggestions: [] });

  try {
    return Response.json({
      suggestions: await (await getCatalogProvider()).suggest(q),
    });
  } catch {
    // Autocomplete is decorative — degrade silently rather than error.
    return Response.json({ suggestions: [] });
  }
}
