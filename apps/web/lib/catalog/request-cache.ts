type Entry = { expiresAt: number; value: unknown };

const root = globalThis as typeof globalThis & {
  __yukiRequestCache?: Map<string, Entry>;
  __yukiRequestFlights?: Map<string, Promise<unknown>>;
};
const cache =
  root.__yukiRequestCache ??
  (root.__yukiRequestCache = new Map<string, Entry>());
const flights =
  root.__yukiRequestFlights ??
  (root.__yukiRequestFlights = new Map<string, Promise<unknown>>());

export function readRequestCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function writeRequestCache<T>(key: string, value: T, ttlMs: number): T {
  // Bound process memory even when users issue many unique search queries.
  if (!cache.has(key) && cache.size >= 500)
    cache.delete(cache.keys().next().value!);
  cache.set(key, { expiresAt: Date.now() + ttlMs, value });
  return value;
}

export function invalidateRequestCache(key: string): void {
  cache.delete(key);
  flights.delete(key);
}

export function clearRequestCache(): void {
  cache.clear();
  flights.clear();
}

export async function cachedSingleFlight<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>
): Promise<T> {
  const cached = readRequestCache<T>(key);
  if (cached !== null) return cached;
  const running = flights.get(key) as Promise<T> | undefined;
  if (running) return running;
  const request: Promise<T> = Promise.resolve()
    .then(load)
    .then((value) =>
      flights.get(key) === request
        ? writeRequestCache(key, value, ttlMs)
        : value
    )
    .finally(() => {
      if (flights.get(key) === request) flights.delete(key);
    });
  flights.set(key, request);
  return request;
}
