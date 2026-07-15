export function makeCacheKey(query: string, quantity: number): string {
  return `${query.trim().toLowerCase()}::${quantity}`;
}

interface Entry<T> {
  value: T;
  expiresAt: number;
}

// Small in-memory TTL cache. `now` is injectable for testing.
export class TtlCache<T> {
  private store = new Map<string, Entry<T>>();
  constructor(private ttlMs: number) {}

  get(key: string, now: number = Date.now()): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, now: number = Date.now()): void {
    this.store.set(key, { value, expiresAt: now + this.ttlMs });
  }
}
