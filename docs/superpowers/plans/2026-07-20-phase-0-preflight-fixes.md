# Phase 0 — Pre-flight Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or
> superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix eight real defects in the design-system screens that need no backend, so phases 1–7
build on correct UI instead of inheriting bugs.

**Architecture:** Pure UI and pure-function fixes. No Firestore, no API, no new dependencies.
Every change is covered by a colocated Vitest test.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Testing Library.

**Roadmap:** `docs/superpowers/plans/2026-07-20-backend-roadmap.md` (§10 ledger rows 1–8)

---

## Verified state as of 2026-07-20

The roadmap ledger was written before the most recent screen work. Re-verified against the
working tree:

| Ledger row | Status |
|---|---|
| 1 `searchMockCollections` | **still broken** — reads the `MOCK_COLLECTIONS` constant |
| 2 `seek` unclamped | **still broken** — `Math.max(0, …)` only |
| 3 DiscDeck comma-joined signal | **still broken** — `DiscDeck.tsx:90` |
| 4 AddMusicPanel dead play button | **still broken** — no `playable` prop |
| 5 Search nested interactives | **still broken** — the `playable={false}` in that file is on the MediaCard below, not the TrackRow |
| 6 Recents drops `collectionId` | **still broken** |
| 7 `createCollection` id collision | **still broken** |
| 8 Sign-out inconsistency | **still broken** |
| 9 Delete dead components | **revised** — only `AddMusicDrawer` is unimported. `QueueDrawer`, `PlaylistDrawer`, `CreatePlaylistDrawer`, and `CreatePlaylistForm` are imported by the design-system docs gallery and are **not** dead. Do not delete them. |
| 18–20 TrackMenu Like / Add / Share | **already closed** — real dialogs now exist |
| 21 Library pin | **already closed** — `CollectionMenu` calls `togglePin` |

Conventions: tests colocated as `foo.test.ts(x)`. Run one file with
`npm test --workspace apps/web -- <path>`. Everything with `npm test`. Commit per task.

---

## Task 1: `searchMockCollections` reads live collections

Today it filters the `MOCK_COLLECTIONS` module constant, so Liked Songs and every collection the
create wizard makes are structurally invisible to search — no matter what the user types.

**Files:**
- Modify: `apps/web/components/studio/screens/mock-data.ts`
- Modify: `apps/web/components/studio/screens/mock-data.test.ts`
- Modify: `apps/web/app/design-system/screens/(app)/search/page.tsx`

- [ ] **Step 1: Write the failing test**

Append to `apps/web/components/studio/screens/mock-data.test.ts`:

```ts
describe("searchMockCollections", () => {
  const extra: MockCollection = {
    id: "local-x",
    title: "Rainy Tapes",
    desc: "",
    texture: "tx-k-silk",
    trackIds: [],
    likes: 0,
    tags: ["rain"],
    kind: "music",
    pinned: false,
  };

  it("searches the collections it is given, not a module constant", () => {
    const hits = searchMockCollections("rainy", [extra]);
    expect(hits.map((c) => c.id)).toEqual(["local-x"]);
  });

  it("matches on tags as well as title", () => {
    expect(searchMockCollections("rain", [extra])).toHaveLength(1);
  });

  it("returns nothing for an empty query", () => {
    expect(searchMockCollections("   ", [extra])).toEqual([]);
  });

  it("finds Liked Songs, which the old constant-based search could never reach", () => {
    const hits = searchMockCollections("liked", [LIKED_SONGS, ...MOCK_COLLECTIONS]);
    expect(hits.some((c) => c.id === LIKED_SONGS_ID)).toBe(true);
  });
});
```

Ensure the file's imports include `MockCollection`, `LIKED_SONGS`, `LIKED_SONGS_ID`, and
`MOCK_COLLECTIONS`.

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test --workspace apps/web -- components/studio/screens/mock-data.test.ts`
Expected: FAIL — `Expected 1 arguments, but got 2` or an empty result array.

- [ ] **Step 3: Change the signature**

In `mock-data.ts`, replace `searchMockCollections`:

```ts
/**
 * Searches the collections passed in — never a module constant. The caller
 * holds live provider state, which is the only place Liked Songs and
 * user-created collections exist.
 */
export function searchMockCollections(
  query: string,
  collections: MockCollection[]
): MockCollection[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return collections.filter(
    (c) =>
      c.title.toLowerCase().includes(q) ||
      c.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}
```

- [ ] **Step 4: Update the caller**

In `app/design-system/screens/(app)/search/page.tsx`, add `collections` to the
`useMockStudio()` destructure, then change:

```ts
const collectionHits = q.trim() ? searchMockCollections(q, collections) : [];
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test --workspace apps/web -- components/studio/screens/mock-data.test.ts && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/studio/screens/mock-data.ts apps/web/components/studio/screens/mock-data.test.ts "apps/web/app/design-system/screens/(app)/search/page.tsx"
git commit -m "fix(screens): search the live collections, not the seed constant"
```

---

## Task 2: Clamp `seek` to the track length

`seek` clamps the lower bound only. Seeking past `durationSec` immediately trips the
auto-advance effect, so the last seconds of a track cannot be scrubbed to.

**Files:**
- Modify: `apps/web/components/studio/screens/MockStudioProvider.tsx`
- Modify: `apps/web/components/studio/screens/MockStudioProvider.test.tsx`

- [ ] **Step 1: Write the failing test**

Append a case to the provider test:

```ts
it("clamps seek to the track length instead of auto-advancing", () => {
  const { result } = renderHook(() => useMockStudio(), { wrapper });
  act(() => result.current.play(MOCK_TRACKS[0]));
  act(() => vi.advanceTimersByTime(700));      // clear the 650ms load

  act(() => result.current.seek(999_999));

  expect(result.current.progressSec).toBe(MOCK_TRACKS[0].durationSec);
  expect(result.current.nowPlaying?.id).toBe(MOCK_TRACKS[0].id);
});

it("clamps a negative seek to zero", () => {
  const { result } = renderHook(() => useMockStudio(), { wrapper });
  act(() => result.current.play(MOCK_TRACKS[0]));
  act(() => vi.advanceTimersByTime(700));
  act(() => result.current.seek(-50));
  expect(result.current.progressSec).toBe(0);
});
```

Match the existing file's `wrapper` and fake-timer setup rather than inventing new ones.

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test --workspace apps/web -- components/studio/screens/MockStudioProvider.test.tsx`
Expected: FAIL — `progressSec` is `999999`, and `nowPlaying` has advanced to the next track.

- [ ] **Step 3: Clamp both ends**

```ts
/**
 * Clamped at both ends. Without the upper bound, seeking past the end sets a
 * progress value beyond durationSec, which the auto-advance effect reads as
 * "finished" and skips the track — so the final seconds were unreachable.
 */
const seek = useCallback(
  (sec: number) => {
    const max = nowPlaying?.durationSec ?? 0;
    setProgressSec(Math.min(max, Math.max(0, Math.floor(sec))));
  },
  [nowPlaying]
);
```

`seek` must be declared after `nowPlaying`. If it currently sits above, move it down —
do not add a ref.

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm test --workspace apps/web -- components/studio/screens/MockStudioProvider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/studio/screens/MockStudioProvider.tsx apps/web/components/studio/screens/MockStudioProvider.test.tsx
git commit -m "fix(player): clamp seek to the track length"
```

---

## Task 3: Split the DiscDeck signal attribute

`DiscDeck.tsx:90` emits `data-signal="disc_next, disc_prev"` — two event names in one attribute.
Any ingest reading `dataset.signal` gets the literal string `"disc_next, disc_prev"`, which
matches no known event.

**Files:**
- Modify: `apps/web/components/studio/DiscDeck.tsx`
- Create: `apps/web/components/studio/DiscDeck.test.tsx`

- [ ] **Step 1: Read the component first**

Read `apps/web/components/studio/DiscDeck.tsx` around lines 40–100 to see which element carries
the attribute and whether prev/next are distinct elements or one control.

- [ ] **Step 2: Write the failing test**

Create `apps/web/components/studio/DiscDeck.test.tsx`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "DiscDeck.tsx"), "utf8");

describe("DiscDeck signals", () => {
  it("never puts two event names in one data-signal attribute", () => {
    const matches = source.match(/data-signal="([^"]*)"/g) ?? [];
    for (const m of matches) {
      expect(m).not.toContain(",");
    }
  });

  it("still declares the disc navigation signals", () => {
    expect(source).toContain('data-signal="disc_next"');
    expect(source).toContain('data-signal="disc_prev"');
  });
});
```

A source-level assertion is right here: the defect is in the emitted attribute, and the
component needs a WebGL context to render.

- [ ] **Step 3: Run it, verify it fails**

Run: `npm test --workspace apps/web -- components/studio/DiscDeck.test.tsx`
Expected: FAIL — the comma assertion trips on `"disc_next, disc_prev"`.

- [ ] **Step 4: Split the attribute**

Put `data-signal="disc_prev"` on the element that moves backwards and
`data-signal="disc_next"` on the one that moves forwards. If a single element handles both
directions, give it `data-signal="disc_next"` and add `data-signal="disc_prev"` to the
backwards affordance; if no separate affordance exists, set the attribute dynamically from the
direction the interaction resolved to. Update the `Signals:` doc comment at line 44 to list them
separately.

- [ ] **Step 5: Run the test, verify it passes**

Run: `npm test --workspace apps/web -- components/studio/DiscDeck.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/studio/DiscDeck.tsx apps/web/components/studio/DiscDeck.test.tsx
git commit -m "fix(deck): emit disc_next and disc_prev as separate signals"
```

---

## Task 4: Remove the dead play buttons

`TrackRow`'s `playable` prop defaults to `true`, rendering a hover play button. Two surfaces get
one with nothing behind it: `AddMusicPanel` rows have no click handler at all, and Search results
nest the button inside a `role="button"` div — the exact nesting `TrackRow`'s own docstring warns
against.

**Files:**
- Modify: `apps/web/components/studio/screens/AddMusicPanel.tsx`
- Modify: `apps/web/app/design-system/screens/(app)/search/page.tsx`
- Modify: `apps/web/components/studio/screens/AddMusicPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `AddMusicPanel.test.tsx`:

```ts
it("renders no play button — these rows only add, they do not play", async () => {
  render(<AddMusicPanel collection={collection} />, { wrapper });
  await userEvent.type(screen.getByLabelText("Search tracks to add"), "a");

  expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument();
});
```

Reuse the file's existing `wrapper` and `collection` fixtures.

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test --workspace apps/web -- components/studio/screens/AddMusicPanel.test.tsx`
Expected: FAIL — a Play button is found.

- [ ] **Step 3: Pass `playable={false}` on both surfaces**

In `AddMusicPanel.tsx`, on the `TrackRow` inside the results list:

```tsx
{/* No play affordance: this row's only action is adding. */}
<TrackRow
  index={i + 1}
  title={track.title}
  artist={track.artist}
  duration={formatDuration(track.durationSec)}
  texture={track.texture}
  playable={false}
/>
```

In `search/page.tsx`, on the `TrackRow` inside the Tracks results section (the wrapper div
already handles the click):

```tsx
{/* The wrapping div is the button; an overlay would nest one inside it. */}
<TrackRow
  index={i + 1}
  title={track.title}
  artist={track.artist}
  duration={formatDuration(track.durationSec)}
  texture={track.texture}
  playing={nowPlaying?.id === track.id && isPlaying}
  playable={false}
/>
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm test --workspace apps/web -- components/studio/screens/AddMusicPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/studio/screens/AddMusicPanel.tsx apps/web/components/studio/screens/AddMusicPanel.test.tsx "apps/web/app/design-system/screens/(app)/search/page.tsx"
git commit -m "fix(screens): drop play buttons that do nothing"
```

---

## Task 5: Recents keeps its collection provenance

Recents renders `"— from {collection.title}"` on every row, then calls `play(track)` without the
collection — so playing from history discards the very provenance the row just displayed, and
the queue falls back to the whole library.

**Files:**
- Modify: `apps/web/app/design-system/screens/(app)/profile/recents/page.tsx`
- Create: `apps/web/app/design-system/screens/(app)/profile/recents/page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const play = vi.fn();
vi.mock("@/components/studio/screens/MockStudioProvider", async (orig) => ({
  ...(await orig<typeof import("@/components/studio/screens/MockStudioProvider")>()),
  useMockStudio: () => ({
    user: { id: "u1", userName: "Y", email: "e", initials: "Y", followers: 0, following: 0 },
    collections: MOCK_COLLECTIONS,
    play,
    nowPlaying: null,
    isPlaying: false,
  }),
}));

import { MOCK_COLLECTIONS, MOCK_HISTORY, getTrack } from "@/components/studio/screens/mock-data";
import RecentsPage from "./page";

describe("Recents", () => {
  it("plays from the collection the row says it came from", async () => {
    const entry = MOCK_HISTORY[0];
    const track = getTrack(entry.trackId)!;
    render(<RecentsPage />);

    await userEvent.click(screen.getAllByLabelText(`Play ${track.title}`)[0]);

    expect(play).toHaveBeenCalledWith(
      track,
      MOCK_COLLECTIONS.find((c) => c.id === entry.collectionId)
    );
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test --workspace apps/web -- "app/design-system/screens/(app)/profile/recents/page.test.tsx"`
Expected: FAIL — `play` was called with one argument.

- [ ] **Step 3: Pass the source collection**

The page already resolves `source` for the provenance label. Pass it to `play`:

```tsx
onClick={() => play(track, source)}
onKeyDown={playKeyHandler(() => play(track, source))}
```

`source` may be `undefined` when the collection was deleted; `play`'s second parameter is
already optional, so that case degrades to the library queue exactly as before.

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm test --workspace apps/web -- "app/design-system/screens/(app)/profile/recents/page.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/design-system/screens/(app)/profile/recents"
git commit -m "fix(recents): play from the collection the row came from"
```

---

## Task 6: Collision-free collection ids

`local-${collections.length + 1}` collides as soon as anything is removed: delete one of three
and the next create reuses an existing id, so two collections share an id and routes resolve to
the wrong one.

**Files:**
- Modify: `apps/web/components/studio/screens/MockStudioProvider.tsx`
- Modify: `apps/web/components/studio/screens/MockStudioProvider.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
it("issues unique ids even when the collection count repeats", () => {
  const { result } = renderHook(() => useMockStudio(), { wrapper });

  let a = "";
  let b = "";
  act(() => {
    a = result.current.createCollection({ title: "A", desc: "", tags: [], kind: "music" }).id;
  });
  act(() => {
    b = result.current.createCollection({ title: "B", desc: "", tags: [], kind: "music" }).id;
  });

  expect(a).not.toBe(b);
  const ids = result.current.collections.map((c) => c.id);
  expect(new Set(ids).size).toBe(ids.length);
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test --workspace apps/web -- components/studio/screens/MockStudioProvider.test.tsx`
Expected: this specific case may pass on a fresh provider — the collision needs a removal, which
has no UI yet. Keep the uniqueness assertion; it locks the invariant before phase 2 adds delete.

- [ ] **Step 3: Use a real unique id**

```ts
// Counting collections reuses ids after any removal, which phase 2 introduces.
// Server-issued ids replace this entirely then.
id: `local-${crypto.randomUUID()}`,
```

Drop `collections.length` from the `useCallback` dependency array, leaving `[collections]` or
`[]` as the remaining body requires. Verify the closure still returns the created object
synchronously — that behaviour is deliberate and documented in the existing comment.

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm test --workspace apps/web -- components/studio/screens/MockStudioProvider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/studio/screens/MockStudioProvider.tsx apps/web/components/studio/screens/MockStudioProvider.test.tsx
git commit -m "fix(library): issue collision-free collection ids"
```

---

## Task 7: One sign-out behaviour

Settings signs out, toasts, and redirects to `/auth`. The header dropdown signs out silently and
leaves the user on a page that now renders its signed-out state. Same action, two outcomes.

**Files:**
- Create: `apps/web/components/studio/screens/useSignOut.ts`
- Modify: `apps/web/app/design-system/screens/(app)/profile/settings/page.tsx`
- Modify: `apps/web/components/studio/shell/StudioHeader.tsx`
- Create: `apps/web/components/studio/screens/useSignOut.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const signOut = vi.fn();
const push = vi.fn();
const toast = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("sonner", () => ({ toast }));
vi.mock("./MockStudioProvider", () => ({ useMockStudio: () => ({ signOut }) }));

import { useSignOut } from "./useSignOut";
import { AUTH } from "@/components/studio/shell/routes";

describe("useSignOut", () => {
  beforeEach(() => {
    signOut.mockReset();
    push.mockReset();
    toast.mockReset();
  });

  it("clears the session, confirms, and lands on auth", () => {
    const { result } = renderHook(() => useSignOut());
    act(() => result.current());

    expect(signOut).toHaveBeenCalledOnce();
    expect(toast).toHaveBeenCalledWith("Signed out");
    expect(push).toHaveBeenCalledWith(AUTH);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test --workspace apps/web -- components/studio/screens/useSignOut.test.ts`
Expected: FAIL — cannot resolve `./useSignOut`.

- [ ] **Step 3: Write the hook**

Create `apps/web/components/studio/screens/useSignOut.ts`:

```ts
"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AUTH } from "@/components/studio/shell/routes";
import { useMockStudio } from "./MockStudioProvider";

/**
 * The single sign-out path. Both entry points previously did different things:
 * Settings toasted and redirected, the header dropdown did neither and left
 * the user on a page that silently became its signed-out state.
 */
export function useSignOut(): () => void {
  const { signOut } = useMockStudio();
  const router = useRouter();

  return useCallback(() => {
    signOut();
    toast("Signed out");
    router.push(AUTH);
  }, [signOut, router]);
}
```

- [ ] **Step 4: Use it in both places**

In `settings/page.tsx`, replace the inline handler with `const handleSignOut = useSignOut();`
and `onClick={handleSignOut}`. Drop the now-unused `signOut`, `toast`, and `router` imports if
nothing else in the file needs them.

In `StudioHeader.tsx`, replace `onSelect={() => signOut()}` with
`onSelect={() => handleSignOut()}` backed by the same hook.

- [ ] **Step 5: Run the full suite**

Run: `npm test --workspace apps/web && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/studio/screens/useSignOut.ts apps/web/components/studio/screens/useSignOut.test.ts apps/web/components/studio/shell/StudioHeader.tsx "apps/web/app/design-system/screens/(app)/profile/settings/page.tsx"
git commit -m "fix(auth): one sign-out path for both entry points"
```

---

## Task 8: Delete the unreferenced drawer

**Only `AddMusicDrawer` has no importer.** `QueueDrawer`, `PlaylistDrawer`,
`CreatePlaylistDrawer`, and `CreatePlaylistForm` are imported by the design-system docs gallery —
they document real components and must stay. The roadmap's original instruction to delete all
five was based on app-flow usage alone and is wrong.

**Files:**
- Delete: `apps/web/components/studio/screens/AddMusicDrawer.tsx`

- [ ] **Step 1: Confirm it is still unimported**

```bash
cd apps/web && grep -rn "AddMusicDrawer" --include=*.tsx --include=*.ts . | grep -v node_modules | grep -v "AddMusicDrawer.tsx"
```
Expected: no output. **If anything is returned, stop and do not delete.**

- [ ] **Step 2: Delete it**

```bash
git rm apps/web/components/studio/screens/AddMusicDrawer.tsx
```

- [ ] **Step 3: Verify the build**

Run: `npm run typecheck && npm test && npm run build`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(screens): drop the unreferenced AddMusicDrawer"
```

---

## Verification

- [ ] `npm run typecheck && npm run lint && npm test && npm run build` all pass
- [ ] Search for a user-created playlist by title — it appears under Collections (was impossible)
- [ ] Drag the seek slider to the far right — playback pins to the end instead of skipping
- [ ] Search results and the add-music panel show no play button on hover
- [ ] Play a row in Recents — the queue is the source collection, not the whole library
- [ ] Sign out from Settings and from the header avatar — identical toast and redirect
- [ ] No `data-signal` attribute anywhere contains a comma:
      `grep -rn 'data-signal="[^"]*,' apps/web --include=*.tsx` returns nothing
- [ ] Update roadmap §10: mark rows 1–8 closed, and rows 18–21 closed by earlier work
