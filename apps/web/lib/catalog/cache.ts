import { createHash } from "node:crypto";
import { adminDb } from "@/lib/firebase/admin";
import type { CatalogSearchType } from "./types";

const TTL_MS = 24 * 60 * 60 * 1000;
const COLLECTION = "searchCache";

/**
 * Normalises the query so "  Daft   PUNK " and "daft punk" share one entry,
 * then hashes it — raw queries are not safe Firestore document ids, and the
 * hash keeps the key length bounded.
 */
export function cacheKey(query: string, type: CatalogSearchType): string {
  const normalised = query.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha1").update(`${type}:${normalised}`).digest("hex");
}

export async function readCache<T>(key: string): Promise<T | null> {
  const snap = await adminDb().collection(COLLECTION).doc(key).get();
  if (!snap.exists) return null;
  const row = snap.data() as { payload?: T; cachedAtMs?: number } | undefined;
  if (!row?.cachedAtMs || Date.now() - row.cachedAtMs > TTL_MS) return null;
  return (row.payload ?? null) as T | null;
}

export async function writeCache(key: string, payload: unknown): Promise<void> {
  await adminDb()
    .collection(COLLECTION)
    .doc(key)
    .set({ payload, cachedAtMs: Date.now() });
}
