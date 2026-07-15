import type { Audio } from "@/constants/interfaces";

const DEFAULT_QUANTITY = 10;
const MAX_QUANTITY = 50;
const MAX_QUERY_LEN = 200;

export type ValidationResult =
  | { ok: true; value: { string: string; quantity: number } }
  | { ok: false; error: string };

export function validateSearchRequest(body: {
  string?: unknown;
  quantity?: unknown;
}): ValidationResult {
  const raw = typeof body.string === "string" ? body.string.trim() : "";
  if (!raw) return { ok: false, error: "Query is required" };
  if (raw.length > MAX_QUERY_LEN)
    return { ok: false, error: "Query is too long" };
  let quantity =
    typeof body.quantity === "number" && body.quantity > 0
      ? Math.floor(body.quantity)
      : DEFAULT_QUANTITY;
  quantity = Math.min(quantity, MAX_QUANTITY);
  return { ok: true, value: { string: raw, quantity } };
}

export function formatVideos(results: any[], quantity: number): Audio[] {
  return results
    .filter((el) => el?.type === "video")
    .slice(0, quantity)
    .filter((el) => el?.ID && el?.URL && el?.title)
    .map((el) => ({
      ID: el.ID,
      URL: el.URL,
      title: el.title,
      thumbnails: [el.thumbnails?.[0]?.url || "", el.thumbnails?.[1]?.url || ""],
      owner: {
        name: el.owner?.name || "Unknown",
        ID: el.owner?.ID || "",
        canonicalURL: el.owner?.canonicalURL || "",
        thumbnails: [el.owner?.thumbnails?.[0]?.url || ""],
      },
      audioLengthSec: el.duration?.number || 0,
    }));
}
