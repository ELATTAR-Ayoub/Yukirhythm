# First-Run Experience & Player Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the app behind login, land new accounts on Search with working self-priming feeds (with skeletons), put Like in the device player, make the seek bar's click-to-jump real, and make search fire on Enter.

**Architecture:** Client-side auth gate matching the app's client-Firebase auth (no session cookies exist to gate server-side). Feed routes gain a provider-search cold-start fallback (`lib/catalog/cold-start.ts`) so an empty/unindexed catalogue degrades to live YouTube results that ingest themselves. UI state gains one `feedsLoading` flag; a shared `FeedShelf` renders skeleton/empty/cards for Home + Search. The hidden `react-player` moves behind a tiny wrapper that receives the seek ref as a plain prop, because `next/dynamic` does not reliably forward a real `ref`.

**Tech Stack:** Next 16 App Router, React 19, Firebase (client auth + Admin on routes), Radix UI, vitest + Testing Library, Firebase emulator for integration tests.

**Spec:** `docs/superpowers/specs/2026-07-24-first-run-and-player-fixes-design.md`

**Conventions for every task:**
- Work on branch `v2_2026`. Run all commands from `apps/web` unless stated.
- Unit tests: `npx vitest run <file>`. Full suite: `npm test`. Types: `npm run typecheck`.
- Integration tests need the emulator: `npm run emulator` (leave running), then `npm run test:integration`.
- Commit after each task with the message given in its final step (append the standard `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer).

---

### Task 1: AuthGate — the (studio) shell renders nothing without a user

**Files:**
- Create: `apps/web/components/studio/shell/AuthGate.tsx`
- Create: `apps/web/components/studio/shell/AuthGate.test.tsx`
- Modify: `apps/web/app/(studio)/layout.tsx` (StudioLayout at the bottom)
- Modify: `apps/web/app/(studio)/layout.test.tsx` (add one mock)

- [ ] **Step 1: Write the failing test**

`apps/web/components/studio/shell/AuthGate.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { replace, authState } = vi.hoisted(() => ({
  replace: vi.fn(),
  authState: { user: null as { uid: string } | null, loading: true },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/studio/useAuth", () => ({ useAuthState: () => authState }));
vi.mock("@/components/Loader", () => ({
  default: () => <div data-testid="loader" />,
}));

import AuthGate from "./AuthGate";

describe("AuthGate", () => {
  beforeEach(() => {
    replace.mockClear();
    authState.user = null;
    authState.loading = true;
  });

  it("renders the loader, not children, while auth is settling", () => {
    render(
      <AuthGate>
        <div data-testid="gated" />
      </AuthGate>
    );
    expect(screen.getByTestId("loader")).toBeTruthy();
    expect(screen.queryByTestId("gated")).toBeNull();
    // Treating "not yet known" as signed out would bounce every returning
    // user through /auth on a cold load.
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects to /auth once settled signed out, still never rendering children", () => {
    authState.loading = false;
    render(
      <AuthGate>
        <div data-testid="gated" />
      </AuthGate>
    );
    expect(replace).toHaveBeenCalledWith("/auth");
    expect(screen.queryByTestId("gated")).toBeNull();
  });

  it("renders children for a signed-in user and does not redirect", () => {
    authState.loading = false;
    authState.user = { uid: "u1" };
    render(
      <AuthGate>
        <div data-testid="gated" />
      </AuthGate>
    );
    expect(screen.getByTestId("gated")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL (module not found)**

Run: `npx vitest run components/studio/shell/AuthGate.test.tsx`

- [ ] **Step 3: Implement AuthGate**

`apps/web/components/studio/shell/AuthGate.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import Loader from "@/components/Loader";
import { useAuthState } from "@/lib/studio/useAuth";
import { AUTH } from "./routes";

/**
 * The studio shell's front door: signed out means the login page and nothing
 * else. Client-side because auth itself is client-side Firebase — there is no
 * session cookie a middleware could verify.
 *
 * While auth is settling this renders the loader, never children: "not yet
 * known" must not flash gated content, and must not bounce a returning user
 * through /auth either (so no redirect until `loading` clears).
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthState();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace(AUTH);
  }, [user, loading, router]);

  if (loading || !user) return <Loader />;
  return <>{children}</>;
}
```

Before writing, open `apps/web/components/Loader.tsx` to confirm the default
export renders standalone (it is what `app/loading.tsx` shows); no changes to
it are expected.

- [ ] **Step 4: Run the test — expect PASS**

Run: `npx vitest run components/studio/shell/AuthGate.test.tsx`

- [ ] **Step 5: Mount the gate in the studio layout**

In `apps/web/app/(studio)/layout.tsx`, add the import and wrap the layout
(gate OUTSIDE StudioProvider, so a signed-out visitor never mounts the data
provider):

```tsx
import AuthGate from "@/components/studio/shell/AuthGate";
```

Replace the `StudioLayout` export at the bottom of the file with:

```tsx
export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <StudioProvider>
        <Shell>{children}</Shell>
        <Toaster />
      </StudioProvider>
    </AuthGate>
  );
}
```

- [ ] **Step 6: Keep the layout suite green**

`apps/web/app/(studio)/layout.test.tsx` now mounts AuthGate. Add next to the
existing `vi.mock("@/components/studio/StudioProvider", …)` mock:

```tsx
// The shell suite is about the grid; sign the gate in so it stays out of the
// way (AuthGate has its own suite).
vi.mock("@/lib/studio/useAuth", () => ({
  useAuthState: () => ({ user: { uid: "u1" }, loading: false }),
}));
```

- [ ] **Step 7: Run both suites — expect PASS**

Run: `npx vitest run components/studio/shell/AuthGate.test.tsx "app/(studio)/layout.test.tsx"`

- [ ] **Step 8: Commit**

```
feat(auth): gate every studio route behind sign-in
```

---

### Task 2: Root page — signed out → /auth, cold account → /search

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/page.test.tsx`

- [ ] **Step 1: Update the tests to the new destinations**

In `apps/web/app/page.test.tsx`:
- "sends a signed-out visitor to home" becomes:

```tsx
  it("sends a signed-out visitor to the login page", async () => {
    authState.user = null;
    render(<RootPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/auth"));
  });
```

- "sends a brand-new account to the queue" becomes:

```tsx
  it("sends a brand-new account to search", async () => {
    // Nothing queued and nothing ever played: Search is where the feeds and
    // the search field give a cold account something to actually do.
    render(<RootPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/search"));
  });
  ```

- In the final test ("waits for auth to settle…"), no assertion changes.

- [ ] **Step 2: Run — expect the two updated tests to FAIL**

Run: `npx vitest run app/page.test.tsx`

- [ ] **Step 3: Update the page**

In `apps/web/app/page.tsx`:
- Change the routes import to `import { AUTH, HOME, SEARCH } from "@/components/studio/shell/routes";`
- In the signed-out branch replace `router.replace(HOME)` with `router.replace(AUTH)` and update its comment: signed out now means the login gate, full stop.
- In the playback `.then` replace `router.replace(cold ? QUEUE : HOME)` with `router.replace(cold ? SEARCH : HOME)`.
- Update the file's doc comment: a brand-new account lands on Search (the feeds and the search field are the useful controls on a cold account); signed-out visitors land on the login page.

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run app/page.test.tsx`

- [ ] **Step 5: Commit**

```
feat(app): signed-out visitors get the login page; new accounts land on Search
```

---

### Task 3: Auth page — the only exit is a settled session

**Files:**
- Modify: `apps/web/app/auth/page.tsx`
- Rewrite: `apps/web/app/auth/page.test.tsx`

The page stops navigating from `onAuthed` (which fires before the popup
actually completes) and instead watches real auth state: the moment Firebase
reports a user — fresh sign-in or an already-signed-in visitor — it hands off
to `/`, where Task 2's decision routes new → Search, returning → Home.

- [ ] **Step 1: Rewrite the test file**

`apps/web/app/auth/page.test.tsx` (full replacement — the old test asserted
the `onAuthed → /home` push this task removes):

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import MockStudioProvider from "@/components/studio/screens/MockStudioProvider";

const { replace, authState } = vi.hoisted(() => ({
  replace: vi.fn(),
  authState: { user: null as { uid: string } | null, loading: false },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/studio/useAuth", () => ({ useAuthState: () => authState }));

import AuthScreen from "./page";

describe("AuthScreen", () => {
  beforeEach(() => {
    replace.mockClear();
    authState.user = null;
    authState.loading = false;
  });

  it("stays put for a signed-out visitor", () => {
    render(
      <MockStudioProvider>
        <AuthScreen />
      </MockStudioProvider>
    );
    expect(
      screen.getByRole("button", { name: /continue with google/i })
    ).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("hands an already-signed-in visitor to the root decision", () => {
    authState.user = { uid: "u1" };
    render(
      <MockStudioProvider>
        <AuthScreen />
      </MockStudioProvider>
    );
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("waits for auth to settle before redirecting", () => {
    authState.loading = true;
    render(
      <MockStudioProvider>
        <AuthScreen />
      </MockStudioProvider>
    );
    expect(replace).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL (page still pushes /home, no redirect effect)**

Run: `npx vitest run app/auth/page.test.tsx`

- [ ] **Step 3: Update the page**

In `apps/web/app/auth/page.tsx`:
- Add imports: `import { useEffect } from "react";` and
  `import { useAuthState } from "@/lib/studio/useAuth";`
- Inside `AuthScreen`, add:

```tsx
  const { user, loading } = useAuthState();

  // The page's only exit: the moment Firebase reports a session — whether the
  // user just signed in here or arrived already signed in — hand off to the
  // root, which decides between Search (new account) and Home (returning).
  // `onAuthed` was the wrong trigger: it fires when the popup OPENS, before
  // any session exists.
  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [user, loading, router]);
```

- Replace `<SocialAuthButtons onAuthed={() => router.push(`${BASE}/home`)} />`
  with `<SocialAuthButtons />`. If `BASE` is now unused except by the Terms
  link, keep it (the Terms link uses it).

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run app/auth/page.test.tsx`

- [ ] **Step 5: Commit**

```
feat(auth): auth page exits on a settled session, not on popup open
```

---

### Task 4: `coldStartTracks` — provider-search priming for empty feeds

**Files:**
- Create: `apps/web/lib/catalog/cold-start.ts`
- Create: `apps/web/lib/catalog/cold-start.test.ts`

- [ ] **Step 1: Write the failing tests**

`apps/web/lib/catalog/cold-start.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { setCatalogProvider, type CatalogProvider } from "./provider";
import type { ProviderTrack } from "./types";

const { readCache, writeCache, ingestTracks } = vi.hoisted(() => ({
  readCache: vi.fn(),
  writeCache: vi.fn(),
  ingestTracks: vi.fn(),
}));

vi.mock("./cache", () => ({
  cacheKey: (q: string, t: string) => `${t}:${q}`,
  readCache,
  writeCache,
}));
vi.mock("./ingest", () => ({ ingestTracks }));

import { coldStartTracks } from "./cold-start";

function pt(id: string, over: Partial<ProviderTrack> = {}): ProviderTrack {
  return {
    providerTrackId: id,
    videoId: id,
    type: "track",
    title: `Track ${id}`,
    artists: [{ artistId: `a-${id}`, name: `Artist ${id}` }],
    album: null,
    durationSec: 200,
    artwork: [],
    isEmbeddable: true,
    isLive: false,
    isFamilySafe: true,
    viewCount: 1000,
    likeCount: 0,
    publishedAt: null,
    keywords: [],
    categoryName: null,
    ...over,
  };
}

function stubProvider(byQuery: Record<string, ProviderTrack[]>): CatalogProvider {
  return {
    async search(query) {
      const tracks = byQuery[query];
      if (tracks === undefined) throw new Error(`no stub for ${query}`);
      return { query, type: "song", tracks, artists: [], playlists: [] };
    },
    async suggest() {
      return [];
    },
    async getTrack() {
      return null;
    },
    async getTracks() {
      return [];
    },
    async getArtist() {
      return null;
    },
    async getRelatedTracks() {
      return [];
    },
    async getPlaylist() {
      return null;
    },
  };
}

describe("coldStartTracks", () => {
  beforeEach(() => {
    readCache.mockResolvedValue(null);
    writeCache.mockResolvedValue(undefined);
    ingestTracks.mockResolvedValue(undefined);
  });
  afterEach(() => {
    setCatalogProvider(null);
    vi.clearAllMocks();
  });

  it("searches, drops non-embeddable tracks, ingests and dedupes across queries", async () => {
    setCatalogProvider(
      stubProvider({
        a: [pt("t1"), pt("dead", { isEmbeddable: false })],
        b: [pt("t1"), pt("t2")],
      })
    );
    const got = await coldStartTracks(["a", "b"], 10);
    expect(got.map((t) => t.providerTrackId)).toEqual(["t1", "t2"]);
    expect(ingestTracks).toHaveBeenCalledTimes(2);
    const ingestedIds = ingestTracks.mock.calls.flatMap(([tracks]) =>
      (tracks as ProviderTrack[]).map((t) => t.providerTrackId)
    );
    expect(ingestedIds).not.toContain("dead");
  });

  it("serves from cache without touching the provider", async () => {
    readCache.mockResolvedValue([pt("cached")]);
    setCatalogProvider(stubProvider({})); // any real search would throw
    const got = await coldStartTracks(["a"], 10);
    expect(got.map((t) => t.providerTrackId)).toEqual(["cached"]);
    expect(ingestTracks).not.toHaveBeenCalled();
    expect(writeCache).not.toHaveBeenCalled();
  });

  it("skips a failing query and still answers from the others", async () => {
    setCatalogProvider(stubProvider({ good: [pt("t1")] })); // "bad" throws
    const got = await coldStartTracks(["bad", "good"], 10);
    expect(got.map((t) => t.providerTrackId)).toEqual(["t1"]);
  });

  it("caps the result at the limit", async () => {
    setCatalogProvider(stubProvider({ a: [pt("t1"), pt("t2"), pt("t3")] }));
    const got = await coldStartTracks(["a"], 2);
    expect(got).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run — expect FAIL (module not found)**

Run: `npx vitest run lib/catalog/cold-start.test.ts`

- [ ] **Step 3: Implement**

`apps/web/lib/catalog/cold-start.ts`:

```ts
import { getCatalogProvider } from "./provider";
import { ingestTracks } from "./ingest";
import { cacheKey, readCache, writeCache } from "./cache";
import type { ProviderTrack } from "./types";

/**
 * Cold-start priming for the feed routes.
 *
 * On a brand-new deployment the `tracks` collection is empty (and its
 * popularity composite index may not be deployed), so the feeds' Firestore
 * fallbacks have nothing to answer with. These curated provider searches fill
 * that gap; every result is ingested, so the fallback warms the catalogue and
 * stops being needed once it has run.
 */
export const NEW_RELEASES_QUERIES = ["new music this week", "new songs 2026"];
export const YOU_MIGHT_LIKE_QUERIES = ["top hits", "popular songs"];

/**
 * Provider-searches each query (24h-cached, so cold loads don't hammer the
 * scraper), keeps only embeddable tracks, ingests them, and returns the union
 * deduped by track id, capped at `limit`. A failing query is logged and
 * skipped — a cold start answering with fewer tracks beats one answering with
 * an error.
 */
export async function coldStartTracks(
  queries: string[],
  limit: number
): Promise<ProviderTrack[]> {
  const out = new Map<string, ProviderTrack>();
  for (const q of queries) {
    if (out.size >= limit) break;
    try {
      // "coldstart" prefixes the key: the search route caches a different
      // payload shape (its SearchResponse) under the bare query.
      const key = cacheKey(`coldstart ${q}`, "song");
      let tracks = await readCache<ProviderTrack[]>(key);
      if (!tracks) {
        const provider = await getCatalogProvider();
        const res = await provider.search(q, { type: "song", limit: 20 });
        tracks = res.tracks.filter((t) => t.isEmbeddable);
        await ingestTracks(tracks);
        await writeCache(key, tracks);
      }
      for (const t of tracks) {
        if (!out.has(t.providerTrackId)) out.set(t.providerTrackId, t);
      }
    } catch (err) {
      console.error(`cold-start: query "${q}" failed`, err);
    }
  }
  return [...out.values()].slice(0, limit);
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run lib/catalog/cold-start.test.ts`

- [ ] **Step 5: Commit**

```
feat(catalog): provider-search cold start that primes the catalogue
```

---

### Task 5: New-releases route — never 500, never empty on a fresh deployment

**Files:**
- Modify: `apps/web/app/api/feed/new-releases/route.ts`
- Modify: `apps/web/app/api/feed/feed.integration.test.ts`

**Note:** integration tests need the emulator running: from `apps/web`, start
`npm run emulator` in a separate/background process first.

- [ ] **Step 1: Add the failing integration tests**

Append to `apps/web/app/api/feed/feed.integration.test.ts` a NEW top-level
`describe` (sibling of the existing one — it must NOT inherit the existing
`beforeEach` that pre-ingests tracks). It reuses the file's existing `pt`,
`stub`, `auth`, `post`, `token` helpers:

```ts
describe("new-releases cold start on an empty catalogue", () => {
  beforeEach(async () => {
    await clearFirestore();
    await ensureUser(post(token, "/api/me", {}));
  });

  it("answers from the provider when the catalogue is empty", async () => {
    setCatalogProvider({
      ...stub,
      async search(query) {
        return {
          query,
          type: "song",
          tracks: [pt("cold1"), pt("cold2")],
          artists: [],
          playlists: [],
        };
      },
    });
    try {
      const res = await newReleases(auth(token, "/api/feed/new-releases"));
      expect(res.status).toBe(200);
      const body = await res.json();
      const ids = body.items.map((i: { trackId: string }) => i.trackId);
      expect(ids).toContain("cold1");
      expect(ids).toContain("cold2");
    } finally {
      setCatalogProvider(stub);
    }
  });

  it("still answers 200 with an empty list when the provider fails too", async () => {
    setCatalogProvider({
      ...stub,
      async search(): Promise<never> {
        throw new Error("scraper down");
      },
    });
    try {
      const res = await newReleases(auth(token, "/api/feed/new-releases"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.items)).toBe(true);
    } finally {
      setCatalogProvider(stub);
    }
  });
});
```

- [ ] **Step 2: Run — expect the first new test to FAIL (empty items)**

Run: `npx vitest run --config vitest.integration.config.ts app/api/feed/feed.integration.test.ts`

- [ ] **Step 3: Implement the fallback**

In `apps/web/app/api/feed/new-releases/route.ts`:

- Add imports:

```ts
import { coldStartTracks, NEW_RELEASES_QUERIES } from "@/lib/catalog/cold-start";
import { toTrackDoc } from "@/lib/catalog/ingest";
```

- Replace the existing `if (candidates.size < 6) { … }` popular-tracks block
  with:

```ts
  // Cold start / thin candidates: globally popular catalogue tracks. Guarded —
  // this is the query that needs the (isEmbeddable, stats.viewCount) composite
  // index, and an undeployed index must degrade to the provider fallback
  // below, not to a 500.
  if (candidates.size < 6) {
    try {
      const popular = await db
        .collection("tracks")
        .where("isEmbeddable", "==", true)
        .orderBy("stats.viewCount", "desc")
        .limit(30)
        .get();
      for (const doc of popular.docs) {
        if (!ctx.exclude.has(doc.id) && !candidates.has(doc.id)) {
          candidates.set(doc.id, doc.data() as Track);
        }
      }
    } catch (err) {
      console.error("feed/new-releases: popular-tracks query failed", err);
    }
  }

  // Still thin — a fresh deployment with an empty catalogue. Prime it through
  // the provider; coldStartTracks ingests what it finds, so this branch stops
  // running once it has succeeded once.
  if (candidates.size < 6) {
    const cold = await coldStartTracks(NEW_RELEASES_QUERIES, 30);
    for (const t of cold) {
      const id = t.providerTrackId;
      if (!ctx.exclude.has(id) && !candidates.has(id)) {
        candidates.set(id, toTrackDoc(t));
      }
    }
  }
```

- [ ] **Step 4: Run — expect PASS (whole feed integration file)**

Run: `npx vitest run --config vitest.integration.config.ts app/api/feed/feed.integration.test.ts`

- [ ] **Step 5: Commit**

```
fix(feed): new-releases survives a missing index and an empty catalogue
```

---

### Task 6: You-might-like route — same cold-start treatment

**Files:**
- Modify: `apps/web/app/api/feed/you-might-like/route.ts`
- Modify: `apps/web/app/api/feed/feed.integration.test.ts`

- [ ] **Step 1: Add the failing integration tests**

Append another sibling `describe` to the feed integration file:

```ts
describe("you-might-like cold start on an empty catalogue", () => {
  beforeEach(async () => {
    await clearFirestore();
    await ensureUser(post(token, "/api/me", {}));
  });

  it("answers from the provider when the catalogue is empty", async () => {
    setCatalogProvider({
      ...stub,
      async search(query) {
        return {
          query,
          type: "song",
          tracks: [pt("cold1"), pt("cold2")],
          artists: [],
          playlists: [],
        };
      },
    });
    try {
      const res = await youMightLike(auth(token, "/api/feed/you-might-like"));
      expect(res.status).toBe(200);
      const body = await res.json();
      const ids = body.items.map((i: { trackId: string }) => i.trackId);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids).toContain("cold1");
      // every item resolves to a real track doc for the UI
      expect(body.items.every((i: { track: unknown }) => i.track)).toBe(true);
    } finally {
      setCatalogProvider(stub);
    }
  });

  it("still answers 200 with an empty list when the provider fails too", async () => {
    setCatalogProvider({
      ...stub,
      async search(): Promise<never> {
        throw new Error("scraper down");
      },
    });
    try {
      const res = await youMightLike(auth(token, "/api/feed/you-might-like"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.items)).toBe(true);
    } finally {
      setCatalogProvider(stub);
    }
  });
});
```

- [ ] **Step 2: Run — expect the first new test to FAIL**

Run: `npx vitest run --config vitest.integration.config.ts app/api/feed/feed.integration.test.ts`

- [ ] **Step 3: Implement the fallback**

In `apps/web/app/api/feed/you-might-like/route.ts`:

- Add import:

```ts
import { coldStartTracks, YOU_MIGHT_LIKE_QUERIES } from "@/lib/catalog/cold-start";
```

- Guard the cold seed (it uses the same composite index):

```ts
  const seeds = personalized && ctx.topPlayed.length ? ctx.topPlayed.slice(0, 3) : [];
  if (seeds.length === 0) {
    // Needs the popularity composite index; an undeployed index must not 500
    // the feed — the cold-start below covers the gap.
    const cold = await coldSeed().catch((err) => {
      console.error("feed/you-might-like: cold seed query failed", err);
      return null;
    });
    if (cold) seeds.push(cold);
  }
```

- After the existing radio-building `for (const seedId of seeds) { … }` loop,
  add:

```ts
  // A brand-new deployment has no seeds at all (empty catalogue), or seeds
  // whose related-tracks come back empty — prime the radio through the
  // provider instead. coldStartTracks ingests its results, so the doc
  // resolution below finds them.
  if (radio.length === 0) {
    const cold = await coldStartTracks(YOU_MIGHT_LIKE_QUERIES, 20);
    for (const t of cold) {
      if (!ctx.exclude.has(t.providerTrackId)) {
        radio.push({ trackId: t.providerTrackId, seedTitle: "popular right now" });
      }
    }
  }
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run --config vitest.integration.config.ts app/api/feed/feed.integration.test.ts`

- [ ] **Step 5: Commit**

```
fix(feed): you-might-like survives a missing index and an empty catalogue
```

---

### Task 7: `feedsLoading` — one honest flag for the shelves

**Files:**
- Modify: `apps/web/components/studio/screens/MockStudioProvider.tsx` (type + provider)
- Modify: `apps/web/components/studio/StudioProvider.tsx`

No new test file — the flag is exercised by Task 8/9's component tests; this
task must end with `npm run typecheck` and the full unit suite green.

- [ ] **Step 1: Extend the context type**

In `MockStudioProvider.tsx`, after the `youMightLike: MockTrack[];` member of
`MockStudioValue`, add:

```ts
  /** True while the home/search shelves' feeds are in flight. */
  feedsLoading: boolean;
```

- [ ] **Step 2: Extend the mock provider**

Change `MockStudioProvider`'s signature to accept an override (it is the
test/docs harness — this is how suites will drive loading and empty states):

```tsx
export default function MockStudioProvider({
  children,
  feeds,
}: {
  children: React.ReactNode;
  /** Test/docs override for the feed shelves' data and loading state. */
  feeds?: {
    loading?: boolean;
    youMightLike?: MockTrack[];
    newReleases?: MockTrack[];
  };
}) {
```

Change the two feed memos (currently `resolve(NEW_RELEASE_IDS)` /
`resolve(YOU_MIGHT_LIKE_IDS)` with `[]` deps) to:

```ts
  const newReleases = useMemo(
    () => feeds?.newReleases ?? resolve(NEW_RELEASE_IDS),
    [feeds]
  );
  const youMightLike = useMemo(
    () => feeds?.youMightLike ?? resolve(YOU_MIGHT_LIKE_IDS),
    [feeds]
  );
```

Add `feedsLoading: feeds?.loading ?? false,` to the provider's context value
object (and to its `useMemo` dependency array if the value is memoised —
follow whatever the surrounding members do).

- [ ] **Step 3: Implement in StudioProvider**

In `apps/web/components/studio/StudioProvider.tsx`:

- Add state next to the other feed state:

```ts
  const [feedsLoading, setFeedsLoading] = useState(true);
```

- In the sign-in effect's `if (!fbUser)` branch add `setFeedsLoading(false);`.
- At the top of the signed-in path (before `try {`) add
  `setFeedsLoading(true);` (a sign-out → sign-in must re-skeleton).
- Replace the block of five fire-and-forget feed/profile calls (the
  `backend.feed.jumpBackIn()` through `backend.me.recents()` calls with their
  `() => {}` rejection handlers) with:

```ts
      // Feeds and profile data. Each is independent — one failing rail must
      // not blank the others, so they settle separately. Failures are logged:
      // a silently-empty shelf is indistinguishable from a broken feed.
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const warn = (name: string) => (err: unknown) =>
        console.warn(`Feed load failed: ${name}`, err);
      void backend.feed.jumpBackIn().then(
        (r) => live && setJumpBackIn(r.collections.map((c) => toStudioCollection(c))),
        warn("jump-back-in")
      );
      const shelfFeeds = [
        backend.feed.newReleases().then((r) => {
          if (live) setNewReleases(absorb(r.items.map((i) => i.track)));
        }),
        backend.feed.youMightLike().then((r) => {
          if (live) setYouMightLike(absorb(r.items.map((i) => i.track)));
        }),
      ] as const;
      void Promise.allSettled(shelfFeeds).then((results) => {
        results.forEach((r, i) => {
          if (r.status === "rejected")
            warn(i === 0 ? "new-releases" : "you-might-like")(r.reason);
        });
        // Cleared on success AND failure — a dead feed shows its empty state,
        // never a skeleton that pulses forever.
        if (live) setFeedsLoading(false);
      });
      void backend.me.stats(tz).then(
        (s) => live && setStats(toStudioStats(s)),
        warn("stats")
      );
      void backend.me.recents().then(
        (r) => {
          if (!live) return;
          absorb(r.items.map((i) => i.track).filter((t): t is Track => t !== null));
          setRecents(toStudioHistory(r.items, Date.now()));
        },
        warn("recents")
      );
```

- Add `feedsLoading,` to the context `value` object and to its `useMemo`
  dependency array.

- [ ] **Step 4: Verify types and suite**

Run: `npm run typecheck` then `npm test`
Expected: both clean (nothing consumes the flag yet).

- [ ] **Step 5: Commit**

```
feat(studio): feedsLoading flag + logged feed failures
```

---

### Task 8: `FeedShelf` — shared skeleton/empty/cards shelf

**Files:**
- Create: `apps/web/components/studio/screens/FeedShelf.tsx`
- Create: `apps/web/components/studio/screens/FeedShelf.test.tsx`

- [ ] **Step 1: Write the failing tests**

`apps/web/components/studio/screens/FeedShelf.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider, { useMockStudio } from "./MockStudioProvider";
import { MOCK_TRACKS } from "./mock-data";
import FeedShelf from "./FeedShelf";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));

function NowPlayingProbe() {
  const { nowPlaying } = useMockStudio();
  return <div data-testid="now-playing">{nowPlaying?.title ?? "none"}</div>;
}

describe("FeedShelf", () => {
  it("skeletons the whole shelf while loading", () => {
    render(
      <MockStudioProvider>
        <FeedShelf label="For you" title="You might like" tracks={[]} loading />
      </MockStudioProvider>
    );
    // RailShelf's loading mode: an aria-busy section, no heading, no cards.
    expect(document.querySelector("section[aria-busy]")).toBeTruthy();
    expect(screen.queryByText("You might like")).toBeNull();
  });

  it("shows a quiet line when the feed settles empty", () => {
    render(
      <MockStudioProvider>
        <FeedShelf
          label="For you"
          title="You might like"
          tracks={[]}
          loading={false}
        />
      </MockStudioProvider>
    );
    expect(screen.getByText("You might like")).toBeTruthy();
    expect(screen.getByText(/nothing here yet/i)).toBeTruthy();
  });

  it("renders playable cards once loaded", () => {
    render(
      <MockStudioProvider>
        <NowPlayingProbe />
        <FeedShelf
          label="Fresh drops"
          title="New releases"
          tracks={MOCK_TRACKS.slice(0, 2)}
          loading={false}
        />
      </MockStudioProvider>
    );
    fireEvent.click(
      screen.getByRole("button", { name: `Play ${MOCK_TRACKS[0].title}` })
    );
    expect(screen.getByTestId("now-playing").textContent).toBe(
      MOCK_TRACKS[0].title
    );
  });
});
```

- [ ] **Step 2: Run — expect FAIL (module not found)**

Run: `npx vitest run components/studio/screens/FeedShelf.test.tsx`

- [ ] **Step 3: Implement**

`apps/web/components/studio/screens/FeedShelf.tsx`:

```tsx
"use client";

import RailShelf from "@/components/studio/RailShelf";
import MediaCard from "@/components/studio/MediaCard";
import { useMockStudio } from "./MockStudioProvider";
import { formatDuration, type MockTrack } from "./mock-data";

/** Enter/Space activation for non-button click targets. */
const playKeyHandler = (fn: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};

interface FeedShelfProps {
  label: string;
  title: string;
  tracks: MockTrack[];
  /** RailShelf skeletons the whole shelf (header included) while true. */
  loading: boolean;
  grid?: boolean;
  size?: "sm" | "md";
  cardClassName?: string;
}

/**
 * A feed-backed shelf of playable track cards with honest loading and empty
 * states: skeletons while the feed settles, a quiet line when it settles
 * empty, cards otherwise. Home's "New releases" and Search's two shelves
 * share this, so the surfaces cannot drift in how they treat the same data.
 */
export default function FeedShelf({
  label,
  title,
  tracks,
  loading,
  grid = false,
  size = "sm",
  cardClassName,
}: FeedShelfProps) {
  const { play, nowPlaying, isPlaying } = useMockStudio();

  if (loading) {
    return <RailShelf label={label} title={title} grid={grid} loading />;
  }

  if (tracks.length === 0) {
    return (
      <RailShelf label={label} title={title}>
        {/* One quiet line, not an EmptyState block — an unfilled feed is a
            normal cold-account state, and it must not dominate the page. */}
        <p className="text-sm text-muted-foreground py-2">
          Nothing here yet — play something and check back.
        </p>
      </RailShelf>
    );
  }

  return (
    <RailShelf label={label} title={title} grid={grid}>
      {tracks.map((track) => (
        <div
          key={track.id}
          role="button"
          tabIndex={0}
          aria-label={`Play ${track.title}`}
          onClick={() => play(track)}
          onKeyDown={playKeyHandler(() => play(track))}
          className="text-left shrink-0 cursor-pointer"
        >
          <MediaCard
            title={track.title}
            artist={track.artist}
            texture={track.texture}
            artUrl={track.artUrl}
            duration={formatDuration(track.durationSec)}
            size={size}
            playing={nowPlaying?.id === track.id && isPlaying}
            className={cardClassName}
          />
        </div>
      ))}
    </RailShelf>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run components/studio/screens/FeedShelf.test.tsx`

- [ ] **Step 5: Commit**

```
feat(studio): FeedShelf with skeleton and empty states
```

---

### Task 9: Search page — section order, skeletons, Enter-to-search

**Files:**
- Modify: `apps/web/app/(studio)/search/page.tsx`
- Modify: `apps/web/app/(studio)/search/page.test.tsx`

- [ ] **Step 1: Update the test harness and add the new tests**

In `apps/web/app/(studio)/search/page.test.tsx`:

- Replace the `searchFor` helper (searches now fire on submit, not change):

```tsx
/** Types a query, submits it, and lets the mock's 550ms latency settle. */
function searchFor(query: string) {
  fireEvent.change(screen.getByLabelText("Search"), {
    target: { value: query },
  });
  fireEvent.submit(screen.getByRole("search", { name: "Track search" }));
  act(() => vi.advanceTimersByTime(550));
}
```

- Add these tests inside the existing `describe`:

```tsx
  it("does not search while typing — only on submit", () => {
    renderSearch();
    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "lofi" },
    });
    act(() => vi.advanceTimersByTime(1000));

    // Still idle: the shelves are on screen and no results section exists.
    expect(screen.getByText("You might like")).toBeTruthy();
    expect(screen.queryByText("Tracks")).toBeNull();
  });

  it("returns to the idle shelves when the field is cleared", () => {
    renderSearch();
    searchFor("lofi");
    expect(screen.queryByText("You might like")).toBeNull();

    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "" },
    });
    expect(screen.getByText("You might like")).toBeTruthy();
  });

  it("orders the idle sections: You might like, New releases, Browse by mood", () => {
    renderSearch();
    const titles = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    const start = titles.indexOf("You might like");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(titles[start + 1]).toBe("New releases");
    expect(titles[start + 2]).toBe("Browse by mood");
  });

  it("skeletons both shelves while the feeds load", () => {
    render(
      <MockStudioProvider feeds={{ loading: true }}>
        <SearchScreen />
      </MockStudioProvider>
    );
    expect(document.querySelectorAll("section[aria-busy]").length).toBe(2);
    // Browse by mood is not feed-backed and stays put.
    expect(screen.getByText("Browse by mood")).toBeTruthy();
  });

  it("shows a quiet line for a feed that settles empty", () => {
    render(
      <MockStudioProvider feeds={{ youMightLike: [] }}>
        <SearchScreen />
      </MockStudioProvider>
    );
    expect(screen.getByText(/nothing here yet/i)).toBeTruthy();
  });

  it("searches immediately when a mood tile is clicked", () => {
    renderSearch();
    // EXPLORE_TILES labels are real searches; grab the first tile button.
    fireEvent.click(screen.getByRole("button", { name: "Lo-Fi" }));
    act(() => vi.advanceTimersByTime(550));
    expect(screen.queryByText("You might like")).toBeNull();
  });
```

  Before finalising the mood-tile test, open
  `components/studio/screens/mock-data.ts` and use the actual first
  `EXPLORE_TILES` label in place of `"Lo-Fi"` if it differs.

- [ ] **Step 2: Run — expect FAIL (no form, wrong order, no feedsLoading use)**

Run: `npx vitest run "app/(studio)/search/page.test.tsx"`

- [ ] **Step 3: Rewrite the page**

Replace `apps/web/app/(studio)/search/page.tsx` in full with:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";

import FeedShelf from "@/components/studio/screens/FeedShelf";
import MediaCard from "@/components/studio/MediaCard";
import TrackRow from "@/components/studio/TrackRow";
import EmptyState from "@/components/studio/EmptyState";
import Texture from "@/components/studio/Texture";
import CollectionArt from "@/components/studio/screens/CollectionArt";
import { SkeletonRow } from "@/components/studio/Skeletons";
import { Input } from "@/components/ui/input";
import SectionLabel from "@/components/studio/SectionLabel";
import PageHeader from "@/components/studio/screens/PageHeader";
import { useMockStudio } from "@/components/studio/screens/MockStudioProvider";
import { playlistHref } from "@/components/studio/shell/routes";
import { EXPLORE_TILES, formatDuration } from "@/components/studio/screens/mock-data";

/** Enter/Space activation for non-button click targets. */
const playKeyHandler = (fn: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};

export default function SearchScreen() {
  const {
    search,
    searchResults,
    searching,
    hasSearched,
    clearSearch,
    play,
    nowPlaying,
    isPlaying,
    youMightLike,
    newReleases,
    feedsLoading,
    collectionResults,
  } = useMockStudio();
  const [q, setQ] = useState("");

  // Typing only edits the field; the search fires on submit (Enter, or the
  // mobile keyboard's Search key). Emptying the field abandons the results.
  const onChange = (value: string) => {
    setQ(value);
    if (!value.trim()) clearSearch();
  };

  /** One explicit act — Enter or a mood tile — is what runs a search. */
  const submit = (value: string) => {
    setQ(value);
    if (value.trim()) search(value);
    else clearSearch();
  };

  // Collection results come from the provider (the caller's own library), so
  // Liked Songs and anything the create wizard made are findable.
  const collectionHits = collectionResults;
  // Idle = no submitted search on foot. Editing the field around a submitted
  // search keeps its results on screen until the next submit or a clear.
  const idle = !hasSearched;

  return (
    <div>
      <PageHeader title="Search" />

      <form
        role="search"
        aria-label="Track search"
        onSubmit={(e) => {
          e.preventDefault();
          submit(q);
        }}
        className="relative mb-8"
      >
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => onChange(e.target.value)}
          type="search"
          enterKeyHint="search"
          placeholder="Tracks, artists, collections…"
          aria-label="Search"
          className="pl-9"
        />
      </form>

      {idle ? (
        <div className="space-y-10">
          <FeedShelf
            label="For you"
            title="You might like"
            tracks={youMightLike}
            loading={feedsLoading}
          />

          <FeedShelf
            label="Fresh drops"
            title="New releases"
            tracks={newReleases}
            loading={feedsLoading}
          />

          <section>
            <SectionLabel>Explore</SectionLabel>
            <h2 className="font-display font-bold text-2xl tracking-tight mt-0.5 mb-3">
              Browse by mood
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {EXPLORE_TILES.map((tile) => (
                <button
                  key={tile.label}
                  type="button"
                  onClick={() => submit(tile.label)}
                  className="group relative h-24 rounded-lg overflow-hidden border border-border text-left hover:shadow-e3 hover:-translate-y-0.5 transition-all duration-base"
                >
                  <Texture
                    name={tile.texture}
                    className="absolute inset-0 w-full h-full"
                  />
                  <span className="absolute bottom-2 left-3 font-display font-bold text-snow drop-shadow">
                    {tile.label}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-8" aria-live="polite" aria-busy={searching}>
          {searching ? (
            <div className="space-y-1">
              {Array.from({ length: 6 }, (_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          ) : (
            <>
              {searchResults.length > 0 ? (
                <section>
                  <SectionLabel>Tracks</SectionLabel>
                  <div className="space-y-1 mt-2">
                    {searchResults.map((track, i) => (
                      <div
                        key={track.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Play ${track.title}`}
                        onClick={() => play(track)}
                        onKeyDown={playKeyHandler(() => play(track))}
                        className="cursor-pointer"
                      >
                        {/* The wrapping div is the button; an overlay would
                            nest one inside it. */}
                        <TrackRow
                          index={i + 1}
                          title={track.title}
                          artist={track.artist}
                          duration={formatDuration(track.durationSec)}
                          texture={track.texture}
                          artUrl={track.artUrl}
                          playing={nowPlaying?.id === track.id && isPlaying}
                          playable={false}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {collectionHits.length > 0 ? (
                <section>
                  <SectionLabel>Collections</SectionLabel>
                  <div className="space-y-2 mt-2">
                    {collectionHits.map((c) => (
                      <Link
                        key={c.id}
                        href={playlistHref(c.id)}
                        aria-label={`Open ${c.title}`}
                        className="block w-full text-left"
                      >
                        {/* No play overlay: this card is an anchor, and
                            MediaCard's overlay would nest a button inside it. */}
                        <MediaCard
                          title={c.title}
                          artist={`${c.trackIds.length} tracks`}
                          art={<CollectionArt collection={c} className="w-full h-full" />}
                          variant="extended"
                          size="sm"
                          playable={false}
                        />
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}

              {hasSearched &&
              searchResults.length === 0 &&
              collectionHits.length === 0 ? (
                <EmptyState
                  title="No results"
                  hint="Try a different search — artist, title or tag."
                  texture="tx-k2-static"
                />
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

(The old page-local `TrackShelf` component and the `RailShelf`/`MockTrack`
imports it needed are gone — `FeedShelf` replaces them.)

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run "app/(studio)/search/page.test.tsx"`

- [ ] **Step 5: Commit**

```
feat(search): Enter-to-search, shelf skeletons, and the approved section order
```

---

### Task 10: Header search field + provider debounce removal

**Files:**
- Modify: `apps/web/components/studio/shell/StudioHeader.tsx`
- Create: `apps/web/components/studio/shell/StudioHeader.test.tsx`
- Modify: `apps/web/components/studio/StudioProvider.tsx` (search/clearSearch)
- Modify: `docs/superpowers/specs/2026-07-24-first-run-and-player-fixes-design.md`

- [ ] **Step 1: Write the failing header test**

`apps/web/components/studio/shell/StudioHeader.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider, {
  useMockStudio,
} from "@/components/studio/screens/MockStudioProvider";
import { SEARCH } from "./routes";
import StudioHeader from "./StudioHeader";

const { push, nav } = vi.hoisted(() => ({
  push: vi.fn(),
  nav: { pathname: "/search" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => nav.pathname,
}));

function SearchProbe() {
  const { hasSearched } = useMockStudio();
  return <div data-testid="has-searched">{String(hasSearched)}</div>;
}

function renderHeader() {
  return render(
    <MockStudioProvider>
      <StudioHeader />
      <SearchProbe />
    </MockStudioProvider>
  );
}

describe("StudioHeader search field", () => {
  beforeEach(() => {
    push.mockClear();
    nav.pathname = SEARCH;
  });

  it("does not search while typing", () => {
    renderHeader();
    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "lofi" },
    });
    expect(screen.getByTestId("has-searched").textContent).toBe("false");
  });

  it("searches on submit", () => {
    renderHeader();
    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "lofi" },
    });
    fireEvent.submit(screen.getByRole("search", { name: "Site search" }));
    expect(screen.getByTestId("has-searched").textContent).toBe("true");
  });

  it("still routes to the search page on focus from elsewhere", () => {
    nav.pathname = "/home";
    renderHeader();
    fireEvent.focus(screen.getByLabelText("Search"));
    expect(push).toHaveBeenCalledWith(SEARCH);
  });
});
```

If the mock provider's `search()` sets `hasSearched` only after its simulated
latency, add `vi.useFakeTimers()` + `act(() => vi.advanceTimersByTime(550))`
after the submit — check `MockStudioProvider.tsx`'s `search` implementation
first.

- [ ] **Step 2: Run — expect the first two to FAIL (header searches per keystroke, no form)**

Run: `npx vitest run components/studio/shell/StudioHeader.test.tsx`

- [ ] **Step 3: Update the header**

In `StudioHeader.tsx`:

- `onChange` becomes clear-only:

```tsx
  const onChange = (value: string) => {
    setQ(value);
    if (!value.trim()) clearSearch();
  };
```

- Wrap the input `div` in a form (replace the whole
  `<div className="relative w-full max-w-[480px]">…</div>` block):

```tsx
        <form
          role="search"
          aria-label="Site search"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) search(q);
            else clearSearch();
          }}
          className="relative w-full max-w-[480px]"
        >
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={q}
            aria-label="Search"
            type="search"
            enterKeyHint="search"
            placeholder="What do you want to play?"
            className="pl-9 rounded-full"
            data-signal="shell_search"
            // Only route in — refocusing while already on /search (tabbing
            // back in, focus returning after a dialog closes) must not push.
            onFocus={() => {
              if (pathname !== SEARCH) router.push(SEARCH);
            }}
            onChange={(e) => onChange(e.target.value)}
          />
        </form>
```

- Update the component doc comment: the field routes in on focus and searches
  on Enter — never while typing.

- [ ] **Step 4: Remove the keystroke debounce from StudioProvider**

In `StudioProvider.tsx`, delete the `searchTimer` ref and replace `search` and
`clearSearch` with:

```ts
  // ---- search ------------------------------------------------------------
  // Monotonic ticket: a stale response (or one landing after a clear) must
  // not overwrite newer state. This replaces the old 550ms keystroke
  // debounce — search now only fires on an explicit submit, so delaying it
  // would be pure latency.
  const searchSeq = useRef(0);
  const search = useCallback(
    (query: string) => {
      setHasSearched(true);
      setSearching(true);
      const seq = ++searchSeq.current;
      void (async () => {
        // Catalogue (YouTube) and the caller's own library are separate
        // surfaces on the Search screen, so both are fetched.
        const [cat, lib] = await Promise.allSettled([
          backend.catalog.search(query, "song"),
          backend.me.library(query),
        ]);
        if (seq !== searchSeq.current) return;
        setSearchResults(
          cat.status === "fulfilled" ? absorb(cat.value.tracks) : []
        );
        setCollectionResults(
          lib.status === "fulfilled"
            ? lib.value.collections.map((c) => toStudioCollection(c))
            : []
        );
        setSearching(false);
      })();
    },
    [backend, absorb]
  );
```

```ts
  const clearSearch = useCallback(() => {
    searchSeq.current++;
    setSearchResults([]);
    setCollectionResults([]);
    setSearching(false);
    setHasSearched(false);
  }, []);
```

- [ ] **Step 5: Run header + search + full suite — expect PASS**

Run: `npx vitest run components/studio/shell/StudioHeader.test.tsx "app/(studio)/search/page.test.tsx"` then `npm test`

- [ ] **Step 6: Amend the spec**

In the spec's section I, append: "The desktop header's search field gets the
same treatment — it routes to /search on focus as before, but only searches
on Enter; the provider-side 550 ms debounce is removed outright since no
caller fires per keystroke anymore."

- [ ] **Step 7: Commit**

```
feat(search): header field searches on Enter; drop the keystroke debounce
```

---

### Task 11: Home page — New releases through FeedShelf

**Files:**
- Modify: `apps/web/app/(studio)/home/page.tsx`

Home's existing tests keep passing (the shelf renders the same cards); the
skeleton/empty behaviours are covered by FeedShelf's own suite.

- [ ] **Step 1: Swap the shelf**

In `home/page.tsx`:
- Add `import FeedShelf from "@/components/studio/screens/FeedShelf";` and add
  `feedsLoading` to the destructured `useMockStudio()` call.
- Replace the whole `<RailShelf label="Fresh drops" title="New releases" grid>…</RailShelf>`
  block with:

```tsx
        <FeedShelf
          label="Fresh drops"
          title="New releases"
          tracks={newReleases}
          loading={feedsLoading}
          grid
          size="md"
          cardClassName={shelfCardClassName}
        />
```

- Remove the now-unused imports (`RailShelf`, `MediaCard`, `formatDuration`
  — check what remains used; `playKeyHandler` stays only if "Jump back in"
  still needs it, which it does not — it uses plain Links — so delete it too
  if unused).

- [ ] **Step 2: Verify**

Run: `npx vitest run "app/(studio)/home/page.test.tsx"` then `npm run typecheck`
Expected: PASS, no unused-symbol errors (`noUnusedLocals` is on).

- [ ] **Step 3: Commit**

```
refactor(home): New releases renders through FeedShelf (skeletons for free)
```

---

### Task 12: Transport `leading` slot — Like in the device player

**Files:**
- Modify: `apps/web/components/studio/screens/Transport.tsx`
- Create: `apps/web/components/studio/screens/Transport.test.tsx`
- Modify: `apps/web/components/studio/screens/DevicePlayer.tsx` (one prop)
- Modify: `apps/web/components/studio/screens/DevicePlayer.test.tsx` (one test)
- Modify: `apps/web/components/studio/shell/PlaybackBar.test.tsx` (one test)

- [ ] **Step 1: Write the failing Transport tests**

`apps/web/components/studio/screens/Transport.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MockStudioProvider, { useMockStudio } from "./MockStudioProvider";
import { MOCK_TRACKS } from "./mock-data";
import Transport from "./Transport";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));

function PlayFirst() {
  const { play } = useMockStudio();
  return (
    <button type="button" onClick={() => play(MOCK_TRACKS[0])}>
      seed
    </button>
  );
}

describe("Transport leading slot", () => {
  it("renders the Loop control by default", () => {
    render(
      <MockStudioProvider>
        <Transport />
      </MockStudioProvider>
    );
    expect(screen.getByLabelText("Loop")).toBeTruthy();
    expect(screen.queryByLabelText(/^Like/)).toBeNull();
  });

  it('renders a Like toggle for the loaded track with leading="like"', () => {
    render(
      <MockStudioProvider>
        <PlayFirst />
        <Transport leading="like" />
      </MockStudioProvider>
    );
    fireEvent.click(screen.getByText("seed"));

    expect(screen.queryByLabelText("Loop")).toBeNull();
    const like = screen.getByLabelText(`Like ${MOCK_TRACKS[0].title}`);
    expect(like.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(like);
    expect(like.getAttribute("aria-pressed")).toBe("true");
  });

  it("holds the slot with an inert placeholder when nothing is loaded", () => {
    render(
      <MockStudioProvider>
        <Transport leading="like" />
      </MockStudioProvider>
    );
    const like = screen.getByLabelText("Like") as HTMLButtonElement;
    expect(like.disabled).toBe(true);
  });

  it("keeps the leading slot out of the compact cluster", () => {
    render(
      <MockStudioProvider>
        <Transport compact leading="like" />
      </MockStudioProvider>
    );
    expect(screen.queryByLabelText(/Like/)).toBeNull();
  });
});
```

If `play()` in the mock provider defers `nowPlaying` behind its simulated
load timer, wrap the suite in `vi.useFakeTimers()` and advance after the seed
click — check the provider first; `PlaybackBar.test.tsx` seeds the same way
under fake timers.

- [ ] **Step 2: Run — expect FAIL (no `leading` prop)**

Run: `npx vitest run components/studio/screens/Transport.test.tsx`

- [ ] **Step 3: Implement the slot**

In `Transport.tsx`:

- Add imports: `HeartIcon` to the `@radix-ui/react-icons` import list, and
  `import LikeButton from "./LikeButton";`
- Extend the signature:

```tsx
export default function Transport({
  size = "lg",
  compact = false,
  leading = "loop",
  onQueue,
}: {
  size?: "base" | "lg";
  /** Compressed player — prev/play/next only, no leading slot or queue. */
  compact?: boolean;
  /** What occupies the leading slot: the Loop toggle (default), or a Like
   *  control for the loaded track — the device player's choice, so a track
   *  can be liked right where it is playing. */
  leading?: "loop" | "like";
  onQueue?: () => void;
}) {
```

- Replace the leading `{compact ? null : (<PlayerButton …Loop…/>)}` block with:

```tsx
      {compact ? null : leading === "like" ? (
        nowPlaying ? (
          <LikeButton
            trackId={nowPlaying.id}
            trackTitle={nowPlaying.title}
            size="base"
          />
        ) : (
          // Inert placeholder so the cluster keeps its footprint while idle —
          // matching how prev/play/next render disabled rather than vanish.
          <PlayerButton variant="outline" disabled aria-label="Like">
            <HeartIcon />
          </PlayerButton>
        )
      ) : (
        <PlayerButton
          variant={looping ? "primary" : "outline"}
          active={looping}
          onClick={() => setLooping((l) => !l)}
          disabled={disabled}
          aria-label="Loop"
          data-signal="loop"
        >
          <LoopIcon />
        </PlayerButton>
      )}
```

Check `PlayerButton`'s default `size` and `LikeButton`'s prop range first: if
PlayerButton defaults to `"base"`, `size="base"` on LikeButton matches the
neighbouring buttons; adjust to whatever the default actually is.

- [ ] **Step 4: Point the device player at it**

In `DevicePlayer.tsx`, change the transport line to:

```tsx
        <Transport size="lg" leading="like" onQueue={() => router.push(QUEUE)} />
```

- [ ] **Step 5: Add the wiring tests**

In `DevicePlayer.test.tsx`, add inside the existing `describe`:

```tsx
  it("shows a Like control instead of Loop in its transport", () => {
    render(
      <MockStudioProvider>
        <DevicePlayer docked />
      </MockStudioProvider>
    );
    expect(screen.queryByLabelText("Loop")).toBeNull();
    expect(screen.getByLabelText(/^Like/)).toBeTruthy();
  });
```

In `PlaybackBar.test.tsx`, add inside the existing `describe` (its
`beforeEach` already sets fake timers; use the file's `stubMatchMedia`):

```tsx
  it("keeps the Loop control in the bottom bar", () => {
    stubMatchMedia(false);
    render(
      <MockStudioProvider>
        <PlaybackBar onExpand={() => {}} />
      </MockStudioProvider>
    );
    expect(screen.getByLabelText("Loop")).toBeTruthy();
  });
```

- [ ] **Step 6: Run all three suites — expect PASS**

Run: `npx vitest run components/studio/screens/Transport.test.tsx components/studio/screens/DevicePlayer.test.tsx components/studio/shell/PlaybackBar.test.tsx`

- [ ] **Step 7: Commit**

```
feat(player): Like replaces Loop in the device player; bar keeps Loop
```

---

### Task 13: Seek — make click-to-jump actually reach the YouTube player

**Files:**
- Create: `apps/web/components/studio/screens/HiddenYouTubePlayer.tsx`
- Modify: `apps/web/components/studio/StudioProvider.tsx`

The Radix slider already jumps on track-click and calls `seek()`. The break is
downstream: `StudioProvider` renders `react-player` through `next/dynamic` and
passes a real `ref` (`ref={playerRef as any}`) — `next/dynamic`'s wrapper does
not reliably forward that to the lazy-loaded class component, so
`playerRef.current?.seekTo(...)` optional-chains into a silent no-op and the
thumb snaps back on the next `onProgress`. The fix passes the ref as a plain
prop, which `next/dynamic` forwards like any other prop. (No unit test — the
player is an iframe over the network; Task 14's browser walkthrough is the
acceptance check, and it should FIRST reproduce the broken seek on the
unfixed build to confirm this diagnosis, THEN apply this task.)

- [ ] **Step 1: Reproduce (diagnosis gate)**

With the dev server running (see Task 14 step 1 for setup): play any track,
click the middle of the seek bar, and watch the time labels — expected on the
unfixed build: the thumb jumps then snaps back within a second, audio never
moves. Optionally confirm in the console that seeks no-op by temporarily
logging `playerRef.current` inside `seek()` (must show `null`/undefined
`seekTo`). If the ref is NOT null and seeking works, stop: report back
instead of applying this task.

- [ ] **Step 2: Write the wrapper**

`apps/web/components/studio/screens/HiddenYouTubePlayer.tsx`:

```tsx
"use client";

import ReactPlayer from "react-player";
import type { MutableRefObject } from "react";

/** The one slice of react-player's instance API the app uses. */
export type SeekablePlayer = {
  seekTo: (amount: number, type?: "seconds" | "fraction") => void;
};

interface HiddenYouTubePlayerProps {
  /**
   * Written from a callback ref on mount. A plain prop, deliberately not a
   * real `ref`: this component is loaded via next/dynamic, whose wrapper
   * does not reliably forward refs to the lazy-loaded class component —
   * which is exactly the silent-no-op seek bug this file exists to fix.
   */
  playerRef: MutableRefObject<SeekablePlayer | null>;
  url: string;
  playing: boolean;
  volume: number;
  onReady: () => void;
  onStart: () => void;
  onProgress: (s: { playedSeconds: number }) => void;
  onEnded: () => void;
}

/** Hidden real audio: the vinyl UI is decorative; sound comes from here. */
export default function HiddenYouTubePlayer({
  playerRef,
  ...player
}: HiddenYouTubePlayerProps) {
  return (
    <ReactPlayer
      ref={(p) => {
        playerRef.current = p;
      }}
      {...player}
      width="1px"
      height="1px"
    />
  );
}
```

- [ ] **Step 3: Rewire StudioProvider**

In `StudioProvider.tsx`:

- Replace the dynamic import:

```ts
// react-player pulls in browser-only globals; load it client-side only. The
// wrapper takes the seek ref as a plain prop — see HiddenYouTubePlayer.
const HiddenYouTubePlayer = dynamic(
  () => import("@/components/studio/screens/HiddenYouTubePlayer"),
  { ssr: false }
);
```

- Add the type import:

```ts
import type { SeekablePlayer } from "@/components/studio/screens/HiddenYouTubePlayer";
```

- Retype the ref (replacing `useRef<{ seekTo: (s: number) => void } | null>(null)`):

```ts
  const playerRef = useRef<SeekablePlayer | null>(null);
```

- Replace the JSX at the bottom (the `<ReactPlayer …/>` element and its two
  eslint-disable comments) with:

```tsx
          <HiddenYouTubePlayer
            playerRef={playerRef}
            url={`https://www.youtube.com/watch?v=${nowPlaying.id}`}
            playing={isPlaying}
            volume={volume}
            onReady={() => setIsLoading(false)}
            onStart={() => setIsLoading(false)}
            onProgress={(s) => {
              setProgressSec(Math.floor(s.playedSeconds));
              listenedRef.current = s.playedSeconds;
            }}
            onEnded={() => next()}
          />
```

- [ ] **Step 4: Verify types + suite**

Run: `npm run typecheck` then `npm test`
Expected: clean (the behavioural check is Task 14).

- [ ] **Step 5: Commit**

```
fix(player): pass the seek ref as a prop so clicks on the bar actually seek
```

---

### Task 14: Full verification — suite, integration, browser (desktop + mobile)

**Files:**
- Possibly create: `.claude/launch.json` (repo root) if absent:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "web",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev", "--workspace", "apps/web"],
      "port": 3000
    }
  ]
}
```

- [ ] **Step 1: Static gates**

From `apps/web`: `npm run typecheck`, `npm test`, `npm run lint`,
`npm run format:check`.
Expected: all clean (lint has one known pre-existing repo-wide failure in
`components/agent/YukiAgent.tsx` — anything beyond that is new and must be
fixed).

- [ ] **Step 2: Integration gate**

Start `npm run emulator` (background), then
`npm run test:integration`. Expected: PASS including the four new cold-start
tests.

- [ ] **Step 3: Browser walkthrough — desktop**

Start the dev server via the preview tools (`preview_start` with name `web`).
Environment note: the walkthrough needs whatever Firebase project
`apps/web/.env.local` points at; if sign-in against production is undesirable,
check `apps/web/config/firebase.ts` for emulator wiring and use the auth
emulator's fake-account popup instead. At ≥1440px width verify, in order:

1. Open `/home` signed out → land on `/auth`; `/library` signed out → `/auth`;
   `/terms` renders without auth.
2. Sign in with a FRESH account → land on `/search`.
3. Both shelves skeleton first, then fill with real tracks ("You might like",
   "New releases", then "Browse by mood" — in that order). No infinite
   skeleton; if a feed failed, the quiet "Nothing here yet" line shows and the
   console carries the warn.
4. Click a card in "You might like" → it plays, and the right rail's docked
   player shows the track (art, title, artist).
5. In the rail player: the leftmost transport control is a heart; click it →
   it fills and the track appears in Liked Songs. No Loop button in the rail;
   the bottom bar still has Loop.
6. Click (don't drag) at ~50% of the bottom bar's seek slider → the time
   label jumps to ~half the duration and STAYS (no snap-back); audio
   continues from there. Repeat on the rail player's slider.
7. Type a query on `/search` — nothing happens while typing; press Enter →
   skeleton rows, then results. Clear the field → shelves return. Click a
   mood tile → immediate results. Type in the HEADER field from `/home` →
   routed to `/search` on focus, results only on Enter.
8. Sign out (avatar menu) → bounced to `/auth`.

- [ ] **Step 4: Browser walkthrough — mobile (375×812 via `resize_window`)**

1. Signed out → any studio URL lands on `/auth`; the login card fits the
   viewport.
2. Signed in → `/search` via bottom tab: shelves render as horizontal
   scrollers, skeleton cards the same shape (no layout jump when they fill).
3. Tap a card → MiniPlayerBar appears; expand it → the fullscreen player's
   transport has the heart (Like), not Loop; like works.
4. Tap (not drag) mid-way on the expanded player's seek bar → playback jumps
   and stays.
5. The search input carries `enterKeyHint="search"` (inspect the DOM — the OS
   keyboard itself can't be shown here).
6. Screenshot the mobile search screen (skeletons if catchable, then filled)
   and the expanded player for the report.

- [ ] **Step 5: Fix anything found, re-run the relevant gates, commit**

```
test(app): verified first-run flow and player fixes, desktop + mobile
```

(Include in the commit only real changes made during verification; if nothing
needed fixing, skip the commit.)

---

## Deployment note (owner-run, NOT part of this plan)

The feeds' Firestore fast path still wants the composite index:
`firebase deploy --only firestore:indexes` from the repo root. Safe and
non-destructive; completely separate from the security-rules deploy, which
remains rules-last per the Phase 5 runbook. The cold-start fallback makes the
feeds work either way — the index just makes them cheaper and lets real
popularity data rank ahead of curated queries.
