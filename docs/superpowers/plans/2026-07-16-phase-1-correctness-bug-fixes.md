# Phase 1 — Correctness & Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the real user-facing bugs in Yukirhythm on the current stack — duplicate accounts, non-atomic Firestore writes, duplicate songs, broken loading state, unplayable-video handling, a fragile search API, and the dead metadata — each covered by a test where the logic is pure.

**Architecture:** Work on the stable Next.js 14 stack (NO dependency upgrades — Phase 3). Adopt the Firebase-native user model (Firestore user doc keyed by Auth `uid`). Keep the document *shape* unchanged (only the doc address changes) so this stays out of Phase 2's architecture work. Extract pure helpers so bug fixes are unit-testable with Vitest.

**Tech Stack:** Next.js 14 App Router, React 18, Redux Toolkit, Firebase 10 (firebase/auth + firebase/firestore), firebase-admin (migration only), react-player, sonner (toasts), Vitest.

**Working branch:** `phase-1-correctness` (already created; spec committed there).

**Context notes for the engineer:**
- Toasts use `sonner`: `import { toast } from "sonner";` — already used across the app. A `<Toaster />` is already rendered in the relevant screens.
- Firestore/auth are exported from `config/firebase.ts` as `firestore` and `auth`. Import Firestore fns from `firebase/firestore`.
- The user document body shape is `{ userData: { ID, docID?, avatar, userName, email, marketingEmails, lovedSongs, collections, lovedCollections, followers, following } }`. Reads access `doc.data().userData.*`. **Do not change this shape in Phase 1.**
- `Audio` (see `constants/interfaces.ts`) is keyed by `ID`. `lovedSongs: Audio[]`, `lovedCollections: string[]`.
- Run the build with placeholder Firebase env when needed (CI mirrors this):
  `$env:NEXT_PUBLIC_APIKEY="ci-placeholder"; $env:NEXT_PUBLIC_AUTHDOMAIN="ci-placeholder.firebaseapp.com"; $env:NEXT_PUBLIC_PROJECTID="ci-placeholder"; $env:NEXT_PUBLIC_STORAGEBUCKET="ci-placeholder.appspot.com"; $env:NEXT_PUBLIC_MESSAGINGSENDERID="0000000000"; $env:NEXT_PUBLIC_APPID="ci-placeholder"; $env:NEXT_PUBLIC_MEASUREMENTID="G-CIPLACEHOLDER"; npm run build`
  Never commit `.env*`.
- After every task: `npm run lint`, `npm run typecheck`, `npm test` must stay green. Commit messages end with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.
- Windows + `core.autocrlf=true`: `format:check` may show CRLF false-positives locally; git stores LF (`.gitattributes` enforces it). Don't fight it locally.

---

## Task ordering & file map

| Task | Area | Primary files |
|------|------|---------------|
| 1 | Player: dedupe songs by ID | `store/AudioConfig.ts` (+ test) |
| 2 | Player: add-to-player feedback & dedupe-aware toasts | `sections/Hero.tsx`, `components/player/UserAudioList.tsx`, `components/player/UserCollectionsList.tsx` |
| 3 | Player: real loading state + unplayable-video handling | `components/player/controls.tsx` |
| 4 | Search API hardening | `pages/api/searchEngine.ts` + new `lib/search/*` (+ tests) |
| 5 | Search client robustness | `sections/Hero.tsx`, `components/player/UserAudioList.tsx`, `components/player/UserCollectionsList.tsx` |
| 6 | Auth: uid-keyed user model | `context/AuthContext.tsx` (+ new `lib/user/ensureUserDoc.ts` + test) |
| 7 | Firestore: atomic like/collection writes | `context/AuthContext.tsx` |
| 8 | Metadata fix | `app/layout.tsx`, new `app/providers.tsx`, delete `app/head.tsx` |
| 9 | Migration script (owner-run) | new `scripts/migrate-users-to-uid.ts`, `package.json`, `.env.example` |

Tasks 1–5 (player/search) are independent of 6–7 (auth/data). 8 and 9 are independent. Execute in order; each ends in a commit.

---

## Task 1: Dedupe songs in the player

**Files:**
- Modify: `store/AudioConfig.ts`
- Test: `store/AudioConfig.test.ts` (create)

- [ ] **Step 1: Write failing tests** — create `store/AudioConfig.test.ts`

```ts
import { describe, it, expect } from "vitest";
import reducer, { ADD_ITEM, setAudioConfig } from "@/store/AudioConfig";
import type { Audio } from "@/constants/interfaces";

const makeAudio = (id: string): Audio => ({
  ID: id,
  URL: `https://youtu.be/${id}`,
  title: `t-${id}`,
  thumbnails: [],
  owner: { name: "o", ID: "o", canonicalURL: "" },
});

// Use a minimal state object; reducer only touches audioState here.
const baseState = {
  audioState: [] as Audio[],
  currentAudio: 0,
  audioLoading: false,
  audioPlaying: false,
  audioVolume: 0.4,
};

describe("AudioConfig ADD_ITEM dedupe", () => {
  it("adds a new audio", () => {
    const s = reducer(baseState, ADD_ITEM(makeAudio("a")));
    expect(s.audioState.map((x) => x.ID)).toEqual(["a"]);
  });

  it("does not add a duplicate ID", () => {
    const s1 = reducer(baseState, ADD_ITEM(makeAudio("a")));
    const s2 = reducer(s1, ADD_ITEM(makeAudio("a")));
    expect(s2.audioState.map((x) => x.ID)).toEqual(["a"]);
  });

  it("ignores a null/undefined payload", () => {
    const s = reducer(baseState, ADD_ITEM(undefined));
    expect(s.audioState).toEqual([]);
  });
});

describe("AudioConfig setAudioConfig dedupe", () => {
  it("dedupes an array payload by ID", () => {
    const s = reducer(
      baseState,
      setAudioConfig([makeAudio("a"), makeAudio("b"), makeAudio("a")])
    );
    expect(s.audioState.map((x) => x.ID)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run tests, confirm they FAIL**

Run: `npm test -- store/AudioConfig.test.ts`
Expected: the dedupe/null tests fail (current `ADD_ITEM` always appends).

- [ ] **Step 3: Implement dedupe in `store/AudioConfig.ts`**

Replace the `setAudioConfig` and `ADD_ITEM` reducers with:

```ts
    // Action to set the audio status
    setAudioConfig(state, action) {
      const payload = Array.isArray(action.payload)
        ? action.payload
        : [action.payload];
      const deduped: typeof state.audioState = [];
      for (const item of payload) {
        if (item && !deduped.some((a) => a.ID === item.ID)) {
          deduped.push(item);
        }
      }
      state.audioState = deduped;
      saveToLocalStorage(state);
    },

    DELETE_ARR(state) {
      state.audioState = [];
      saveToLocalStorage(state);
    },

    ADD_ITEM(state, action) {
      const item = action.payload;
      if (!item || state.audioState.some((a) => a.ID === item.ID)) {
        return; // ignore empty payloads and duplicates
      }
      state.audioState = [...state.audioState, item];
      saveToLocalStorage(state);
    },
```

- [ ] **Step 4: Run tests, confirm PASS**

Run: `npm test -- store/AudioConfig.test.ts`
Expected: all pass.

- [ ] **Step 5: Full gate + commit**

Run: `npm run typecheck && npm run lint && npm test`
```bash
git add store/AudioConfig.ts store/AudioConfig.test.ts
git commit -m "fix(player): dedupe songs by ID in ADD_ITEM/setAudioConfig

Prevents duplicate songs from stacking in the player (toDo #8).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Add-to-player feedback (dedupe-aware toasts)

**Files:**
- Modify: `sections/Hero.tsx` (the ADD_ITEM dispatch ~line 361)
- Modify: `components/player/UserAudioList.tsx` (`searchAudio`, ~line 105)
- Modify: `components/player/UserCollectionsList.tsx` (ADD_ITEM dispatch ~line 123)

Context: `ADD_ITEM` now silently ignores duplicates (Task 1). The UI should tell the user whether the song was added or already present. Since the reducer doesn't return status, decide in the component using the current `audioConfig` before dispatching. `sections/Hero.tsx` already imports `toast` and selects `audioConfig` via `selectAudioConfig`.

- [ ] **Step 1: `sections/Hero.tsx`** — replace the add button's onClick (the block dispatching `ADD_ITEM(audio)` then `toast("Audio add to player successfully", {})`, ~lines 360-364) with:

```tsx
                            onClick={() => {
                              const already = audioConfig.some(
                                (a: Audio) => a.ID === audio.ID
                              );
                              dispatch(ADD_ITEM(audio));
                              toast(
                                already
                                  ? "Already in your player"
                                  : "Added to player"
                              );
                            }}
```

- [ ] **Step 2: `components/player/UserCollectionsList.tsx`** — locate the `dispatch(ADD_ITEM(data[0]))` (~line 123). It runs after a search fetch. Wrap with a guard using the player state. This file already imports `toast`. Ensure it selects `audioConfig` (add `selectAudioConfig` to the `@/store/AudioConfig` import and `const audioConfig = useSelector(selectAudioConfig);` near the other selectors if not present). Then change the dispatch site to:

```ts
          const item = data[0];
          if (item) {
            const already = audioConfig.some((a: Audio) => a.ID === item.ID);
            dispatch(ADD_ITEM(item));
            toast(already ? "Already in your player" : "Added to player");
          }
```

- [ ] **Step 3: `components/player/UserAudioList.tsx`** — same treatment for the `dispatch(ADD_ITEM(data[0]))` at ~line 105. Add `selectAudioConfig` to the redux import and `const audioConfig = useSelector(selectAudioConfig);`, then:

```ts
          const item = data[0];
          if (item) {
            const already = audioConfig.some((a: Audio) => a.ID === item.ID);
            dispatch(ADD_ITEM(item));
            toast(already ? "Already in your player" : "Added to player");
          }
```

- [ ] **Step 4: Verify + commit**

Run: `npm run typecheck && npm run lint && npm test`
```bash
git add sections/Hero.tsx components/player/UserAudioList.tsx components/player/UserCollectionsList.tsx
git commit -m "feat(player): clear 'added / already in player' feedback on add (toDo #10)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Real loading state + unplayable-video handling

**Files:**
- Modify: `components/player/controls.tsx`

Context: `handleOnBuffer` currently does `dispatch(SET_LOADING(!AudioLoading))` — a toggle that desyncs. ReactPlayer exposes `onBuffer`, `onBufferEnd`, `onReady`, `onError`. `SET_LOADING` already exists in the store. Add `onError` handling to toast + skip.

- [ ] **Step 1: Add imports** at the top of `components/player/controls.tsx`

- Add `import { toast } from "sonner";`
- Ensure `SET_LOADING` and `SKIP_NEXT` are in the `@/store/AudioConfig` import (SET_LOADING and SKIP_NEXT already imported).

- [ ] **Step 2: Replace `handleOnBuffer`** with explicit start/end handlers:

```ts
  const handleBufferStart = () => {
    dispatch(SET_LOADING(true));
  };

  const handleBufferEnd = () => {
    dispatch(SET_LOADING(false));
  };

  const handleReady = () => {
    dispatch(SET_LOADING(false));
  };

  const handleError = () => {
    dispatch(SET_LOADING(false));
    toast("This video can't be played here — skipping.");
    // advance if there is a next track
    if (current + 1 < audioConfig.length) {
      skipAudio(1);
    } else {
      dispatch(SET_PLAYING(false));
    }
  };
```

- [ ] **Step 3: Wire the ReactPlayer callbacks.** In the `<ReactPlayer ... />` props, replace `onBuffer={() => handleOnBuffer()}` with:

```tsx
            onReady={handleReady}
            onBuffer={handleBufferStart}
            onBufferEnd={handleBufferEnd}
            onError={handleError}
```
(Keep the existing `onPlay`, `onPause`, `onEnded`, `onProgress`, `onDuration` props.)

- [ ] **Step 4: Show a spinner on the play button while loading.** In the play/pause `<Button>` (the one calling `handlePlayPause`), render a loading indicator when `AudioLoading` is true. Replace its inner `<span>` content:

```tsx
          <span className={` icon_clothes`}>
            {AudioLoading ? (
              <LoopIcon className="h-3 w-3 animate-spin" />
            ) : playing ? (
              <PauseIcon className="h-3 w-3 " />
            ) : (
              <PlayIcon className="h-3 w-3" />
            )}
          </span>
```
(`LoopIcon` is already imported from `@radix-ui/react-icons`; `animate-spin` is a Tailwind util available in this project.)

- [ ] **Step 5: Add a `<Toaster />` if not present.** Confirm a `<Toaster />` renders on the home screen. `sections/Hero.tsx` already renders one, and `controls.tsx` is used within that screen, so toasts will show. If, when testing, no toast appears, import `{ Toaster } from "@/components/ui/sonner"` and render `<Toaster />` once in `controls.tsx`. Otherwise leave as-is (avoid duplicate Toasters).

- [ ] **Step 6: Verify + commit**

Run: `npm run typecheck && npm run lint && npm test`
Manual (owner, real env): play a track → spinner shows while buffering, clears on play; a known-unplayable video toasts and skips.
```bash
git add components/player/controls.tsx
git commit -m "fix(player): real buffering spinner + skip unplayable videos (toDo #5, #11)

Replaces the SET_LOADING toggle with explicit buffer/ready transitions and
adds onError handling that toasts and advances to the next track.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Harden the search API

**Files:**
- Create: `lib/search/format.ts`, `lib/search/format.test.ts`, `lib/search/cache.ts`, `lib/search/cache.test.ts`
- Modify: `pages/api/searchEngine.ts`

Context: extract the pure, testable pieces (request validation, cache) out of the route so they can be unit-tested without hitting YouTube. Keep the scrape call in the route.

- [ ] **Step 1: Write failing tests** — `lib/search/cache.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { makeCacheKey, TtlCache } from "@/lib/search/cache";

describe("makeCacheKey", () => {
  it("is stable and normalizes case/space", () => {
    expect(makeCacheKey(" Hello ", 10)).toBe(makeCacheKey("hello", 10));
  });
  it("varies by quantity", () => {
    expect(makeCacheKey("x", 5)).not.toBe(makeCacheKey("x", 10));
  });
});

describe("TtlCache", () => {
  it("returns a stored value before expiry", () => {
    const c = new TtlCache<number>(1000);
    c.set("k", 1, 0);
    expect(c.get("k", 500)).toBe(1);
  });
  it("expires after the TTL", () => {
    const c = new TtlCache<number>(1000);
    c.set("k", 1, 0);
    expect(c.get("k", 1500)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Implement `lib/search/cache.ts`**

```ts
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
```

- [ ] **Step 3: Write failing tests** — `lib/search/format.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { validateSearchRequest, formatVideos } from "@/lib/search/format";

describe("validateSearchRequest", () => {
  it("rejects empty query", () => {
    expect(validateSearchRequest({ string: "  ", quantity: 10 }).ok).toBe(false);
  });
  it("accepts a valid query and clamps quantity", () => {
    const r = validateSearchRequest({ string: "lofi", quantity: 999 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.quantity).toBeLessThanOrEqual(50);
      expect(r.value.string).toBe("lofi");
    }
  });
  it("defaults quantity when missing", () => {
    const r = validateSearchRequest({ string: "lofi" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.quantity).toBeGreaterThan(0);
  });
});

describe("formatVideos", () => {
  it("maps raw results to Audio and skips incomplete entries", () => {
    const raw = [
      { type: "video", ID: "1", URL: "u1", title: "t1", thumbnails: [{ url: "a" }, { url: "b" }], owner: { name: "o", ID: "oid", canonicalURL: "c", thumbnails: [{ url: "p" }] }, duration: { number: 100 } },
      { type: "video", ID: "", URL: "", title: "" },
      { type: "channel", ID: "2" },
    ];
    const out = formatVideos(raw as any, 10);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ ID: "1", title: "t1", audioLengthSec: 100 });
  });
});
```

- [ ] **Step 4: Implement `lib/search/format.ts`**

```ts
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
```

- [ ] **Step 5: Run the new unit tests, confirm PASS**

Run: `npm test -- lib/search`
Expected: all pass.

- [ ] **Step 6: Rewrite `pages/api/searchEngine.ts`** to use the helpers, add timeout + cache + status codes:

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import type { Audio } from "@/constants/interfaces";
import { validateSearchRequest, formatVideos } from "@/lib/search/format";
import { makeCacheKey, TtlCache } from "@/lib/search/cache";
import youtube from "@fabricio-191/youtube";

const { search } = youtube.setDefaultOptions({
  language: "en",
  location: "US",
  quantity: "all",
  requestsOptions: {},
});

const CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_TIMEOUT_MS = 10_000;
const cache = new TtlCache<Audio[]>(CACHE_TTL_MS);

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

type SearchResponse = Audio[] | { message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SearchResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const validation = validateSearchRequest(req.body ?? {});
  if (!validation.ok) {
    return res.status(400).json({ message: validation.error });
  }
  const { string, quantity } = validation.value;
  const key = makeCacheKey(string, quantity);

  const cached = cache.get(key);
  if (cached) {
    return res.status(200).json(cached);
  }

  try {
    const data: any = await withTimeout(search(string), SEARCH_TIMEOUT_MS);
    const results = data?.results ?? [];
    const audios = formatVideos(results, quantity);
    if (audios.length === 0) {
      return res.status(404).json({ message: "No results found" });
    }
    cache.set(key, audios);
    return res.status(200).json(audios);
  } catch (error) {
    const message = (error as Error).message;
    if (message === "timeout") {
      return res.status(504).json({ message: "Search timed out, try again" });
    }
    console.error("Search error:", message);
    return res.status(502).json({ message: "Search is temporarily unavailable" });
  }
}
```

NOTE on the import: the package `@fabricio-191/youtube` was previously required via CommonJS. If `import youtube from "@fabricio-191/youtube"` does not expose `setDefaultOptions` at runtime (default vs namespace export), fall back to `import * as youtube from "@fabricio-191/youtube"` — verify by running the build and a manual search. Report which import form worked.

- [ ] **Step 7: Verify + commit**

Run: `npm run typecheck && npm run lint && npm test`
Then build with placeholder env (see Context notes) → confirm compiles.
```bash
git add lib/search/ pages/api/searchEngine.ts
git commit -m "fix(search): validate, cache, time out, and use proper status codes

Extracts testable validation/format/cache helpers; adds a 10s timeout,
5-min in-memory cache, and 400/404/502/504 responses. (toDo hardening)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Make the search client robust

**Files:**
- Modify: `sections/Hero.tsx` (`searchAudio`, ~lines 71-104)
- Modify: `components/player/UserAudioList.tsx` (`searchAudio`, ~lines 89-114)
- Modify: `components/player/UserCollectionsList.tsx` (the fetch, ~line 111)

Context: the API now returns `{ message }` with a non-2xx status on failure. Clients must check `res.ok` and never place an error object into the results list / player.

- [ ] **Step 1: `sections/Hero.tsx`** — replace the `.then((res) => res.json())...` chain in `searchAudio` with a version that checks `res.ok`:

```ts
      fetch("/api/searchEngine", {
        method: "POST",
        body: JSON.stringify({ string: `${inputValue}`, quantity: 10 }),
        headers: { "Content-Type": "application/json" },
      })
        .then(async (res) => {
          const body = await res.json();
          if (!res.ok) {
            throw new Error(body?.message || "Search failed");
          }
          return body as Audio[];
        })
        .then((data) => {
          setSearchedAudios(data);
          setLoading(false);
        })
        .catch((error) => {
          setSearchedAudios([]);
          setLoading(false);
          toast((error as Error).message || "Search failed");
        });
```

- [ ] **Step 2: `components/player/UserAudioList.tsx`** — update its `searchAudio` fetch the same way. On success dispatch `ADD_ITEM(data[0])` guarded (per Task 2 pattern); on failure `toast` and stop loading:

```ts
        .then(async (res) => {
          const body = await res.json();
          if (!res.ok) throw new Error(body?.message || "Search failed");
          return body as Audio[];
        })
        .then((data) => {
          const item = data[0];
          if (item) {
            const already = audioConfig.some((a: Audio) => a.ID === item.ID);
            dispatch(ADD_ITEM(item));
            toast(already ? "Already in your player" : "Added to player");
          }
          setLoading(false);
        })
        .catch((error) => {
          setLoading(false);
          toast((error as Error).message || "Could not load this track");
        });
```

- [ ] **Step 3: `components/player/UserCollectionsList.tsx`** — same `res.ok` guard on its fetch; on failure `toast` and stop loading. Preserve its existing success behavior (guarded ADD_ITEM from Task 2).

- [ ] **Step 4: Verify + commit**

Run: `npm run typecheck && npm run lint && npm test`
Manual (owner): a failing/empty search shows a toast instead of a broken list.
```bash
git add sections/Hero.tsx components/player/UserAudioList.tsx components/player/UserCollectionsList.tsx
git commit -m "fix(search): handle API errors gracefully on the client

Checks res.ok, never renders an error payload as results, toasts on failure.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: uid-keyed user model

**Files:**
- Create: `lib/user/ensureUserDoc.ts`, `lib/user/ensureUserDoc.test.ts`
- Modify: `context/AuthContext.tsx`

Context: adopt `doc(firestore, "users", uid)` as the user doc address. Keep the `{ userData: {...} }` body shape. `getUser`/`getProfileUser` become direct `getDoc`. `signup`/`signupPopup`/`signinPopup` create via `ensureUserDoc`. `user.docID` becomes `uid`.

- [ ] **Step 1: Write failing test** — `lib/user/ensureUserDoc.test.ts` (pure logic with injected Firestore ops)

```ts
import { describe, it, expect, vi } from "vitest";
import { ensureUserDoc } from "@/lib/user/ensureUserDoc";

const userData = (uid: string) => ({
  ID: uid,
  avatar: "",
  userName: "n",
  email: "e",
  marketingEmails: false,
  collections: [],
  lovedSongs: [],
  lovedCollections: [],
  followers: [],
  following: [],
});

describe("ensureUserDoc", () => {
  it("creates the doc when it does not exist", async () => {
    const getDoc = vi.fn().mockResolvedValue({ exists: () => false });
    const setDoc = vi.fn().mockResolvedValue(undefined);
    const result = await ensureUserDoc(
      { getDoc, setDoc, ref: {} as any },
      "uid-1",
      userData("uid-1")
    );
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(result.created).toBe(true);
  });

  it("does not create when the doc already exists", async () => {
    const existing = { userData: userData("uid-1") };
    const getDoc = vi
      .fn()
      .mockResolvedValue({ exists: () => true, data: () => existing });
    const setDoc = vi.fn();
    const result = await ensureUserDoc(
      { getDoc, setDoc, ref: {} as any },
      "uid-1",
      userData("uid-1")
    );
    expect(setDoc).not.toHaveBeenCalled();
    expect(result.created).toBe(false);
    expect(result.data).toEqual(existing.userData);
  });
});
```

- [ ] **Step 2: Implement `lib/user/ensureUserDoc.ts`** (framework-agnostic core so it's testable)

```ts
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
  uid: string,
  userData: Record<string, unknown>
): Promise<EnsureResult> {
  const snap = await ops.getDoc(ops.ref);
  if (snap.exists()) {
    return { created: false, data: snap.data?.().userData ?? null };
  }
  await ops.setDoc(ops.ref, { userData });
  return { created: true, data: userData };
}
```

- [ ] **Step 3: Run the test, confirm PASS**

Run: `npm test -- lib/user`

- [ ] **Step 4: Update `context/AuthContext.tsx` imports.** Ensure these Firestore fns are imported from `firebase/firestore`: `doc`, `getDoc`, `setDoc`, `updateDoc`, `collection`, `getDocs`, `query`, `where`, `runTransaction`, `arrayUnion`, `arrayRemove`, `increment`. Remove now-unused ones after the edits below. Import the helper: `import { ensureUserDoc } from "@/lib/user/ensureUserDoc";`.

- [ ] **Step 5: Replace `getUser`** (currently a `query`+`getDocs`) with a direct read:

```ts
  const getUser = async (uid: string) => {
    const ref = doc(firestore, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const d = snap.data().userData;
    setUser({
      ID: d.ID,
      docID: uid,
      avatar: d.avatar,
      userName: d.userName,
      email: d.email,
      marketingEmails: d.marketingEmails,
      lovedSongs: [...(d.lovedSongs ?? [])],
      collections: [...(d.collections ?? [])],
      lovedCollections: [...(d.lovedCollections ?? [])],
      followers: [...(d.followers ?? [])],
      following: [...(d.following ?? [])],
    });
  };
```

- [ ] **Step 6: Replace `getProfileUser`** with a direct read:

```ts
  async function getProfileUser(uid: string) {
    const ref = doc(firestore, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return {};
    const d = snap.data().userData;
    return {
      ID: d.ID,
      docID: uid,
      avatar: d.avatar,
      userName: d.userName,
      email: d.email,
      marketingEmails: d.marketingEmails,
      lovedSongs: [...(d.lovedSongs ?? [])],
      collections: [...(d.collections ?? [])],
      lovedCollections: [...(d.lovedCollections ?? [])],
      followers: [...(d.followers ?? [])],
      following: [...(d.following ?? [])],
    };
  }
```

- [ ] **Step 7: Rewrite `signup`** to key by uid (no more `addDoc`):

```ts
  const signup = (
    email: string,
    password: string,
    avatar: string,
    name: string,
    marketingEmails: Boolean
  ) => {
    return createUserWithEmailAndPassword(auth, email, password)
      .then(async (userCredential) => {
        const fbUser = userCredential.user;
        const userData = {
          ID: fbUser.uid,
          userName: fbUser.displayName ? fbUser.displayName : name,
          email: fbUser.email,
          avatar: avatar,
          marketingEmails: false,
          collections: [],
          lovedSongs: [],
          lovedCollections: [],
          followers: [],
          following: [],
        };
        const ref = doc(firestore, "users", fbUser.uid);
        await ensureUserDoc(
          { ref, getDoc, setDoc },
          fbUser.uid,
          userData
        );
        router.push(`/profile/${fbUser.uid}`);
      })
      .catch((error) => {
        throw new Error(error.code);
      });
  };
```

- [ ] **Step 8: Rewrite `signupPopup`** — route through `ensureUserDoc`, fix the shadowed `getAuth`, remove the dead commented block:

```ts
  const signupPopup = async (prov: string) => {
    const provider =
      prov === "facebook"
        ? new FacebookAuthProvider()
        : new GoogleAuthProvider();

    return signInWithPopup(auth, provider)
      .then(async (result) => {
        const fbUser = result.user;
        const userData = {
          ID: fbUser.uid,
          userName: fbUser.displayName,
          email: fbUser.email,
          avatar: fbUser.photoURL,
          marketingEmails: false,
          collections: [],
          lovedSongs: [],
          lovedCollections: [],
          followers: [],
          following: [],
        };
        const ref = doc(firestore, "users", fbUser.uid);
        await ensureUserDoc({ ref, getDoc, setDoc }, fbUser.uid, userData);
        router.push(`/profile/${fbUser.uid}`);
      })
      .catch((error) => {
        throw new Error(error.code);
      });
  };
```
(Note: the local `const auth = getAuth();` inside the old `signupPopup` is removed — it now uses the imported `auth`.)

- [ ] **Step 9: `signinPopup`** — after popup, load the user by uid (create-if-missing so a first-time Google sign-in via the "sign in" button also works):

```ts
  const signinPopup = async (prov: string) => {
    const provider =
      prov === "facebook"
        ? new FacebookAuthProvider()
        : new GoogleAuthProvider();
    return signInWithPopup(auth, provider)
      .then(async (userCredential) => {
        const fbUser = userCredential.user;
        const userData = {
          ID: fbUser.uid,
          userName: fbUser.displayName,
          email: fbUser.email,
          avatar: fbUser.photoURL,
          marketingEmails: false,
          collections: [],
          lovedSongs: [],
          lovedCollections: [],
          followers: [],
          following: [],
        };
        const ref = doc(firestore, "users", fbUser.uid);
        await ensureUserDoc({ ref, getDoc, setDoc }, fbUser.uid, userData);
        await getUser(fbUser.uid);
        router.push(`/profile/${fbUser.uid}`);
      })
      .catch((error) => {
        throw new Error(error.code);
      });
  };
```

- [ ] **Step 10: Remove now-dead imports.** If `addDoc`, `query`, `where`, `getDocs` are no longer used anywhere in the file (check `getUserCollections`, which still uses `query`/`where`/`getDocs` — KEEP those), leave the ones still used. Remove only genuinely unused imports. Run typecheck/lint to confirm.

- [ ] **Step 11: Verify + commit**

Run: `npm run typecheck && npm run lint && npm test`
Then build with placeholder env → compiles.
Manual (owner, real env): sign in with Google twice → one account; email signup → profile loads.
```bash
git add lib/user/ context/AuthContext.tsx
git commit -m "fix(auth): key user docs by Firebase uid to prevent duplicate accounts

Single ID model (the uid): ensureUserDoc create-if-missing for email + OAuth,
direct getDoc reads, docID = uid. Fixes the duplicate-account bug (toDo #9).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Atomic Firestore like/collection writes

**Files:**
- Modify: `context/AuthContext.tsx`

Context: eliminate whole-document rewrites and the in-place `col.likes` mutation. Use field-path updates with `arrayUnion`/`arrayRemove`/`increment`, and a transaction for the object-array `lovedSongs`.

- [ ] **Step 1: Rewrite `likeAudio` / `dislikeAudio`** using a transaction on the user doc (keyed by uid = `user.docID`):

```ts
  const likeAudio = async (audio: Audio) => {
    if (!user.ID) return;
    const ref = doc(firestore, "users", user.docID);
    try {
      await runTransaction(firestore, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const current: Audio[] = snap.data().userData?.lovedSongs ?? [];
        if (current.some((s) => s.ID === audio.ID)) return; // already loved
        tx.update(ref, { "userData.lovedSongs": [...current, audio] });
      });
      await getUser(user.ID);
    } catch (error) {
      console.error(error);
      throw new Error((error as Error).message);
    }
  };

  const dislikeAudio = async (audio: Audio) => {
    if (!user.ID) return;
    const ref = doc(firestore, "users", user.docID);
    try {
      await runTransaction(firestore, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const current: Audio[] = snap.data().userData?.lovedSongs ?? [];
        tx.update(ref, {
          "userData.lovedSongs": current.filter((s) => s.ID !== audio.ID),
        });
      });
      await getUser(user.ID);
    } catch (error) {
      console.error(error);
      throw new Error((error as Error).message);
    }
  };
```

- [ ] **Step 2: Rewrite `likeCollection` / `dislikeCollection`** to use `arrayUnion`/`arrayRemove` (user's `lovedCollections`, string IDs) and `increment` (collection `likes`):

```ts
  const likeCollection = async (col: Collection) => {
    if (user.ID) {
      const userRef = doc(firestore, "users", user.docID);
      try {
        await updateDoc(userRef, {
          "userData.lovedCollections": arrayUnion(col.ID),
        });
        await getUser(user.ID);
      } catch (error) {
        console.error(error);
        throw new Error((error as Error).message);
      }
    }
    if (col.ID) {
      try {
        const colRef = doc(firestore, "collections", col.ID);
        await updateDoc(colRef, { "collectionData.likes": increment(1) });
      } catch (error) {
        console.error("Error updating the collection:", error);
      }
    }
  };

  const dislikeCollection = async (col: Collection) => {
    if (user.ID) {
      const userRef = doc(firestore, "users", user.docID);
      try {
        await updateDoc(userRef, {
          "userData.lovedCollections": arrayRemove(col.ID),
        });
        await getUser(user.ID);
      } catch (error) {
        console.error(error);
        throw new Error((error as Error).message);
      }
    }
    if (col.ID) {
      try {
        const colRef = doc(firestore, "collections", col.ID);
        await updateDoc(colRef, { "collectionData.likes": increment(-1) });
      } catch (error) {
        console.error("Error updating the collection:", error);
      }
    }
  };
```

- [ ] **Step 3: Verify + commit**

Run: `npm run typecheck && npm run lint && npm test`
Build with placeholder env → compiles.
Manual (owner): like/unlike a song and a collection → persists; collection like counter increments/decrements correctly; rapid double-like doesn't corrupt the array.
```bash
git add context/AuthContext.tsx
git commit -m "fix(data): atomic Firestore writes for likes and collections

Transaction for lovedSongs, arrayUnion/arrayRemove for lovedCollections,
increment() for the collection likes counter. Fixes the in-place mutation
bug and read-modify-write races.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Metadata fix (App Router)

**Files:**
- Create: `app/providers.tsx`
- Modify: `app/layout.tsx`
- Delete: `app/head.tsx`

Context: `layout.tsx` is a Client Component, so it can't export `metadata`. Extract the client providers/chrome into `providers.tsx`, make `layout.tsx` a Server Component that exports `metadata` and renders `<Providers>`.

- [ ] **Step 1: Create `app/providers.tsx`** (client) — move the client bits out of layout:

```tsx
"use client";

import { ThemeProvider } from "next-themes";

// components
import Header from "@/components/Header";

// Firebase
import { AuthContextProvider } from "@/context/AuthContext";

// redux
import { store_0001 } from "../store/store";
import { Provider } from "react-redux";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Provider store={store_0001}>
      <AuthContextProvider>
        <ThemeProvider attribute="class">
          <Header />
          <main className={` relative w-full min-h-screen `}>{children}</main>
        </ThemeProvider>
      </AuthContextProvider>
    </Provider>
  );
}
```

- [ ] **Step 2: Rewrite `app/layout.tsx`** as a Server Component with metadata:

```tsx
import type { Metadata } from "next";

// styles
import "./globals.css";
import styles from "@/styles/index";

// providers (client)
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Yukirhythm",
  description:
    "Yukirhythm — a music and podcast player that finds and plays content from YouTube based on your searches.",
  icons: { icon: "/icon" },
  viewport: "width=device-width, initial-scale=1.0",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={` ${styles.flexStart} flex-col relative bg-background h-screen overflow-x-hidden`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```
NOTE: remove the old `"use client"`, `usePathname` (it was unused), the `<head />` element, and the commented-out `CursorFollower`/`SideBar`/`Footer` — they were already disabled. If `next build` warns that `viewport` in `metadata` is deprecated in favor of a separate `viewport` export, move it: `export const viewport = { width: "device-width", initialScale: 1 };`. Report which form you used.

- [ ] **Step 3: Delete the dead head file**

```bash
git rm app/head.tsx
```

- [ ] **Step 4: Verify + commit**

Run: `npm run typecheck && npm run lint && npm test`
Build with placeholder env → compiles. Manual: page `<title>` shows "Yukirhythm".
```bash
git add app/layout.tsx app/providers.tsx
git commit -m "fix(meta): use App Router Metadata API for title/description

Extracts client providers into app/providers.tsx so layout can be a Server
Component; deletes the dead app/head.tsx (removed Next 14 convention).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: One-time user migration script (owner-run)

**Files:**
- Create: `scripts/migrate-users-to-uid.ts`
- Modify: `package.json` (add `firebase-admin` devDep + a `migrate:users` script), `.env.example` (note the admin credential var)

Context: an operational tool the OWNER runs to move existing random-ID user docs to `doc(users, <uid>)`. Not part of the app bundle, not run in CI. Uses the Firebase Admin SDK with a service-account key referenced by `GOOGLE_APPLICATION_CREDENTIALS` (a path to a JSON key file the owner downloads; never committed).

- [ ] **Step 1: Add the dev dependency**

Run: `npm install --save-dev firebase-admin tsx`
(`tsx` runs the TypeScript script directly.)

- [ ] **Step 2: Create `scripts/migrate-users-to-uid.ts`**

```ts
/**
 * One-time migration: move each user doc from its random Firestore ID to a
 * document keyed by the user's Firebase Auth uid (userData.ID).
 *
 * SAFETY:
 *   1. BACK UP FIRESTORE FIRST (Firebase console → export, or
 *      `gcloud firestore export`). This script deletes old docs on --apply.
 *   2. Dry-run by default. Pass --apply to write.
 *   3. Idempotent: docs already keyed by uid are skipped.
 *
 * Auth: set GOOGLE_APPLICATION_CREDENTIALS to the path of a service-account
 * JSON key (Firebase console → Project settings → Service accounts →
 * Generate new private key). Do NOT commit that file.
 *
 * Run:
 *   Dry-run: npm run migrate:users
 *   Apply:   npm run migrate:users -- --apply
 */
import admin from "firebase-admin";

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

const APPLY = process.argv.includes("--apply");

function completeness(userData: any): number {
  if (!userData) return -1;
  const fields = [
    "avatar",
    "userName",
    "email",
    "lovedSongs",
    "collections",
    "lovedCollections",
    "followers",
    "following",
  ];
  return fields.reduce((n, f) => {
    const v = userData[f];
    const filled = Array.isArray(v) ? v.length > 0 : Boolean(v);
    return n + (filled ? 1 : 0);
  }, 0);
}

async function main() {
  console.log(
    `\n=== User migration (${APPLY ? "APPLY" : "DRY-RUN"}) ===\n` +
      (APPLY
        ? "WRITING changes. Make sure you exported Firestore first.\n"
        : "No changes will be written. Re-run with --apply to migrate.\n")
  );

  const snap = await db.collection("users").get();
  const byUid = new Map<string, { id: string; data: any }[]>();

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const uid = data?.userData?.ID;
    if (!uid) {
      console.warn(`SKIP ${docSnap.id}: no userData.ID`);
      return;
    }
    const list = byUid.get(uid) ?? [];
    list.push({ id: docSnap.id, data });
    byUid.set(uid, list);
  });

  let toMigrate = 0;
  let duplicates = 0;
  let alreadyOk = 0;

  for (const [uid, docs] of byUid) {
    const alreadyKeyed = docs.find((d) => d.id === uid);
    // choose the most complete record as the winner
    const winner = docs
      .slice()
      .sort(
        (a, b) => completeness(b.data.userData) - completeness(a.data.userData)
      )[0];

    if (docs.length > 1) {
      duplicates++;
      console.log(
        `DUP  uid=${uid}: ${docs.length} docs [${docs
          .map((d) => d.id)
          .join(", ")}] → keep ${winner.id}`
      );
    }

    if (alreadyKeyed && docs.length === 1) {
      alreadyOk++;
      continue; // idempotent: nothing to do
    }

    toMigrate++;
    console.log(`MOVE uid=${uid}: winner ${winner.id} → users/${uid}`);

    if (APPLY) {
      await db.collection("users").doc(uid).set(winner.data);
      for (const d of docs) {
        if (d.id !== uid) {
          await db.collection("users").doc(d.id).delete();
        }
      }
    }
  }

  console.log(
    `\nSummary: ${byUid.size} users | migrate ${toMigrate} | duplicates ${duplicates} | already-ok ${alreadyOk}`
  );
  if (!APPLY) console.log("Dry-run only. Re-run with --apply to write.\n");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
```

- [ ] **Step 3: Add the npm script** to `package.json` `"scripts"`:

```json
    "migrate:users": "tsx scripts/migrate-users-to-uid.ts"
```

- [ ] **Step 4: Document the credential in `.env.example`** (append):

```bash
# Migration only (scripts/migrate-users-to-uid.ts). Path to a Firebase
# service-account JSON key. NEVER commit the key file itself.
GOOGLE_APPLICATION_CREDENTIALS=
```

- [ ] **Step 5: Verify it typechecks and does NOT run in CI.** Confirm `scripts/` is not imported by app code and that the script is excluded from the Next build (it is, being outside `app`/`pages` and not imported). Run `npm run typecheck` — if `firebase-admin` types conflict with the app's `tsconfig`, and the script trips typecheck, add `scripts` is already covered by `**/*.ts`; if needed, ensure the script compiles standalone. Report any type friction rather than loosening app types.

- [ ] **Step 6: Commit** (do NOT run the migration here — it's owner-run against real data)

```bash
git add scripts/migrate-users-to-uid.ts package.json package-lock.json .env.example
git commit -m "chore(migration): add owner-run uid-keying migration script

Dry-run-first, idempotent, backup-first migration of existing user docs to
doc(users, uid). Not run in CI; requires a service-account key.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Definition of Done

- [ ] All gates green: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` (placeholder env), and CI.
- [ ] New unit tests cover: player dedupe, search validation/format/cache, `ensureUserDoc`.
- [ ] A Google user signing in twice creates exactly ONE account (uid-keyed).
- [ ] Likes/collections persist via atomic writes; collection like-count is correct; no in-place mutation.
- [ ] Duplicate songs cannot stack in the player; the user gets clear add feedback.
- [ ] Buffering shows a spinner; unplayable videos toast and skip.
- [ ] Search failures toast gracefully; the API returns correct status codes.
- [ ] Page title/description apply via the Metadata API; `app/head.tsx` gone.
- [ ] Migration script present, dry-run documented; NOT executed by us.
- [ ] No dependency majors changed; user-doc body shape unchanged.

---

## Self-review notes (author)

- **Spec coverage:** A→Task 6; B→Task 7; C→Tasks 1-3; D→Tasks 4-5 (durations already shipped in `Hero.tsx:345`, so dropped); E→Task 8; F→Task 9. ✅
- **Placeholder scan:** every code step has real code; no TBDs. ✅
- **Type/name consistency:** `ensureUserDoc({ ref, getDoc, setDoc }, uid, userData)` signature is used identically in Tasks 6/7; `user.docID` = uid so like-writes in Task 7 address the right doc. ✅
- **Non-goals honored:** no dep upgrades; doc body shape unchanged; Redux untangle left for Phase 2. ✅
- **Risk note:** Task 6 changes live read/write paths — covered by the DoD manual smoke and by keeping the body shape stable; existing users are read by `getDoc(doc(users, uid))` which only works after their doc is uid-keyed → **the migration (Task 9) must be run by the owner for existing users to load.** New users work immediately. This dependency is called out in the spec and here.
