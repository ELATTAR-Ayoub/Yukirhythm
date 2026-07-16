# Phase 3 — Redux → Zustand (Design)

**Date:** 2026-07-17
**Project:** Yukirhythm
**Branch:** `v2_2026`
**Risk:** 🟡 Medium — rewrites the player's state layer (5 components), but behavior-preserving

---

## Goal

Replace Redux with Zustand, delete the last 3 Redux packages, **fix the SSR `localStorage` crash**, and preserve every user's saved play queue. No user-visible change.

## Why now

- **RTK is on v1.** Phase 4 upgrades the stack — no point paying to upgrade RTK 1→2 for a library we're deleting.
- **The SSR error is Redux-shaped.** `store/AudioConfig.ts:31` calls `loadFromLocalStorage()` at module init, which runs on the server and throws `ReferenceError: localStorage is not defined` on every build/prerender. Zustand's `persist` fixes this properly.
- **Redux is now enormously oversized for what's left.** After Phase 2, it backs exactly **one** slice.

## What Phase 2 changed (this spec is written against the CURRENT tree)

- **`store/UIConfig.ts` is now completely dead.** Nothing outside `store/` imports `setMenuToggle`/`selectMenuToggle`. It is **deleted**, not migrated.
- `store/store.ts` exports `wrapper` (never consumed) and `useAppDispatch` (never consumed) — both dead.
- So Redux backs **only** `AudioConfig` (the player), consumed by 5 components.

---

## Current state

**`store/AudioConfig.ts`** — state: `audioState: Audio[]`, `currentAudio: number`, `audioLoading: boolean`, `audioPlaying: boolean`, `audioVolume: number`.
Actions: `setAudioConfig`, `ADD_ITEM`, `DELETE_ITEM`, `DELETE_ARR`, `SKIP_NEXT`, `SKIP_PREV`, `SET_LOADING`, `SET_PLAYING`, `SET_VOLUME`, `SET_CURRENT`.
Selectors: `selectAudioConfig`, `selectCurrentAudio`, `selectAudioLoading`, `selectAudioPlaying`, `selectAudioVolume`.

**Consumers (5):** `sections/Hero.tsx`, `components/player/controls.tsx`, `components/player/ListDrawer.tsx`, `components/player/UserAudioList.tsx`, `components/player/UserCollectionsList.tsx`. Plus `app/providers.tsx` (the `<Provider>`).

**Tests:** `store/AudioConfig.test.ts` — 4 tests covering the Phase 1 ID-dedupe fix. **These must survive.**

---

## Target design

### A single typed store — `store/player.ts`

```ts
interface PlayerState {
  audioState: Audio[];
  currentAudio: number;
  audioLoading: boolean;
  audioPlaying: boolean;
  audioVolume: number;

  setQueue: (payload: Audio[] | Audio) => void;  // was setAudioConfig
  addItem: (item: Audio) => void;                // was ADD_ITEM
  deleteItem: (id: string) => void;              // was DELETE_ITEM
  clearQueue: () => void;                        // was DELETE_ARR
  skipNext: (by: number) => void;                // was SKIP_NEXT
  skipPrev: (by: number) => void;                // was SKIP_PREV
  setLoading: (v: boolean) => void;
  setPlaying: (v: boolean) => void;
  setVolume: (v: number) => void;
  setCurrent: (n: number) => void;
}
```

- **camelCase** replaces the SCREAMING_CASE actions. The 5 consumers change anyway (no more `useSelector`/`useDispatch`), so this costs nothing and reads better.
- Components subscribe granularly: `usePlayerStore((s) => s.audioState)` — no selector layer needed.
- **Fully typed by inference.** No `AppState`, no untyped `useAppDispatch`.
- **Behavior is preserved exactly**, including the Phase 1 ID-dedupe in `addItem`/`setQueue` and the empty-payload guard.

### Persistence — fixes the SSR bug

Use Zustand's `persist` middleware with:
- **`partialize`** so only `audioState` is persisted — matching today's behavior exactly (the old code only ever saved `audioState`; volume/playing/current were never persisted, and must not start being).
- **`skipHydration: true`**, with rehydration triggered from a **client-only** effect. This is what removes the server-side `localStorage` access — and it also avoids a React hydration mismatch (server renders an empty queue; the client fills it in after mount).

### ⚠️ Preserve users' saved queues — one-time migration

Today's code writes the **raw array** to key `audioState`:
```js
localStorage.setItem("audioState", JSON.stringify(state.audioState))
```
Zustand `persist` writes a **different shape** — `{ state: {...}, version: n }` — so pointing it at the same key would read garbage, and pointing it at a new key would silently **wipe every user's saved play queue**.

**Design:** persist under a new key `yuki-player`, and on first client rehydrate, if `yuki-player` is absent **and** the legacy `audioState` key exists, parse the legacy array into the store, then remove the legacy key. One-time, client-side, idempotent, and no user loses their queue.

This must be **unit-tested**, including the malformed-legacy-data case (a `JSON.parse` throw must not break the player).

### Cleanup that comes with it

- **Delete** `store/UIConfig.ts` (dead) and `store/store.ts` (no longer needed).
- **Remove `<Provider>`** from `app/providers.tsx` — Zustand needs no provider.
- **Remove** `@reduxjs/toolkit`, `react-redux`, `next-redux-wrapper`.
- `constants/interfaces.ts`: `AudioConfigType` is superseded by the store's own inferred type — remove it if nothing else uses it (verify first).

---

## Non-goals (explicitly deferred)

- **No dependency upgrades** — Phase 4 (Next 15, React 19, Firebase, TS, Tailwind 4, ESLint 9).
- **No API/Route Handlers/Firestore-rules work** — Phase 5.
- **No player behavior changes.** The hidden ReactPlayer, buffering spinner, `onError` skip, and toasts all behave exactly as today.
- **No design changes** — Phase 6.
- **No new player features** (shuffle was never implemented; it stays unimplemented).
- **No change to what gets persisted** — still only the queue.

---

## Testing strategy

- **Port `store/AudioConfig.test.ts` → `store/player.test.ts`**, keeping every Phase 1 dedupe assertion (add new, reject duplicate ID, ignore null payload, dedupe an array payload). These tests are the contract that the dedupe bug-fix survives the rewrite.
- **New tests:** the legacy-localStorage migration (legacy key present → queue imported + legacy key removed; new key present → legacy ignored; malformed legacy JSON → no throw, empty queue).
- **Gates:** `lint`, `typecheck` (now with `noUnusedLocals`), `test`, `build` — green after each task. **CI green is the definition of done.**
- **The build log is now a test:** `Failed to load state from localStorage ReferenceError: localStorage is not defined` currently appears during static generation. After this phase it **must be gone**. That's the proof the SSR fix works.
- **Manual smoke (owner, real `.env`):** search → add tracks → play/pause → skip → volume → open the list drawer → remove a track → **reload the page and confirm the queue survived** → confirm an existing user's pre-existing queue survives the upgrade.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Users lose their saved queue** | The one-time legacy migration, unit-tested including malformed data |
| Hydration mismatch (server renders empty queue, client has one) | `skipHydration: true` + rehydrate in a client effect — the standard Next.js pattern |
| A behavior regression across 5 rewritten components | Port the dedupe tests first; migrate one component per task with a gate after each; manual smoke covers the rest |
| Persisting more than before (e.g. volume) changes behavior | `partialize` to `audioState` only — asserted in the spec and reviewed |
| Subtle `SKIP_NEXT(1)` semantics lost in the rename | `skipNext(by)` keeps the additive semantics; the guard logic stays in the components, unchanged |
| Zustand version pulled in is too new for React 18 | Pin to a version compatible with the current stack; upgrades are Phase 4 |

## Success criteria

Zero Redux packages remain. `store/` contains one typed Zustand store plus its tests. `app/providers.tsx` has no `<Provider>`. The dedupe tests still pass. **The `localStorage` error is gone from the build output.** An existing user's saved queue survives. All gates and CI green, and the player behaves exactly as it does today.
