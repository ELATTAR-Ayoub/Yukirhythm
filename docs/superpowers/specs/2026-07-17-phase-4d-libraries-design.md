# Phase 4D — Remaining Libraries (Design) — *finishes Phase 4*

**Date:** 2026-07-17
**Project:** Yukirhythm
**Branch:** `v2_2026`
**Risk:** 🟡 Medium overall — one 🔴 high-risk item (`react-player`)

---

## Goal

Upgrade **everything still outdated**, closing out Phase 4 completely. After this, every dependency is current except two that are **provably blocked upstream** (documented below, not skipped).

## Complete remaining set (from `npm outdated`, verified 2026-07-17)

| Package | Current | Target | Risk |
|---|---|---|---|
| `firebase` | 10.14.1 | **12.16.0** | 🟡 2 majors; touches auth + Firestore |
| `zod` | 3.25.76 | **4.4.3** | 🟡 validation rewrite; 3 form schemas |
| `@hookform/resolvers` | 3.10.0 | **5.4.0** | 🟡 moves with zod 4 |
| `tailwind-merge` | 2.6.1 | **3.6.0** | 🟢 used only by `cn()` |
| `@types/node` | 22.20.1 | **26.1.1** | 🟢 types only |
| `react-player` | 2.16.1 | **3.4.0** | 🔴 **full rewrite — drives the player** |

**Already satisfied:** `react-hook-form` is **7.81.0**, which meets `@hookform/resolvers@5`'s `^7.55.0` peer — no bump needed.

## 🚫 Blocked upstream — NOT skipped, blocked (re-verified this phase)

| Package | Why |
|---|---|
| **`typescript` 7.0.2** | Its npm package is a **CLI-only shim**: `require("typescript")` exports only `version`/`versionMajorMinor` — no `sys`, no `readConfigFile`, no `parseJsonConfigFileContent`. The compiler is a native Go binary and the JS API is gone, so **every tool that reads it breaks** (Next silently gets empty `paths` → all `@/*` imports die behind misleading webpack errors). **Not a Next-version issue.** Stays on **5.9.3**. |
| **`eslint` 10.7.0** | `eslint-config-next@16` declares `eslint >=9`, but its own transitive plugins (`eslint-plugin-react@7.37.5`, `eslint-plugin-import@2.32.0`, `eslint-plugin-jsx-a11y@6.10.2`) **cap at 9**. npm "resolves" this by installing two ESLint instances, which hard-crashes lint. **The gate is the plugin peers, nothing else.** Stays on **9.39.5**. |

Both were attempted, diagnosed, and reverted with evidence. They are re-checkable one-liners, not guesses — see the plan.

---

## The one real decision: `react-player` 2 → 3

**v3 is a ground-up rewrite that realigns the API to the HTML5 media element.** `components/player/controls.tsx` uses essentially all of the v2 surface:

```
url · loop · config.youtube.playerVars (13 params: showinfo, modestbranding,
controls, rel, fs, disablekb, iv_load_policy, playsinline, …) · playing ·
width={0} · height={0} · volume · onReady · onBuffer · onBufferEnd · onError ·
onPlay · onPause · onEnded · onProgress({playedSeconds}) · onDuration(duration)
+ playerRef.current.seekTo(time)
```

v3 replaces these wholesale — `url`→`src`, `config` restructured, `onProgress`→`onTimeUpdate`, `onDuration`→`onDurationChange`, `onBuffer`/`onBufferEnd`→`onWaiting`/`onPlaying`, `seekTo()`→`currentTime`. That is **re-engineering the player**, not bumping a version.

**Important context:** `react-player@2.16.1` peers `>=16.6.0` and **works fine on React 19** — v2 is **not blocking anything**. There is no correctness, security, or compatibility reason forcing v3 today; the only argument is "be current."

**Decision: attempt it, with a hard stop.** Map the v3 API from its actual shipped types, port `controls.tsx`, and verify playback. **If the port can't preserve current playback behaviour exactly, we keep v2 and document why** — the player is the one component whose breakage users feel immediately, and a version number is not worth breaking it. This is the last item in the phase precisely so a stop here costs nothing else.

The Phase 1 fixes it must preserve: the buffering spinner (`onBuffer`/`onBufferEnd` → `setLoading`), the unplayable-video `onError` → toast + skip, `onEnded` → advance, seek via the slider, and volume.

---

## Non-goals

- **No YouTube engine swap.** `@fabricio-191/youtube@0.0.4` stays (a *behaviour* change, not an upgrade — its own phase).
- **No player behaviour change.** Whatever react-player version we land on, playback must behave exactly as today.
- **No design changes** (Phase 6), **no API/Route Handlers** (Phase 5).
- **No `slice(0.2)` avatar fix, no React Compiler `warn` fixes** — both have their own tasks.
- **No forcing TS 7 / ESLint 10** via `overrides` — that asserts compatibility that demonstrably doesn't exist.

---

## Testing strategy

- **Gates after every item:** `lint`, `typecheck`, `test` (41), `build`. **CI green is the definition of done.**
- **The 4A smoke tests are the tripwire** — `controls.test.tsx` and `ListDrawer.test.tsx` mock `react-player`, so **they will NOT catch a v3 API break**. Say so plainly: for react-player, the tests are nearly blind and **manual playback verification is the only real check**.
- **`login.test.tsx` is the zod 4 tripwire** — it asserts the form's fields resolve through `react-hook-form` + the zod resolver, so a broken resolver fails it immediately. That test was written in 4A for exactly this.
- **Manual smoke (owner, mandatory):** sign in (firebase 12) → search → add → **play/pause/skip/seek/volume** (react-player) → unplayable video toasts + skips → like/unlike (Firestore writes) → create a collection (zod + resolvers) → login/signup form validation errors still render.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| **react-player 3 breaks playback** | Last item, isolated. Map the API from shipped types, not memory. **Keeping v2 is an explicitly acceptable outcome.** Mocked tests can't see this — manual verification decides. |
| **firebase 12 breaks auth/Firestore silently** | The modular API has been stable across 10→12; our surface is small (`getAuth`, `signInWithPopup`, `onAuthStateChanged`, `doc`/`getDoc`/`setDoc`/`updateDoc`/`runTransaction`/`arrayUnion`/`increment`). Typecheck catches signature drift; manual sign-in + like/unlike catches the rest. **Prod data is uid-keyed and already migrated — do not touch the data model.** |
| **zod 4 changes error messages/behaviour** | Only 3 schemas (login, signup, addCollection). `login.test.tsx` is the tripwire; manual check that validation errors still display. |
| **`@hookform/resolvers` 5 × zod 4 mismatch** | They move together; `react-hook-form@7.81` already satisfies the `^7.55` peer. |
| **tailwind-merge 3 changes `cn()` output** | `lib/utils.test.ts` asserts real merge behaviour (`px-2 px-4` → `px-4`) — a genuine tripwire, already passing. |
| **npm nests duplicate instances silently** | `npm ls` **and** a filesystem check after each install — this has bitten twice (ESLint, React). |
| **`git add -A` commits the owner's 19 untracked fonts** | Stage explicit paths only. |

## Success criteria

`npm outdated` is empty except `typescript` and `eslint`, each with a documented upstream blocker. All gates + **CI green on `v2_2026`**. **Playback verified by hand.** Phase 4 closed: Next 16 · React 19 · Tailwind 4 · Firebase 12 · zod 4 · Vite 8 / Vitest 4 · Node 22, on a tree with zero unused dependencies.
