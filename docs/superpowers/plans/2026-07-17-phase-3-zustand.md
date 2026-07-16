# Phase 3 — Redux → Zustand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Redux with one typed Zustand store, kill the SSR `localStorage` crash, preserve every user's saved play queue, and delete the last 3 Redux packages — with **zero behavior change**.

**Architecture:** Build the new store (TDD) → hydrate it client-side → migrate the 5 consumers **one per task, gating after each** → then delete Redux. The store lands first and Redux stays working until the last consumer is off it, so the app is never half-migrated.

**Tech Stack:** Next.js 14 App Router, React 18, Zustand (+ `persist`), Vitest, `apps/web` in an npm-workspaces monorepo.

**Working branch:** `v2_2026` — commit directly to it, do NOT create a new branch.

**Context for the engineer:**
- Gates run from the **repo root** (`D:\Dev\YukiRythem\Yukirhythm`):
  ```bash
  npm run lint && npm run typecheck && npm test && npm run build
  ```
  All must pass. `typecheck` now enforces `noUnusedLocals`/`noUnusedParameters` — **remove imports as you remove usages** or it fails.
- ⚠️ **Do NOT run `format:check` locally** (Windows CRLF false-positives). **Do NOT run a format pass.** CI is the source of truth.
- The real `.env` is at `apps/web/.env` (gitignored) so `npm run build` works.
- `npm install` runs from the **ROOT** (workspaces; lockfile is at the root).
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **`store/UIConfig.ts` is dead** — nothing outside `store/` imports it. It gets deleted in Task 7, not migrated.
- **Do NOT change player behavior.** Notably `ListDrawer.handleDelete` calls `SKIP_NEXT(0)` — an intentional no-op (deleting the playing first track leaves `current` at 0, which then points at the new first track). Preserve it as `skipNext(0)`. Do not "fix" it.

### Action name mapping (use consistently everywhere)

| Redux | Zustand |
|---|---|
| `setAudioConfig(payload)` | `setQueue(payload)` |
| `ADD_ITEM(item)` | `addItem(item)` |
| `DELETE_ITEM(id)` | `deleteItem(id)` |
| `DELETE_ARR()` | `clearQueue()` |
| `SKIP_NEXT(n)` | `skipNext(n)` |
| `SKIP_PREV(n)` | `skipPrev(n)` |
| `SET_LOADING(v)` | `setLoading(v)` |
| `SET_PLAYING(v)` | `setPlaying(v)` |
| `SET_VOLUME(v)` | `setVolume(v)` |
| `SET_CURRENT(n)` | `setCurrent(n)` |
| `useSelector(selectAudioConfig)` | `usePlayerStore((s) => s.audioState)` |
| `useSelector(selectCurrentAudio)` | `usePlayerStore((s) => s.currentAudio)` |
| `useSelector(selectAudioPlaying)` | `usePlayerStore((s) => s.audioPlaying)` |
| `useSelector(selectAudioLoading)` | `usePlayerStore((s) => s.audioLoading)` |
| `useSelector(selectAudioVolume)` | `usePlayerStore((s) => s.audioVolume)` |

---

## Task 1: Build the Zustand store (TDD)

**Files:** create `apps/web/store/player.ts`, `apps/web/store/player.test.ts`; modify root `package.json`/lockfile.

- [ ] **Step 1: Install Zustand**

```bash
cd D:\Dev\YukiRythem\Yukirhythm
npm install zustand --workspace apps/web
```
Expected: Zustand v5 (React 18 compatible). Report the installed version. Do NOT upgrade anything else.

- [ ] **Step 2: Write the failing tests** — `apps/web/store/player.test.ts`

These port the Phase 1 dedupe contract. They MUST keep passing — they're the proof the duplicate-songs fix survives.

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { importLegacyQueue, usePlayerStore } from "@/store/player";
import type { Audio } from "@/constants/interfaces";

const makeAudio = (id: string): Audio => ({
  ID: id,
  URL: `https://youtu.be/${id}`,
  title: `t-${id}`,
  thumbnails: [],
  owner: { name: "o", ID: "o", canonicalURL: "" },
});

const reset = () =>
  usePlayerStore.setState({
    audioState: [],
    currentAudio: 0,
    audioLoading: false,
    audioPlaying: false,
    audioVolume: 0.4,
  });

describe("player store — queue", () => {
  beforeEach(reset);

  it("adds a new audio", () => {
    usePlayerStore.getState().addItem(makeAudio("a"));
    expect(usePlayerStore.getState().audioState.map((x) => x.ID)).toEqual(["a"]);
  });

  it("does not add a duplicate ID", () => {
    usePlayerStore.getState().addItem(makeAudio("a"));
    usePlayerStore.getState().addItem(makeAudio("a"));
    expect(usePlayerStore.getState().audioState.map((x) => x.ID)).toEqual(["a"]);
  });

  it("ignores an empty payload", () => {
    usePlayerStore.getState().addItem(undefined as unknown as Audio);
    expect(usePlayerStore.getState().audioState).toEqual([]);
  });

  it("dedupes an array passed to setQueue", () => {
    usePlayerStore
      .getState()
      .setQueue([makeAudio("a"), makeAudio("b"), makeAudio("a")]);
    expect(usePlayerStore.getState().audioState.map((x) => x.ID)).toEqual([
      "a",
      "b",
    ]);
  });

  it("wraps a single object passed to setQueue", () => {
    usePlayerStore.getState().setQueue(makeAudio("a"));
    expect(usePlayerStore.getState().audioState.map((x) => x.ID)).toEqual(["a"]);
  });

  it("deletes by ID and clears the queue", () => {
    usePlayerStore.getState().setQueue([makeAudio("a"), makeAudio("b")]);
    usePlayerStore.getState().deleteItem("a");
    expect(usePlayerStore.getState().audioState.map((x) => x.ID)).toEqual(["b"]);
    usePlayerStore.getState().clearQueue();
    expect(usePlayerStore.getState().audioState).toEqual([]);
  });
});

describe("player store — transport", () => {
  beforeEach(reset);

  it("skips forward and back additively", () => {
    usePlayerStore.getState().skipNext(1);
    expect(usePlayerStore.getState().currentAudio).toBe(1);
    usePlayerStore.getState().skipPrev(1);
    expect(usePlayerStore.getState().currentAudio).toBe(0);
    usePlayerStore.getState().skipNext(0); // intentional no-op, see ListDrawer
    expect(usePlayerStore.getState().currentAudio).toBe(0);
  });

  it("sets transport flags", () => {
    usePlayerStore.getState().setPlaying(true);
    usePlayerStore.getState().setLoading(true);
    usePlayerStore.getState().setVolume(0.9);
    usePlayerStore.getState().setCurrent(3);
    const s = usePlayerStore.getState();
    expect([s.audioPlaying, s.audioLoading, s.audioVolume, s.currentAudio]).toEqual(
      [true, true, 0.9, 3]
    );
  });
});

describe("importLegacyQueue", () => {
  const fakeStorage = (data: Record<string, string>): Storage =>
    ({
      getItem: (k: string) => data[k] ?? null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    }) as unknown as Storage;

  it("imports a legacy raw array when no new key exists", () => {
    const legacy = JSON.stringify([makeAudio("a"), makeAudio("b")]);
    const out = importLegacyQueue(fakeStorage({ audioState: legacy }));
    expect(out?.map((x) => x.ID)).toEqual(["a", "b"]);
  });

  it("dedupes legacy data by ID", () => {
    const legacy = JSON.stringify([makeAudio("a"), makeAudio("a")]);
    const out = importLegacyQueue(fakeStorage({ audioState: legacy }));
    expect(out?.map((x) => x.ID)).toEqual(["a"]);
  });

  it("ignores legacy data once the new key exists", () => {
    const legacy = JSON.stringify([makeAudio("a")]);
    const out = importLegacyQueue(
      fakeStorage({ audioState: legacy, "yuki-player": "{}" })
    );
    expect(out).toBeNull();
  });

  it("returns null when there is no legacy data", () => {
    expect(importLegacyQueue(fakeStorage({}))).toBeNull();
  });

  it("survives malformed legacy JSON without throwing", () => {
    expect(importLegacyQueue(fakeStorage({ audioState: "{not json" }))).toBeNull();
  });

  it("ignores legacy data that is not an array", () => {
    expect(
      importLegacyQueue(fakeStorage({ audioState: '{"nope":true}' }))
    ).toBeNull();
  });
});
```

- [ ] **Step 3: Run — confirm they FAIL**

```bash
npm test -- store/player.test.ts
```
Expected: module-not-found / failures. Confirm red BEFORE implementing.

- [ ] **Step 4: Implement** — `apps/web/store/player.ts`

```ts
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Audio } from "@/constants/interfaces";

const STORAGE_KEY = "yuki-player";
const LEGACY_STORAGE_KEY = "audioState";

export interface PlayerState {
  audioState: Audio[];
  currentAudio: number;
  audioLoading: boolean;
  audioPlaying: boolean;
  audioVolume: number;

  setQueue: (payload: Audio[] | Audio) => void;
  addItem: (item: Audio) => void;
  deleteItem: (id: string) => void;
  clearQueue: () => void;
  skipNext: (by: number) => void;
  skipPrev: (by: number) => void;
  setLoading: (value: boolean) => void;
  setPlaying: (value: boolean) => void;
  setVolume: (value: number) => void;
  setCurrent: (index: number) => void;
}

/** Dedupe by ID and drop empty entries. This is the Phase 1 fix — keep it. */
function dedupeById(items: (Audio | null | undefined)[]): Audio[] {
  const out: Audio[] = [];
  for (const item of items) {
    if (item && !out.some((a) => a.ID === item.ID)) out.push(item);
  }
  return out;
}

/**
 * Read the pre-Zustand queue, which was stored as a RAW ARRAY under
 * "audioState". Returns null if we've already migrated (the new key exists),
 * if there's nothing to import, or if the stored value is unusable.
 */
export function importLegacyQueue(
  storage: Storage | undefined = typeof window === "undefined"
    ? undefined
    : window.localStorage
): Audio[] | null {
  if (!storage) return null;
  try {
    if (storage.getItem(STORAGE_KEY)) return null; // already migrated
    const legacy = storage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return null;
    const parsed: unknown = JSON.parse(legacy);
    if (!Array.isArray(parsed)) return null;
    return dedupeById(parsed as Audio[]);
  } catch {
    return null; // malformed data must never break the player
  }
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      audioState: [],
      currentAudio: 0,
      audioLoading: false,
      audioPlaying: false,
      audioVolume: 0.4,

      setQueue: (payload) =>
        set({
          audioState: dedupeById(Array.isArray(payload) ? payload : [payload]),
        }),

      addItem: (item) => {
        if (!item) return;
        const { audioState } = get();
        if (audioState.some((a) => a.ID === item.ID)) return;
        set({ audioState: [...audioState, item] });
      },

      deleteItem: (id) =>
        set({ audioState: get().audioState.filter((a) => a.ID !== id) }),

      clearQueue: () => set({ audioState: [] }),

      skipNext: (by) => set({ currentAudio: get().currentAudio + by }),
      skipPrev: (by) => set({ currentAudio: get().currentAudio - by }),
      setLoading: (value) => set({ audioLoading: value }),
      setPlaying: (value) => set({ audioPlaying: value }),
      setVolume: (value) => set({ audioVolume: value }),
      setCurrent: (index) => set({ currentAudio: index }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only the queue is persisted — matches the old behavior exactly.
      // Volume/playing/current were never saved and must not start being.
      partialize: (state) => ({ audioState: state.audioState }),
      // Never touch localStorage during SSR; the client rehydrates on mount.
      skipHydration: true,
    }
  )
);

/**
 * Rehydrate on the client, importing a legacy queue on first run so existing
 * users don't lose their playlist. Idempotent.
 */
export async function hydratePlayer(): Promise<void> {
  const legacy = importLegacyQueue();
  await usePlayerStore.persist.rehydrate();
  if (legacy) {
    usePlayerStore.setState({ audioState: legacy });
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}
```
NOTE: `deleteItem` uses `filter` where Redux used `splice(findIndex)`. Equivalent here because IDs are deduped and therefore unique.

- [ ] **Step 5: Run — confirm PASS**

```bash
npm test -- store/player.test.ts
```
Expected: all pass. Then the full gate:
```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: all green, 19 old tests + the new ones.
NOTE: the old `store/AudioConfig.test.ts` still exists and still passes — both stores coexist until Task 7.

- [ ] **Step 6: Commit**

```bash
git add apps/web/store/player.ts apps/web/store/player.test.ts apps/web/package.json package-lock.json
git commit -m "feat(store): add the Zustand player store

Typed store with persist + skipHydration (no SSR localStorage access) and a
one-time importer for the legacy raw-array queue so existing users keep
their playlist. Ports the Phase 1 dedupe contract as tests.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Hydrate on the client

**Files:** create `apps/web/components/PlayerHydration.tsx`; modify `apps/web/app/providers.tsx`.

- [ ] **Step 1: Create the hydration component**

```tsx
"use client";

import { useEffect } from "react";

import { hydratePlayer } from "@/store/player";

/**
 * Rehydrates the persisted player queue after mount. Rendering nothing keeps
 * the server output free of client-only state, avoiding hydration mismatch.
 */
export default function PlayerHydration() {
  useEffect(() => {
    void hydratePlayer();
  }, []);

  return null;
}
```

- [ ] **Step 2: Render it in `app/providers.tsx`**

Add the import and render `<PlayerHydration />` as the first child inside `<ThemeProvider>` (above `<Header />`). Leave the `<Provider store={store_0001}>` wrapper alone for now — Redux is still live until Task 7.

- [ ] **Step 3: Gate + commit**

```bash
npm run lint && npm run typecheck && npm test && npm run build
git add apps/web/components/PlayerHydration.tsx apps/web/app/providers.tsx
git commit -m "feat(store): rehydrate the player queue on the client

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Migrate `components/player/controls.tsx`

**Files:** `apps/web/components/player/controls.tsx`

The heaviest consumer: 5 selectors + 10 dispatches.

- [ ] **Step 1: Replace the redux block**

Remove `import { useDispatch, useSelector } from "react-redux";` and the `@/store/AudioConfig` import. Add:
```ts
import { usePlayerStore } from "@/store/player";
```
Replace the selector/dispatch block (currently `const audioConfig = useSelector(...)` … `const dispatch = useDispatch();`) with:
```ts
  const audioConfig = usePlayerStore((s) => s.audioState);
  const current = usePlayerStore((s) => s.currentAudio);
  const playing = usePlayerStore((s) => s.audioPlaying);
  const AudioLoading = usePlayerStore((s) => s.audioLoading);
  const volume = usePlayerStore((s) => s.audioVolume);
  const skipNext = usePlayerStore((s) => s.skipNext);
  const skipPrev = usePlayerStore((s) => s.skipPrev);
  const setLoading = usePlayerStore((s) => s.setLoading);
  const setPlaying = usePlayerStore((s) => s.setPlaying);
```
Keep the local variable names (`audioConfig`, `current`, `playing`, `AudioLoading`, `volume`) so the rest of the file is untouched.

- [ ] **Step 2: Replace every dispatch**

Per the mapping table: `dispatch(SET_PLAYING(x))` → `setPlaying(x)`, `dispatch(SET_LOADING(x))` → `setLoading(x)`, `dispatch(SKIP_PREV(1))` → `skipPrev(1)`, `dispatch(SKIP_NEXT(1))` → `skipNext(1)`.
Do NOT change any surrounding logic, conditions, or the ReactPlayer props.

- [ ] **Step 3: Gate**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
`typecheck` will catch any leftover unused import (`noUnusedLocals` is on).

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/player/controls.tsx
git commit -m "refactor(player): move controls to the Zustand store

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Migrate `sections/Hero.tsx`

**Files:** `apps/web/sections/Hero.tsx`

Note: it currently selects `selectAudioPlaying` TWICE (`audioPlaying` and `playing`). Keep both local names bound to the same store value — do not refactor usages.

- [ ] **Step 1: Replace the redux block**

```ts
  const audioConfig = usePlayerStore((s) => s.audioState);
  const current = usePlayerStore((s) => s.currentAudio);
  const audioPlaying = usePlayerStore((s) => s.audioPlaying);
  const playing = usePlayerStore((s) => s.audioPlaying);
  const addItem = usePlayerStore((s) => s.addItem);
```
Remove the `react-redux` and `@/store/AudioConfig` imports; add `import { usePlayerStore } from "@/store/player";`.

- [ ] **Step 2: Replace the dispatch**

`dispatch(ADD_ITEM(audio))` → `addItem(audio)`. Keep the surrounding `already`/toast logic from Phase 1 exactly as-is.

- [ ] **Step 3: Gate + commit**

```bash
npm run lint && npm run typecheck && npm test && npm run build
git add apps/web/sections/Hero.tsx
git commit -m "refactor(player): move Hero search to the Zustand store

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Migrate `components/player/ListDrawer.tsx`

**Files:** `apps/web/components/player/ListDrawer.tsx`

⚠️ `handleDelete` contains `dispatch(SKIP_NEXT(0))` — an **intentional no-op**. Port it verbatim as `skipNext(0)`. Do NOT remove or "fix" it; its whole branch must keep the same shape.

- [ ] **Step 1: Replace the redux block**

```ts
  const audioConfig = usePlayerStore((s) => s.audioState);
  const current = usePlayerStore((s) => s.currentAudio);
  const playing = usePlayerStore((s) => s.audioPlaying);
  const deleteItem = usePlayerStore((s) => s.deleteItem);
  const skipNext = usePlayerStore((s) => s.skipNext);
  const skipPrev = usePlayerStore((s) => s.skipPrev);
  const setCurrent = usePlayerStore((s) => s.setCurrent);
  const setPlaying = usePlayerStore((s) => s.setPlaying);
```

- [ ] **Step 2: Replace the dispatches**

`dispatch(DELETE_ITEM(audio.ID))` → `deleteItem(audio.ID)`; `dispatch(SKIP_PREV(1))` → `skipPrev(1)`; `dispatch(SKIP_NEXT(0))` → `skipNext(0)`; `dispatch(SET_CURRENT(index))` → `setCurrent(index)`; `dispatch(SET_PLAYING(!playing))` → `setPlaying(!playing)`.
`handleDelete`'s branching must be preserved exactly — it reads the pre-delete `audioConfig` snapshot from the render closure, which is intentional.

- [ ] **Step 3: Gate + commit**

```bash
npm run lint && npm run typecheck && npm test && npm run build
git add apps/web/components/player/ListDrawer.tsx
git commit -m "refactor(player): move ListDrawer to the Zustand store

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Migrate `UserAudioList.tsx` and `UserCollectionsList.tsx`

**Files:** `apps/web/components/player/UserAudioList.tsx`, `apps/web/components/player/UserCollectionsList.tsx`

Both use the identical shape: 3 selectors + `dispatch(ADD_ITEM(item))` inside the Phase 1 guarded-add (`already` check + toast).

- [ ] **Step 1: For EACH file, replace the redux block**

```ts
  const audioConfig = usePlayerStore((s) => s.audioState);
  const current = usePlayerStore((s) => s.currentAudio);
  const playing = usePlayerStore((s) => s.audioPlaying);
  const addItem = usePlayerStore((s) => s.addItem);
```

- [ ] **Step 2: For EACH file, replace the dispatch**

`dispatch(ADD_ITEM(item))` → `addItem(item)`. Keep the `if (item)` guard, the `already` computation, and the toast exactly as Phase 1 left them.

- [ ] **Step 3: Gate + commit**

```bash
npm run lint && npm run typecheck && npm test && npm run build
git add apps/web/components/player/UserAudioList.tsx apps/web/components/player/UserCollectionsList.tsx
git commit -m "refactor(player): move the user lists to the Zustand store

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Delete Redux

**Files:** delete `apps/web/store/AudioConfig.ts`, `apps/web/store/AudioConfig.test.ts`, `apps/web/store/UIConfig.ts`, `apps/web/store/store.ts`; modify `apps/web/app/providers.tsx`, `apps/web/package.json`, `apps/web/constants/interfaces.ts`.

- [ ] **Step 1: Confirm nothing references Redux any more**

```bash
cd apps/web
grep -rn "react-redux\|@reduxjs/toolkit\|next-redux-wrapper\|store_0001\|AudioConfig\|UIConfig\|useSelector\|useDispatch" --include=*.ts --include=*.tsx . | grep -v node_modules | grep -v "\.next"
```
Expected: hits ONLY inside the files being deleted (`store/AudioConfig*.ts`, `store/UIConfig.ts`, `store/store.ts`) and `app/providers.tsx`. **If a component still references Redux, STOP — a migration task was missed.**

- [ ] **Step 2: Remove the Provider from `app/providers.tsx`**

```tsx
"use client";

import { ThemeProvider } from "next-themes";

// components
import Header from "@/components/Header";
import PlayerHydration from "@/components/PlayerHydration";

// Firebase
import { AuthContextProvider } from "@/context/AuthContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthContextProvider>
      <ThemeProvider attribute="class">
        <PlayerHydration />
        <Header />
        <main className={` relative w-full min-h-screen `}>{children}</main>
      </ThemeProvider>
    </AuthContextProvider>
  );
}
```
⚠️ Compare against the CURRENT file first and preserve its exact `<main>` className and structure — only the `<Provider>` wrapper and its imports are removed.

- [ ] **Step 3: Delete the Redux store files**

```bash
cd D:\Dev\YukiRythem\Yukirhythm
git rm apps/web/store/AudioConfig.ts
git rm apps/web/store/AudioConfig.test.ts
git rm apps/web/store/UIConfig.ts
git rm apps/web/store/store.ts
```
(The dedupe coverage lives on in `store/player.test.ts` — verify those tests exist and pass before deleting the old ones.)

- [ ] **Step 4: Remove the packages**

From `apps/web/package.json` `"dependencies"`:
```
    "@reduxjs/toolkit": "^1.9.1",
    "next-redux-wrapper": "^8.1.0",
    "react-redux": "^8.0.5",
```
Then from the root: `npm install`

- [ ] **Step 5: Drop `AudioConfigType` if now unused**

```bash
cd apps/web
grep -rn "AudioConfigType" --include=*.ts --include=*.tsx . | grep -v node_modules
```
If nothing references it, remove the `AudioConfigType` interface from `constants/interfaces.ts` (the store's own type replaces it). If something does, leave it and report.

- [ ] **Step 6: Gate**

```bash
cd D:\Dev\YukiRythem\Yukirhythm
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: all green.

- [ ] **Step 7: 🎯 Confirm the SSR error is GONE**

Read the `npm run build` output carefully. The line:
```
Failed to load state from localStorage ReferenceError: localStorage is not defined
```
**must no longer appear.** That's the proof the SSR fix worked. If it still appears, something still reads `localStorage` at module scope — find it and report. Quote the relevant build output in your report either way.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(store): delete Redux

Removes @reduxjs/toolkit, react-redux, and next-redux-wrapper along with the
AudioConfig/UIConfig slices, the store, and the Provider. UIConfig was
already dead. Fixes the SSR 'localStorage is not defined' error, which came
from reading localStorage at module scope.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Push and prove CI green

- [ ] **Step 1: Full gate + push**

```bash
npm run lint && npm run typecheck && npm test && npm run build
git push origin v2_2026
```

- [ ] **Step 2: Confirm CI green — the real gate**

```bash
gh run list --branch v2_2026 --limit 1
```
Poll until `completed`, then `gh run view <run-id>`. Expected: the `web` job green.
**If CI fails, diagnose with `gh run view <run-id> --log-failed`, fix, push again.** CI green is the definition of done — especially `format:check`, which local runs cannot verify.

- [ ] **Step 3: Report**

Report: Zustand version, packages removed, the before/after of the `localStorage` build error, test counts, and the CI run URL.

---

## Definition of Done

- [ ] Zero Redux packages; `store/` holds only `player.ts` + `player.test.ts`.
- [ ] No `<Provider>`; no `useSelector`/`useDispatch` anywhere.
- [ ] The Phase 1 dedupe contract still passes (ported tests).
- [ ] The legacy-queue migration is tested, including malformed data.
- [ ] **The `localStorage is not defined` error is gone from the build output.**
- [ ] All gates + **CI green on `v2_2026`**.
- [ ] Player behavior is unchanged.

## Owner smoke test (with the real `.env`)

`npm run dev` → search → add tracks → play/pause → skip next/prev → volume → open the drawer → delete a track (including the currently-playing first track) → **reload and confirm the queue survived**. If you had a queue saved before this upgrade, confirm it's still there — that's the legacy migration working.

## Self-review notes (author)

- **Spec coverage:** store+persist+legacy migration → Task 1; hydration → Task 2; the 5 consumers → Tasks 3–6; delete UIConfig/store/Provider/packages → Task 7; SSR-error proof → Task 7 Step 7; CI → Task 8. ✅
- **Naming is consistent** between the mapping table, the store implementation, and every migration task.
- **Ordering is deliberate:** the store lands and is tested before any consumer moves; Redux is deleted only after the last consumer is off it, so the app never sits half-migrated.
- **Behavior preservation is called out** where it's easy to get wrong: `skipNext(0)`, Hero's double-selected `playing`, `handleDelete`'s pre-delete snapshot, and `partialize` (queue-only persistence).
- **Placeholder scan:** every step has real code or a real command. ✅
