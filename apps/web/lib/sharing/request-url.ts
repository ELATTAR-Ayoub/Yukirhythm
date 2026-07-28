import { headers } from "next/headers";

/** Resolve metadata assets against the deploy actually serving the share. */
export async function absoluteRequestUrl(path: string): Promise<string> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) return path;
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}${path}`;
}
