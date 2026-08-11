export function gone(feature: string): Response {
  return Response.json(
    {
      error: `${feature} is browser-local and no longer available through the API`,
    },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}
