/** Route handlers accept JSON objects. Null, arrays, and invalid JSON must
 * follow normal validation paths instead of throwing property-access errors. */
export async function readJsonObject(
  req: Request
): Promise<Record<string, unknown>> {
  const body: unknown = await req.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}
