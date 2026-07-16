// Minimal shapes so this stays testable without importing firebase directly.
export interface UserDocOps {
  ref: unknown;
  getDoc: (ref: unknown) => Promise<{
    exists: () => boolean;
    data?: () => any;
  }>;
  setDoc: (ref: unknown, value: unknown) => Promise<void>;
}

export interface EnsureResult {
  created: boolean;
  data: any;
}

// Creates the user doc keyed by uid only if it does not already exist.
export async function ensureUserDoc(
  ops: UserDocOps,
  _uid: string,
  userData: Record<string, unknown>
): Promise<EnsureResult> {
  const snap = await ops.getDoc(ops.ref);
  if (snap.exists()) {
    return { created: false, data: snap.data?.().userData ?? null };
  }
  await ops.setDoc(ops.ref, { userData });
  return { created: true, data: userData };
}
