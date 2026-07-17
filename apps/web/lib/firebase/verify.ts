import { adminAuth } from "@/lib/firebase/admin";

/**
 * Resolve the caller's uid from a verified Firebase ID token. The uid comes
 * from the token only — never from the request body, query, or path — so a
 * caller cannot act as another user. Returns null on any failure.
 */
export async function uidFromRequest(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return decoded.uid ?? null;
  } catch {
    return null;
  }
}

/** Standard 401 body. */
export function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
